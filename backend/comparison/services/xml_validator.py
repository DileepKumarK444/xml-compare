"""XMLValidator: well-formedness and optional XSD validation, reporting every error with its position.

Parsing is hardened (no network, no entity expansion, no DTD loading). Schemas must be a single,
self-contained XSD: include/import/redefine are rejected so an uploaded schema can never make the
server read other files.
"""
from __future__ import annotations

from lxml import etree

from .errors import ParseError
from .service import decode_text

MAX_ERRORS = 500
_XS = "{http://www.w3.org/2001/XMLSchema}"


class ValidationInputError(ParseError):
    """The request itself is unusable (e.g. the schema is not a valid XSD)."""


def _parser(recover: bool = False) -> etree.XMLParser:
    return etree.XMLParser(
        resolve_entities=False, no_network=True, load_dtd=False, dtd_validation=False,
        huge_tree=False, recover=recover,
    )


def _entries(log, kind: str) -> list[dict]:
    out, seen = [], set()
    for e in log:
        key = (e.line, e.column, e.message)
        if key in seen:
            continue
        seen.add(key)
        out.append({"kind": kind, "line": max(e.line, 1), "column": max(e.column, 1), "message": e.message})
    return out


def _stats(root: etree._Element) -> dict:
    elements = attributes = depth = 0
    namespaces: set[str] = set()
    stack = [(root, 1)]
    while stack:
        el, d = stack.pop()
        if not isinstance(el.tag, str):
            continue
        elements += 1
        attributes += len(el.attrib)
        depth = max(depth, d)
        ns = etree.QName(el).namespace
        if ns:
            namespaces.add(ns)
        stack.extend((c, d + 1) for c in el)
    return {"root": etree.QName(root).localname, "elements": elements, "attributes": attributes,
            "max_depth": depth, "namespaces": sorted(namespaces)}


def _load_schema(data: bytes, name: str) -> etree.XMLSchema:
    try:
        doc = etree.fromstring(data, _parser())
    except etree.XMLSyntaxError as exc:
        raise ValidationInputError(f"{name}: the schema is not well-formed XML: {exc.msg}",
                                   getattr(exc, "lineno", None)) from exc
    for el in doc.iter(_XS + "include", _XS + "import", _XS + "redefine"):
        if el.get("schemaLocation"):
            raise ValidationInputError(
                f"{name}: schemas that include or import other files aren't supported. "
                "Upload a single self-contained XSD.")
    try:
        return etree.XMLSchema(doc)
    except etree.XMLSchemaParseError as exc:
        raise ValidationInputError(f"{name}: not a valid XSD schema: {exc}") from exc


class XMLValidator:
    def validate(self, xml: bytes, schema: bytes | None = None,
                 xml_name: str = "document.xml", schema_name: str = "schema.xsd") -> dict:
        errors: list[dict] = []
        stats = None
        doc = None
        try:
            doc = etree.fromstring(xml, _parser())
        except etree.XMLSyntaxError as exc:
            # Re-parse in recovery mode to collect more than the first error.
            p = _parser(recover=True)
            try:
                etree.fromstring(xml, p)
            except etree.XMLSyntaxError:
                pass
            errors = _entries(p.error_log, "syntax") or _entries(exc.error_log, "syntax") or [
                {"kind": "syntax", "line": getattr(exc, "lineno", 1) or 1, "column": 1, "message": str(exc.msg)}]
        except ValueError as exc:
            errors = [{"kind": "syntax", "line": 1, "column": 1, "message": str(exc)}]

        well_formed = doc is not None
        schema_info = {"provided": schema is not None, "filename": schema_name if schema else None, "valid": None}
        if doc is not None:
            stats = _stats(doc)
            if schema is not None:
                xsd = _load_schema(schema, schema_name)
                schema_info["valid"] = bool(xsd.validate(doc))
                errors = _entries(xsd.error_log, "schema")

        errors = errors[:MAX_ERRORS]
        for i, e in enumerate(errors, 1):
            e["id"] = i
        syntax = sum(e["kind"] == "syntax" for e in errors)
        return {
            "filename": xml_name, "size": len(xml), "text": decode_text(xml),
            "well_formed": well_formed, "schema": schema_info,
            "valid": well_formed and not errors,
            "summary": {"errors": len(errors), "syntax": syntax, "schema": len(errors) - syntax},
            "errors": errors, "stats": stats,
        }
