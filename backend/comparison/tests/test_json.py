import json

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from comparison.services.json_parser import JSONParseError
from comparison.services.json_service import JSONComparisonService
from comparison.services.options import CompareOptions

svc = JSONComparisonService()


def run(a, b, **opts):
    return svc.compare(json.dumps(a).encode(), json.dumps(b).encode(), CompareOptions(**opts))["content"]


def kinds(c):
    return sorted((d["type"], d["path"]) for d in c["differences"])


def test_identical():
    c = run({"a": [1, {"b": 2}]}, {"a": [1, {"b": 2}]})
    assert c["summary"]["total"] == 0 and c["summary"]["unchanged"] == 2


def test_object_property_changes():
    c = run({"a": 1, "b": "x", "gone": True}, {"a": 2, "b": "x", "new": [1]})
    assert kinds(c) == [("added", "$.new"), ("modified", "$.a"), ("removed", "$.gone")]
    s = c["summary"]
    assert (s["added"], s["removed"], s["modified"]) == (1, 1, 1)


def test_key_order_is_ignored():
    assert run({"a": 1, "b": 2}, {"b": 2, "a": 1})["summary"]["total"] == 0


def test_type_change_and_null():
    c = run({"a": "1", "n": None}, {"a": 1, "n": 0})
    d = {x["path"]: x for x in c["differences"]}
    assert d["$.a"]["kind"] == "type" and "string → number" in d["$.a"]["description"]
    assert d["$.n"]["kind"] == "type"


def test_bool_is_not_number():
    assert run({"a": True}, {"a": 1})["differences"][0]["kind"] == "type"
    assert run({"a": 1}, {"a": 1.0})["summary"]["total"] == 0


def test_array_matched_by_id_and_moved():
    a = {"items": [{"id": 1, "v": "a"}, {"id": 2, "v": "b"}, {"id": 3, "v": "c"}]}
    b = {"items": [{"id": 3, "v": "c"}, {"id": 1, "v": "A"}, {"id": 2, "v": "b"}]}
    c = run(a, b)
    paths = {(d["kind"], d["path"]) for d in c["differences"]}
    assert ("value", "$.items[1].v") in paths
    assert any(k == "order" for k, _ in paths)
    assert not any(d["type"] in ("added", "removed") for d in c["differences"])
    assert run(a, b, ignore_order=True)["summary"]["total"] == 1


def test_array_add_remove_and_scalar_modify():
    c = run({"x": [1, 2, 3]}, {"x": [1, 2, 4, 5]})
    assert kinds(c) == [("added", "$.x[3]"), ("modified", "$.x[2]")]
    c = run({"x": ["a", "b", "c"]}, {"x": ["a", "c"]})
    assert kinds(c) == [("removed", "$.x[1]")]


def test_added_subtree_reported_once():
    c = run({}, {"a": {"b": {"c": [1, 2]}}})
    assert len(c["differences"]) == 1 and c["differences"][0]["path"] == "$.a"
    tree = c["tree"]["children"][0]
    assert tree["status"] == "added" and tree["children"][0]["children"][0]["children"][0]["status"] == "added"


def test_root_type_change_and_paths_with_odd_keys():
    assert run([1], {"a": 1})["differences"][0]["path"] == "$"
    c = run({"a b": 1}, {"a b": 2})
    assert c["differences"][0]["path"] == '$["a b"]'


def test_invalid_json():
    with pytest.raises(JSONParseError) as e:
        svc.compare(b'{"a": ', b"{}", CompareOptions(), original_name="a.json")
    assert "a.json" in e.value.message and e.value.line == 1


def test_source_diff_and_bom():
    r = svc.compare(b'\xef\xbb\xbf{\n "a": 1\n}\n', b'{\n "a": 2\n}\n', CompareOptions())
    assert r["source"]["summary"]["modified"] == 1 and r["original"]["text"].startswith("{")


def up(name, content):
    return SimpleUploadedFile(name, content.encode(), content_type="application/json")


def test_json_endpoint_and_errors():
    c = APIClient()
    r = c.post("/api/compare/json/", {"original_file": up("a.json", '{"a":1}'),
                                      "modified_file": up("b.json", '{"a":2}')}, format="multipart")
    assert r.status_code == 200 and r.json()["content"]["summary"]["modified"] == 1
    bad = c.post("/api/compare/json/", {"original_file": up("a.json", "{"),
                                        "modified_file": up("b.json", "{}")}, format="multipart")
    assert bad.status_code == 400 and "a.json" in bad.json()["error"] and bad.json()["line"] == 1
    assert "json" in c.get("/api/health/").json()["formats"]
