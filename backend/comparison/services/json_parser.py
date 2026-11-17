"""Safe JSON parsing for the comparison engine (stdlib only, in-memory)."""
from __future__ import annotations

import json
from typing import Any

from .errors import ParseError


class JSONParseError(ParseError):
    pass


def decode_json_text(data: bytes) -> str:
    """Decode bytes without altering content (BOM removed)."""
    for enc in ("utf-8-sig", "utf-16"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("latin-1")


def parse_json(data: bytes) -> Any:
    text = decode_json_text(data)
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise JSONParseError(f"Invalid JSON: {exc.msg} (column {exc.colno})", exc.lineno) from exc
    except RecursionError as exc:
        raise JSONParseError("JSON is nested too deeply.") from exc
