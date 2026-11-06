from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient


def up(name, content):
    return SimpleUploadedFile(name, content.encode(), content_type="text/xml")


def test_compare_endpoint():
    r = APIClient().post("/api/compare/xml/", {
        "original_file": up("a.xml", "<a><b>1</b></a>"),
        "modified_file": up("b.xml", "<a><b>2</b></a>"),
        "ignore_comments": "true",
    }, format="multipart")
    assert r.status_code == 200
    d = r.json()
    assert d["original"]["filename"] == "a.xml"
    assert d["options"]["ignore_comments"] is True and d["options"]["ignore_whitespace"] is True
    assert d["content"]["summary"]["modified"] == 1
    assert d["source"]["summary"]["modified"] == 1


def test_invalid_xml_400():
    r = APIClient().post("/api/compare/xml/", {
        "original_file": up("a.xml", "<a>"), "modified_file": up("b.xml", "<a/>")}, format="multipart")
    assert r.status_code == 400 and "a.xml" in r.json()["error"]


def test_missing_file_and_unknown_format():
    c = APIClient()
    assert c.post("/api/compare/xml/", {}, format="multipart").status_code == 400
    assert c.post("/api/compare/csv/", {}, format="multipart").status_code == 404
