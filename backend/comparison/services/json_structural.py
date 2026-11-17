"""JSONStructuralComparator: semantic comparison of two parsed JSON values.

* Objects are unordered: properties are matched by name.
* Arrays: items are matched by a stable identifier property (id, name, key, ...), then by
  identical content, then by similarity; a single leftover pair of the same type is paired as a
  modification. Unless `ignore_order` is on, matched items that changed relative position are
  reported as moved.
* Added/removed values are reported once at the root of the added/removed subtree.
* Paths are JSONPath-like: `$.products[2].price`.
"""
from __future__ import annotations

import difflib
import json
import re
from collections import defaultdict
from itertools import count
from typing import Any

from .options import CompareOptions
from .structural import _lis_members

ID_KEYS = ("id", "uuid", "key", "name", "code", "ref")
MATCH_THRESHOLD = 0.40
_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def jtype(v: Any) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, (int, float)):
        return "number"
    if isinstance(v, str):
        return "string"
    if isinstance(v, list):
        return "array"
    return "object"


def dumps(v: Any) -> str:
    return json.dumps(v, ensure_ascii=False)


def short(v: Any, n: int = 60) -> str:
    """Compact preview of any value."""
    t = jtype(v)
    if t == "object":
        return f"{{{len(v)} propert{'y' if len(v) == 1 else 'ies'}}}"
    if t == "array":
        return f"[{len(v)} item{'' if len(v) == 1 else 's'}]"
    s = dumps(v)
    return s if len(s) <= n else s[: n - 1] + "…"


def path_key(parent: str, key: str) -> str:
    return f"{parent}.{key}" if _IDENT.match(key) else f"{parent}[{dumps(key)}]"


class JSONStructuralComparator:
    def compare(self, original: Any, modified: Any, options: CompareOptions) -> dict:
        self.o = options
        self._ids = count(1)
        self._nids = count(1)
        self.diffs: list[dict] = []
        self.unchanged = 0
        self._h: dict[int, str] = {}

        tree = self._compare(original, modified, "$", "$")
        counts = {t: sum(1 for d in self.diffs if d["type"] == t) for t in ("added", "removed", "modified")}
        return {
            "summary": {"total": len(self.diffs), **counts, "unchanged": self.unchanged},
            "differences": self.diffs,
            "tree": tree,
        }

    # -- hashing ---------------------------------------------------------------
    def _hash(self, v: Any) -> str:
        """Canonical text of a value (object key order never matters; array order only when significant)."""
        if isinstance(v, (dict, list)):
            cached = self._h.get(id(v))
            if cached is not None:
                return cached
            if isinstance(v, dict):
                out = "{" + ",".join(f"{dumps(k)}:{self._hash(v[k])}" for k in sorted(v)) + "}"
            else:
                items = [self._hash(x) for x in v]
                if self.o.ignore_order:
                    items.sort()
                out = "[" + ",".join(items) + "]"
            self._h[id(v)] = out
            return out
        return f"{jtype(v)}:{dumps(v)}"

    # -- tree nodes ---------------------------------------------------------------
    def _node(self, key: str, path: str, status: str, a: Any = None, b: Any = None,
              has_a: bool = False, has_b: bool = False) -> dict:
        def scalar(v):
            return None if isinstance(v, (dict, list)) else dumps(v)
        return {
            "id": f"n{next(self._nids)}", "key": key, "path": path, "status": status,
            "original_type": jtype(a) if has_a else None, "modified_type": jtype(b) if has_b else None,
            "original_value": scalar(a) if has_a else None, "modified_value": scalar(b) if has_b else None,
            "original_count": len(a) if has_a and isinstance(a, (dict, list)) else None,
            "modified_count": len(b) if has_b and isinstance(b, (dict, list)) else None,
            "difference_ids": [], "has_changes": status != "unchanged", "children": [],
        }

    def _record(self, node: dict, type_: str, kind: str, path: str, name: str, desc: str,
                ov: str | None = None, mv: str | None = None) -> None:
        did = next(self._ids)
        self.diffs.append({
            "id": did, "type": type_, "kind": kind, "path": path, "name": name,
            "original_value": ov, "modified_value": mv, "description": desc, "node_id": node["id"],
        })
        node["difference_ids"].append(did)

    def _whole(self, key: str, path: str, v: Any, status: str, record: bool, kind: str, label: str) -> dict:
        """A value present on one side only."""
        added = status == "added"
        node = self._node(key, path, status, a=v, b=v, has_a=not added, has_b=added)
        if isinstance(v, dict):
            node["children"] = [self._whole(k, path_key(path, k), x, status, False, kind, label) for k, x in v.items()]
        elif isinstance(v, list):
            node["children"] = [self._whole(f"[{i}]", f"{path}[{i}]", x, status, False, kind, label)
                                for i, x in enumerate(v)]
        if record:
            self._record(node, status, kind, path, key, f"{label} {status}: {short(v)}",
                         ov=None if added else short(v), mv=short(v) if added else None)
        return node

    # -- comparison ----------------------------------------------------------------
    def _compare(self, a: Any, b: Any, key: str, path: str) -> dict:
        ta, tb = jtype(a), jtype(b)
        if ta != tb:
            node = self._node(key, path, "modified", a, b, True, True)
            self._record(node, "modified", "type", path, key,
                         f"Type changed: {ta} → {tb} ({short(a)} → {short(b)})", short(a), short(b))
            old = self._whole(key, path, a, "removed", False, "", "")["children"]
            new = self._whole(key, path, b, "added", False, "", "")["children"]
            node["children"] = old + new
            return node

        if ta == "object":
            return self._compare_objects(a, b, key, path)
        if ta == "array":
            return self._compare_arrays(a, b, key, path)

        node = self._node(key, path, "unchanged", a, b, True, True)
        if a != b:
            node["status"], node["has_changes"] = "modified", True
            self._record(node, "modified", "value", path, key, f"Value changed: {short(a)} → {short(b)}",
                         dumps(a), dumps(b))
        else:
            self.unchanged += 1
        return node

    def _compare_objects(self, a: dict, b: dict, key: str, path: str) -> dict:
        node = self._node(key, path, "unchanged", a, b, True, True)
        kids: list[dict] = []
        changed = False
        removed = [k for k in a if k not in b]
        # removed properties go right after the nearest preceding surviving key of the original
        after: dict[str | None, list[str]] = defaultdict(list)
        keys_a = list(a)
        for k in removed:
            i = keys_a.index(k)
            anchor = next((x for x in reversed(keys_a[:i]) if x in b), None)
            after[anchor].append(k)

        def emit_removed(anchor):
            nonlocal changed
            for k in after.get(anchor, []):
                kids.append(self._whole(k, path_key(path, k), a[k], "removed", True, "property", "Property"))
                changed = True

        emit_removed(None)
        for k, bv in b.items():
            p = path_key(path, k)
            if k in a:
                child = self._compare(a[k], bv, k, p)
            else:
                child = self._whole(k, p, bv, "added", True, "property", "Property")
            changed = changed or child["has_changes"]
            kids.append(child)
            emit_removed(k)
        node["children"], node["has_changes"] = kids, changed
        if changed:
            node["status"] = "modified"
        return node

    # -- arrays -----------------------------------------------------------------------
    def _identity(self, v: Any) -> tuple[str, str] | None:
        if isinstance(v, dict):
            for k in ID_KEYS:
                x = v.get(k)
                if isinstance(x, (str, int)) and not isinstance(x, bool):
                    return (k, dumps(x))
        return None

    def _similarity(self, x: Any, y: Any) -> float:
        tx, ty = jtype(x), jtype(y)
        if tx != ty:
            return 0.0
        if self._hash(x) == self._hash(y):
            return 1.0
        if tx == "string":
            return difflib.SequenceMatcher(None, x, y, autojunk=False).ratio()
        if tx == "object":
            ka, kb = set(x), set(y)
            keys = len(ka & kb) / len(ka | kb) if ka | kb else 1.0
            ia = {(k, self._hash(v)) for k, v in x.items()}
            ib = {(k, self._hash(v)) for k, v in y.items()}
            vals = len(ia & ib) / len(ia | ib) if ia | ib else 1.0
            return 0.4 * keys + 0.6 * vals
        if tx == "array":
            ha, hb = [self._hash(i) for i in x], [self._hash(i) for i in y]
            return difflib.SequenceMatcher(None, ha, hb, autojunk=False).ratio()
        return 0.0

    def _match(self, a: list, b: list) -> dict[int, int]:
        pairs: dict[int, int] = {}
        used: set[int] = set()

        def take(i, j):
            pairs[i] = j
            used.add(j)

        ids_b = defaultdict(list)
        for j, y in enumerate(b):
            ident = self._identity(y)
            if ident:
                ids_b[ident].append(j)
        for i, x in enumerate(a):  # 1. stable identifiers
            ident = self._identity(x)
            cands = [j for j in ids_b.get(ident, []) if j not in used] if ident else []
            if cands:
                take(i, min(cands, key=lambda j: abs(j - i)))
        hb = [self._hash(y) for y in b]
        for i, x in enumerate(a):  # 2. identical content
            if i in pairs:
                continue
            hx = self._hash(x)
            cands = [j for j in range(len(b)) if j not in used and hb[j] == hx]
            if cands:
                take(i, min(cands, key=lambda j: abs(j - i)))
        rest_a = [i for i in range(len(a)) if i not in pairs]
        rest_b = [j for j in range(len(b)) if j not in used]
        scored = sorted(
            ((self._similarity(a[i], b[j]) - 0.001 * abs(i - j), i, j)
             for i in rest_a for j in rest_b
             if not (self._identity(a[i]) and self._identity(b[j]) and self._identity(a[i]) != self._identity(b[j]))),
            reverse=True,
        )
        done: set[int] = set()
        for score, i, j in scored:  # 3. similarity
            if i in done or j in used or score < MATCH_THRESHOLD:
                continue
            take(i, j)
            done.add(i)
        left_a = [i for i in rest_a if i not in pairs]
        left_b = [j for j in rest_b if j not in used]
        if left_a and left_b:  # 4. leftover same-type items pair up in order (scalars: [1,2,3] -> [1,2,4])
            by_type_b = defaultdict(list)
            for j in left_b:
                by_type_b[jtype(b[j])].append(j)
            for i in left_a:
                t = jtype(a[i])
                ident_a = self._identity(a[i])
                for j in list(by_type_b.get(t, [])):
                    ident_b = self._identity(b[j])
                    if ident_a and ident_b and ident_a != ident_b:
                        continue
                    take(i, j)
                    by_type_b[t].remove(j)
                    break
        return pairs

    def _compare_arrays(self, a: list, b: list, key: str, path: str) -> dict:
        node = self._node(key, path, "unchanged", a, b, True, True)
        pairs = self._match(a, b)
        rev = {j: i for i, j in pairs.items()}
        moved: set[int] = set()
        if not self.o.ignore_order and pairs:
            a_sorted = sorted(pairs)
            seq = [pairs[i] for i in a_sorted]
            keep = _lis_members(seq)
            moved = {seq[k] for k in range(len(seq)) if k not in keep}

        out: list[dict] = []
        changed = False
        for j, y in enumerate(b):
            p = f"{path}[{j}]"
            if j in rev:
                i = rev[j]
                child = self._compare(a[i], y, f"[{j}]", p)
                if j in moved:
                    child["status"], child["has_changes"] = "modified", True
                    self._record(child, "modified", "order", p, f"[{j}]",
                                 f"Moved: position {i} → {j}", f"position {i}", f"position {j}")
            else:
                child = self._whole(f"[{j}]", p, y, "added", True, "item", "Item")
            changed = changed or child["has_changes"]
            out.append(child)

        after: dict[int, list[dict]] = defaultdict(list)
        for i, x in enumerate(a):
            if i in pairs:
                continue
            anchor = next((pairs[q] for q in range(i - 1, -1, -1) if q in pairs), -1)
            after[anchor].append(self._whole(f"[{i}]", f"{path}[{i}]", x, "removed", True, "item", "Item"))
            changed = True
        result = list(after.get(-1, []))
        for j, n in enumerate(out):
            result.append(n)
            result.extend(after.get(j, []))
        node["children"], node["has_changes"] = result, changed
        if changed:
            node["status"] = "modified"
        return node
