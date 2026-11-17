"""TextComparisonService: plain line diff of any text file (source view only)."""
from __future__ import annotations

from .errors import ParseError
from .json_parser import decode_json_text as decode_text
from .options import CompareOptions
from .source import XMLSourceComparator  # a plain line diff; comment handling is opt-in and unused here


class TextParseError(ParseError):
    pass


def _check(data: bytes, name: str) -> None:
    if b"\x00" in data[:8192] and not data.startswith((b"\xff\xfe", b"\xfe\xff")):
        raise TextParseError(f"{name}: this looks like a binary file, not text.")


class TextComparisonService:
    format_name = "text"

    def __init__(self):
        self.source = XMLSourceComparator()

    def compare(self, original: bytes, modified: bytes, options: CompareOptions,
                original_name: str = "original.txt", modified_name: str = "modified.txt") -> dict:
        _check(original, original_name)
        _check(modified, modified_name)
        a_text, b_text = decode_text(original), decode_text(modified)
        src_options = CompareOptions(options.ignore_whitespace, False, False)
        return {
            "options": {
                "ignore_whitespace": options.ignore_whitespace,
                "ignore_comments": options.ignore_comments,
                "ignore_order": options.ignore_order,
            },
            "original": {"filename": original_name, "size": len(original), "text": a_text},
            "modified": {"filename": modified_name, "size": len(modified), "text": b_text},
            "source": self.source.compare(a_text, b_text, src_options),
            "content": None,  # no structural view for plain text
        }
