"""XMLSourceComparator: line-level diff of the raw XML text.

Uses difflib.SequenceMatcher (stdlib, Ratcliff/Obershelp) over normalised line
keys. The original text is never modified; normalisation only affects the keys
used for matching. Character-level highlighting is done by the editor.
"""
from __future__ import annotations

import re

from .options import CompareOptions

_WS = re.compile(r"\s+")
_NEWLINE = re.compile(r"\r\n|\r|\n")  # same line splitting rules as Monaco


def split_lines(text: str) -> list[str]:
    return _NEWLINE.split(text)


def _comment_mask(lines: list[str]) -> list[bool]:
    """True for lines that consist only of XML comment content."""
    mask, inside = [], False
    for s in lines:
        i, remainder, touched = 0, "", inside
        while i < len(s):
            if inside:
                end = s.find("-->", i)
                if end == -1:
                    i = len(s)
                else:
                    inside, i = False, end + 3
            else:
                start = s.find("<!--", i)
                if start == -1:
                    remainder += s[i:]
                    break
                remainder += s[i:start]
                inside, i, touched = True, start + 4, True
        mask.append(touched and not remainder.strip())
    return mask


class XMLSourceComparator:
    def compare(self, original: str, modified: str, options: CompareOptions) -> dict:
        import difflib

        a_lines, b_lines = split_lines(original), split_lines(modified)

        def keep(lines: list[str]) -> list[tuple[int, str]]:
            mask = _comment_mask(lines) if options.ignore_comments else [False] * len(lines)
            out = []
            for i, line in enumerate(lines):
                if mask[i]:
                    continue
                key = _WS.sub(" ", line).strip() if options.ignore_whitespace else line
                if options.ignore_whitespace and key == "":
                    continue  # blank lines are formatting only
                out.append((i + 1, key))
            return out

        a, b = keep(a_lines), keep(b_lines)
        sm = difflib.SequenceMatcher(None, [k for _, k in a], [k for _, k in b], autojunk=False)

        diffs: list[dict] = []
        unchanged = 0

        def add(kind, a_rng, b_rng, desc, preview):
            diffs.append(
                {
                    "id": len(diffs) + 1,
                    "type": kind,
                    "original_start": a_rng[0] if a_rng else None,
                    "original_end": a_rng[1] if a_rng else None,
                    "modified_start": b_rng[0] if b_rng else None,
                    "modified_end": b_rng[1] if b_rng else None,
                    "description": desc,
                    "preview": preview,
                }
            )

        def rng(seq, i1, i2):
            return (seq[i1][0], seq[i2 - 1][0]) if i2 > i1 else None

        def text_of(lines, r):
            return " ".join(l.strip() for l in lines[r[0] - 1 : r[1]])[:160] if r else ""

        def lines_word(r):
            n = r[1] - r[0] + 1
            return f"line {r[0]}" if n == 1 else f"lines {r[0]}–{r[1]}"

        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag == "equal":
                unchanged += i2 - i1
                continue
            if tag == "replace":
                k = min(i2 - i1, j2 - j1)
                ra, rb = rng(a, i1, i1 + k), rng(b, j1, j1 + k)
                add("modified", ra, rb, f"Changed {lines_word(ra)} → {lines_word(rb)}",
                    f"{text_of(a_lines, ra)}  →  {text_of(b_lines, rb)}")
                i1, j1 = i1 + k, j1 + k
                tag = "delete" if i2 > i1 else "insert" if j2 > j1 else "equal"
            if tag == "delete":
                ra = rng(a, i1, i2)
                add("removed", ra, None, f"Removed {lines_word(ra)}", text_of(a_lines, ra))
            elif tag == "insert":
                rb = rng(b, j1, j2)
                add("added", None, rb, f"Added {lines_word(rb)}", text_of(b_lines, rb))

        counts = {t: sum(1 for d in diffs if d["type"] == t) for t in ("added", "removed", "modified")}
        return {
            "summary": {"total": len(diffs), **counts, "unchanged": unchanged},
            "differences": diffs,
        }
