"""XMLParser: safe parsing of XML bytes into a format-neutral node model.

The comparators work on `Node` objects, never on lxml elements, so another
document format could provide its own parser producing the same model.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field

from lxml import etree

from .options import CompareOptions

ID_ATTRIBUTES = ("id", "xml:id", "name", "key", "uuid", "ref", "code")
_WS = re.compile(r"\s+")


class XMLParseError(Exception):
    def __init__(self, message: str, line: int | None = None):
        super().__init__(message)
        self.message = message
        self.line = line


@dataclass
class Node:
    kind: str                       # "element" | "comment"
    name: str                       # display name (prefix:local) or "#comment"
    ns: str = ""
    local: str = ""
    attrs: dict[str, str] = field(default_factory=dict)  # display name -> value
    text_parts: list[str] = field(default_factory=list)  # direct text chunks in order
    children: list["Node"] = field(default_factory=list)
    hash: str = ""

    @property
    def key(self) -> tuple[str, str, str]:
        return (self.kind, self.ns, self.local)

    @property
    def text(self) -> str:
        return " ".join(self.text_parts) if len(self.text_parts) > 1 else "".join(self.text_parts)

    @property
    def identity(self) -> str | None:
        for name in ID_ATTRIBUTES:
            if name in self.attrs:
                return f"{name}={self.attrs[name]}"
        return None


class XMLParser:
    """Parses bytes/str into a Node tree. Hardened against XXE and entity bombs."""

    @staticmethod
    def _parser() -> etree.XMLParser:
        return etree.XMLParser(
            resolve_entities=False,
            no_network=True,
            load_dtd=False,
            dtd_validation=False,
            huge_tree=False,
            strip_cdata=True,  # CDATA is treated as ordinary text
            remove_comments=False,
            remove_pis=True,
        )

    @classmethod
    def validate(cls, data: bytes) -> etree._Element:
        try:
            return etree.fromstring(data, cls._parser())
        except etree.XMLSyntaxError as exc:
            line = getattr(exc, "lineno", None) or (exc.position[0] if exc.position else None)
            raise XMLParseError(str(exc.msg), line) from exc
        except ValueError as exc:  # e.g. unicode string with encoding declaration
            raise XMLParseError(str(exc)) from exc

    @classmethod
    def parse(cls, data: bytes, options: CompareOptions) -> Node:
        """Return a virtual document node whose single child is the root element."""
        root = cls.validate(data)
        doc = Node(kind="element", name="#document", local="#document")
        # Comments before/after the root element are siblings of the root.
        for prev in reversed(list(root.itersiblings(preceding=True))):
            if isinstance(prev, etree._Comment) and not options.ignore_comments:
                doc.children.append(cls._comment(prev, options))
        doc.children.append(cls._element(root, options))
        for nxt in root.itersiblings():
            if isinstance(nxt, etree._Comment) and not options.ignore_comments:
                doc.children.append(cls._comment(nxt, options))
        cls._finalise(doc, options)
        return doc

    # -- internals ---------------------------------------------------------
    @staticmethod
    def _norm(text: str | None, options: CompareOptions) -> str | None:
        if text is None:
            return None
        if options.ignore_whitespace:
            text = _WS.sub(" ", text).strip()
            return text or None
        return text if text != "" else None

    @staticmethod
    def _display(qname: etree.QName, el: etree._Element) -> str:
        prefix = el.prefix
        return f"{prefix}:{qname.localname}" if prefix else qname.localname

    @classmethod
    def _comment(cls, c: etree._Comment, options: CompareOptions) -> Node:
        text = c.text or ""
        if options.ignore_whitespace:
            text = _WS.sub(" ", text).strip()
        return Node(kind="comment", name="#comment", local="#comment", text_parts=[text])

    @classmethod
    def _element(cls, el: etree._Element, options: CompareOptions) -> Node:
        qn = etree.QName(el)
        node = Node(kind="element", name=cls._display(qn, el), ns=qn.namespace or "", local=qn.localname)
        for k, v in el.attrib.items():
            aq = etree.QName(k)
            if aq.namespace:
                prefix = next((p for p, u in el.nsmap.items() if u == aq.namespace and p), None)
                if aq.namespace == "http://www.w3.org/XML/1998/namespace":
                    prefix = "xml"
                disp = f"{prefix}:{aq.localname}" if prefix else k
            else:
                disp = k
            node.attrs[disp] = v
        parts: list[str] = []
        t = cls._norm(el.text, options)
        if t:
            parts.append(t)
        for child in el:
            if isinstance(child, etree._Comment):
                if not options.ignore_comments:
                    node.children.append(cls._comment(child, options))
            elif isinstance(child, etree._Entity):  # unresolved (never expanded) entity
                parts.append(f"&{child.name};")
            elif isinstance(child, etree._Element):
                node.children.append(cls._element(child, options))
            tail = cls._norm(child.tail, options)
            if tail:
                parts.append(tail)
        node.text_parts = parts
        return node

    @classmethod
    def _finalise(cls, node: Node, options: CompareOptions) -> str:
        child_hashes = [cls._finalise(c, options) for c in node.children]
        if options.ignore_order:
            child_hashes.sort()
        h = hashlib.sha1()
        h.update(repr((node.kind, node.ns, node.local, sorted(node.attrs.items()), node.text_parts, child_hashes)).encode())
        node.hash = h.hexdigest()
        return node.hash
