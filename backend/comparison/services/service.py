"""XMLComparisonService: orchestrates parsing and both comparators.

Independent of Django views so it can be reused by CLIs, tests or other
transports. New formats register a service in `comparison.registry`.
"""
from __future__ import annotations

from .options import CompareOptions
from .parser import XMLParseError, XMLParser
from .source import XMLSourceComparator
from .structural import XMLStructuralComparator


def decode_text(data: bytes) -> str:
    """Decode bytes for source display without altering content (BOM removed)."""
    for enc in ("utf-8-sig", "utf-16"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("latin-1")


class XMLComparisonService:
    format_name = "xml"

    def __init__(self):
        self.parser = XMLParser()
        self.source = XMLSourceComparator()
        self.structural = XMLStructuralComparator()

    def compare(self, original: bytes, modified: bytes, options: CompareOptions,
                original_name: str = "original.xml", modified_name: str = "modified.xml") -> dict:
        try:
            a = XMLParser.parse(original, options)
        except XMLParseError as exc:
            raise XMLParseError(f"{original_name}: {exc.message}", exc.line) from exc
        try:
            b = XMLParser.parse(modified, options)
        except XMLParseError as exc:
            raise XMLParseError(f"{modified_name}: {exc.message}", exc.line) from exc

        a_text, b_text = decode_text(original), decode_text(modified)
        return {
            "options": {
                "ignore_whitespace": options.ignore_whitespace,
                "ignore_comments": options.ignore_comments,
                "ignore_order": options.ignore_order,
            },
            "original": {"filename": original_name, "size": len(original), "text": a_text},
            "modified": {"filename": modified_name, "size": len(modified), "text": b_text},
            "source": self.source.compare(a_text, b_text, options),
            "content": self.structural.compare(a, b, options),
        }
