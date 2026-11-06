"""XMLStructuralComparator: semantic comparison of two parsed documents.

Child matching strategy (per matched parent):
  1. same node kind/namespace/tag AND same stable identifier attribute
  2. identical subtrees (hash) of the same tag
  3. same tag, scored by structural similarity (attributes, text, children),
     preferring nearby positions; elements whose identifiers conflict never match
  4. a single remaining candidate of the same tag on each side is paired as a
     modification rather than reported as removed + added
Matched elements are then compared (attributes, text, order); unmatched
elements are reported once at the root of the added/removed subtree.
"""
from __future__ import annotations

import difflib
from bisect import bisect_left
from collections import defaultdict
from itertools import count

from .options import CompareOptions
from .parser import Node

MATCH_THRESHOLD = 0.40


def _ratio(a: str, b: str) -> float:
    if a == b:
        return 1.0
    if not a or not b:
        return 0.0
    return difflib.SequenceMatcher(None, a, b, autojunk=False).quick_ratio() * 0.5 + \
        difflib.SequenceMatcher(None, a, b, autojunk=False).ratio() * 0.5


def _jaccard(a, b) -> float:
    sa, sb = set(a), set(b)
    if not sa and not sb:
        return 1.0
    return len(sa & sb) / len(sa | sb)


def similarity(a: Node, b: Node) -> float:
    if a.hash == b.hash:
        return 1.0
    if a.kind == "comment":
        return _ratio(a.text, b.text)
    attrs = _jaccard(a.attrs.items(), b.attrs.items())
    text = _ratio(a.text, b.text)
    kids = 0.5 * _jaccard([c.hash for c in a.children], [c.hash for c in b.children]) + \
        0.5 * _jaccard([c.name for c in a.children], [c.name for c in b.children])
    return 0.3 * attrs + 0.3 * text + 0.4 * kids


def _lis_members(seq: list[int]) -> set[int]:
    """Indices (into seq) of one longest increasing subsequence."""
    tails: list[int] = []
    tails_idx: list[int] = []
    prev = [-1] * len(seq)
    for i, v in enumerate(seq):
        pos = bisect_left(tails, v)
        if pos == len(tails):
            tails.append(v)
            tails_idx.append(i)
        else:
            tails[pos] = v
            tails_idx[pos] = i
        prev[i] = tails_idx[pos - 1] if pos else -1
    out, k = set(), tails_idx[-1] if tails_idx else -1
    while k != -1:
        out.add(k)
        k = prev[k]
    return out


class XMLStructuralComparator:
    def compare(self, original: Node, modified: Node, options: CompareOptions) -> dict:
        self.o = options
        self._ids = count(1)
        self._node_ids = count(1)
        self.diffs: list[dict] = []
        self.unchanged = 0

        tree = self._compare_matched(original, modified, "")
        tree["name"], tree["path"] = "Document", "/"
        counts = {t: sum(1 for d in self.diffs if d["type"] == t) for t in ("added", "removed", "modified")}
        return {
            "summary": {"total": len(self.diffs), **counts, "unchanged": self.unchanged},
            "differences": self.diffs,
            "tree": tree,
        }

    # -- helpers -----------------------------------------------------------
    def _nid(self) -> str:
        return f"n{next(self._node_ids)}"

    def _record(self, node: dict, type_: str, kind: str, path: str, name: str, desc: str,
                ov=None, mv=None, oa=None, ma=None) -> int:
        did = next(self._ids)
        self.diffs.append({
            "id": did, "type": type_, "kind": kind, "path": path, "name": name,
            "original_value": ov, "modified_value": mv,
            "original_attributes": oa, "modified_attributes": ma,
            "description": desc, "node_id": node["id"],
        })
        node["difference_ids"].append(did)
        return did

    @staticmethod
    def _step(node: Node, siblings: list[Node], index_among_same: int, total_same: int) -> str:
        if node.kind == "comment":
            return f"comment(){'[%d]' % (index_among_same + 1) if total_same > 1 else ''}"
        ident = node.identity
        if ident and "=" in ident:
            k, v = ident.split("=", 1)
            return f"{node.name}[@{k}='{v}']"
        return f"{node.name}[{index_among_same + 1}]" if total_same > 1 else node.name

    def _steps(self, parent_path: str, nodes: list[Node], other: list[Node]) -> dict[int, str]:
        """Path step for each node (by id()), numbering repeated tags."""
        out: dict[int, str] = {}
        totals: dict = defaultdict(int)
        for n in nodes + other:
            totals[n.key] = max(totals[n.key], sum(1 for m in nodes if m.key == n.key),
                                sum(1 for m in other if m.key == n.key))
        seen: dict = defaultdict(int)
        for n in nodes:
            out[id(n)] = f"{parent_path}/{self._step(n, nodes, seen[n.key], totals[n.key])}"
            seen[n.key] += 1
        return out

    def _new_node(self, n: Node, status: str, path: str) -> dict:
        return {
            "id": self._nid(), "kind": n.kind, "name": n.name, "path": path, "status": status,
            "original_value": None, "modified_value": None,
            "original_attributes": None, "modified_attributes": None,
            "difference_ids": [], "has_changes": status != "unchanged", "children": [],
        }

    # -- subtree for added / removed elements --------------------------------
    def _whole(self, n: Node, status: str, path: str, top: bool) -> dict:
        d = self._new_node(n, status, path)
        side = "original" if status == "removed" else "modified"
        d[f"{side}_value"] = n.text or None
        d[f"{side}_attributes"] = dict(n.attrs) if n.kind == "element" else None
        steps = self._steps(path, n.children, [])
        d["children"] = [self._whole(c, status, steps[id(c)], False) for c in n.children]
        if top:
            size = self._size(n) - 1
            what = "Comment" if n.kind == "comment" else f"Element <{n.name}>"
            extra = f" with {size} nested node{'s' if size != 1 else ''}" if size else ""
            self._record(d, status, "element", path, n.name, f"{what} {status}{extra}",
                         ov=d["original_value"], mv=d["modified_value"],
                         oa=d["original_attributes"], ma=d["modified_attributes"])
        return d

    def _size(self, n: Node) -> int:
        return 1 + sum(self._size(c) for c in n.children)

    # -- matching ------------------------------------------------------------
    def _match(self, a: list[Node], b: list[Node]) -> dict[int, int]:
        pairs: dict[int, int] = {}
        used_b: set[int] = set()

        def take(i, j):
            pairs[i] = j
            used_b.add(j)

        # 1. identifiers
        for i, x in enumerate(a):
            if x.kind != "element" or not x.identity:
                continue
            cands = [j for j, y in enumerate(b) if j not in used_b and y.key == x.key and y.identity == x.identity]
            if cands:
                take(i, min(cands, key=lambda j: abs(j - i)))
        # 2. identical subtrees
        for i, x in enumerate(a):
            if i in pairs:
                continue
            cands = [j for j, y in enumerate(b) if j not in used_b and y.key == x.key and y.hash == x.hash]
            if cands:
                take(i, min(cands, key=lambda j: abs(j - i)))
        # 3/4. similarity, per tag
        groups = defaultdict(list)
        for i, x in enumerate(a):
            if i not in pairs:
                groups[x.key].append(i)
        for key, a_idx in groups.items():
            b_idx = [j for j, y in enumerate(b) if j not in used_b and y.key == key]
            if not b_idx:
                continue
            scored = []
            for i in a_idx:
                for j in b_idx:
                    x, y = a[i], b[j]
                    if x.identity and y.identity and x.identity != y.identity:
                        continue  # conflicting stable identifiers: different logical element
                    scored.append((similarity(x, y) - 0.001 * abs(i - j), i, j))
            scored.sort(reverse=True)
            done_a: set[int] = set()
            for score, i, j in scored:
                if i in done_a or j in used_b or score < MATCH_THRESHOLD:
                    continue
                take(i, j)
                done_a.add(i)
            rest_a = [i for i in a_idx if i not in pairs]
            rest_b = [j for j in b_idx if j not in used_b]
            if len(rest_a) == 1 and len(rest_b) == 1:
                x, y = a[rest_a[0]], b[rest_b[0]]
                if not (x.identity and y.identity and x.identity != y.identity):
                    take(rest_a[0], rest_b[0])
        return pairs

    # -- recursive comparison ------------------------------------------------
    def _compare_matched(self, a: Node, b: Node, path: str) -> dict:
        node = self._new_node(b, "unchanged", path or "/")
        node["has_changes"] = False
        own_changed = False

        if b.kind == "element":
            node["original_attributes"], node["modified_attributes"] = dict(a.attrs), dict(b.attrs)
            node["original_value"], node["modified_value"] = a.text or None, b.text or None
        else:
            node["original_value"], node["modified_value"] = a.text, b.text

        display_path = path or "/"
        # attributes
        attr_nodes = []
        for k in sorted(set(a.attrs) | set(b.attrs)):
            av, bv = a.attrs.get(k), b.attrs.get(k)
            if av == bv:
                continue
            status = "added" if av is None else "removed" if bv is None else "modified"
            child = {
                "id": self._nid(), "kind": "attribute", "name": f"@{k}", "path": f"{display_path}/@{k}",
                "status": status, "original_value": av, "modified_value": bv,
                "original_attributes": None, "modified_attributes": None,
                "difference_ids": [], "has_changes": True, "children": [],
            }
            desc = {"added": f"Attribute @{k} added: {bv!r}", "removed": f"Attribute @{k} removed (was {av!r})",
                    "modified": f"Attribute @{k}: {av!r} → {bv!r}"}[status]
            self._record(child, status, "attribute", child["path"], f"@{k}", desc, ov=av, mv=bv)
            attr_nodes.append(child)
            own_changed = True

        # text / comment content
        if a.text != b.text:
            own_changed = True
            if b.kind == "comment":
                self._record(node, "modified", "comment", display_path, b.name,
                             "Comment text changed", ov=a.text, mv=b.text)
            else:
                st = "added" if not a.text else "removed" if not b.text else "modified"
                p = display_path if st == "modified" else f"{display_path}/text()"
                desc = {"added": "Text content added", "removed": "Text content removed",
                        "modified": f"Text changed: {self._short(a.text)} → {self._short(b.text)}"}[st]
                self._record(node, st, "text", p, b.name, desc, ov=a.text or None, mv=b.text or None,
                             oa=dict(a.attrs), ma=dict(b.attrs))

        # children
        children, any_child_change = self._compare_children(a, b, display_path if path else "")
        if any_child_change:
            node["has_changes"] = True
        node["children"] = attr_nodes + children
        if own_changed:
            node["status"] = "modified"
            node["has_changes"] = True
        else:
            self.unchanged += 1 if b.name != "#document" else 0
        return node

    @staticmethod
    def _short(s: str, n: int = 60) -> str:
        s = s or ""
        return repr(s if len(s) <= n else s[: n - 1] + "…")

    def _compare_children(self, a: Node, b: Node, parent_path: str) -> tuple[list[dict], bool]:
        ac, bc = a.children, b.children
        pairs = self._match(ac, bc)
        b_steps = self._steps(parent_path, bc, ac)
        a_steps = self._steps(parent_path, ac, bc)
        rev = {j: i for i, j in pairs.items()}
        changed = False

        # ordering: matched pairs whose relative order differs
        moved_b: set[int] = set()
        if not self.o.ignore_order and pairs:
            a_sorted = sorted(pairs)                 # a indices in original order
            b_seq = [pairs[i] for i in a_sorted]     # their b indices
            keep = _lis_members(b_seq)
            moved_b = {b_seq[k] for k in range(len(b_seq)) if k not in keep}

        out_b: list[dict] = []
        for j, y in enumerate(bc):
            if j in rev:
                i = rev[j]
                child = self._compare_matched(ac[i], y, b_steps[id(y)])
                if j in moved_b:
                    child["status"] = "modified"
                    child["has_changes"] = True
                    self._record(child, "modified", "order", child["path"], y.name,
                                 f"Moved: position {i + 1} → {j + 1} among siblings",
                                 ov=f"position {i + 1}", mv=f"position {j + 1}")
                out_b.append(child)
            else:
                out_b.append(self._whole(y, "added", b_steps[id(y)], True))
            changed = changed or out_b[-1]["has_changes"]

        # place removed nodes right after the nearest preceding surviving sibling
        after: dict[int, list[dict]] = defaultdict(list)  # anchor b-index -> removed nodes
        for i, x in enumerate(ac):
            if i in pairs:
                continue
            anchor = next((pairs[p] for p in range(i - 1, -1, -1) if p in pairs), -1)
            after[anchor].append(self._whole(x, "removed", a_steps[id(x)], True))
            changed = True
        result = list(after.get(-1, []))
        for j, node in enumerate(out_b):
            result.append(node)
            result.extend(after.get(j, []))
        return result, changed
