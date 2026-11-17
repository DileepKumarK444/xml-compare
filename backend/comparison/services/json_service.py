"""JSONComparisonService: same contract as XMLComparisonService, for JSON documents."""
from __future__ import annotations

from .json_parser import JSONParseError, decode_json_text, parse_json
from .json_structural import JSONStructuralComparator
from .options import CompareOptions
from .source import XMLSourceComparator  # a plain line diff; it has no XML-specific logic apart from comments


class JSONComparisonService:
    format_name = "json"

    def __init__(self):
        self.source = XMLSourceComparator()
        self.structural = JSONStructuralComparator()

    def compare(self, original: bytes, modified: bytes, options: CompareOptions,
                original_name: str = "original.json", modified_name: str = "modified.json") -> dict:
        try:
            a = parse_json(original)
        except JSONParseError as exc:
            raise JSONParseError(f"{original_name}: {exc.message}", exc.line) from exc
        try:
            b = parse_json(modified)
        except JSONParseError as exc:
            raise JSONParseError(f"{modified_name}: {exc.message}", exc.line) from exc

        a_text, b_text = decode_json_text(original), decode_json_text(modified)
        # JSON has no comments, so the "ignore comments" option never applies.
        src_options = CompareOptions(options.ignore_whitespace, False, options.ignore_order)
        return {
            "options": {
                "ignore_whitespace": options.ignore_whitespace,
                "ignore_comments": options.ignore_comments,
                "ignore_order": options.ignore_order,
            },
            "original": {"filename": original_name, "size": len(original), "text": a_text},
            "modified": {"filename": modified_name, "size": len(modified), "text": b_text},
            "source": self.source.compare(a_text, b_text, src_options),
            "content": self.structural.compare(a, b, options),
        }
