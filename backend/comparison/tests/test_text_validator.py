import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from comparison.services.options import CompareOptions
from comparison.services.text_service import TextComparisonService, TextParseError
from comparison.services.xml_validator import ValidationInputError, XMLValidator

XSD = b"""<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="order">
    <xs:complexType><xs:sequence>
      <xs:element name="qty" type="xs:integer"/>
      <xs:element name="sku" type="xs:string"/>
    </xs:sequence></xs:complexType>
  </xs:element>
</xs:schema>"""


def up(name, content):
    return SimpleUploadedFile(name, content if isinstance(content, bytes) else content.encode())


# --- text ---------------------------------------------------------------------------
def test_text_diff_has_no_content_view():
    r = TextComparisonService().compare(b"a\nb\nc\n", b"a\nB\nc\nd\n", CompareOptions())
    assert r["content"] is None
    s = r["source"]["summary"]
    assert (s["modified"], s["added"], s["removed"]) == (1, 1, 0)


def test_text_ignore_whitespace_and_binary():
    svc = TextComparisonService()
    assert svc.compare(b"a  b\n", b" a b\n", CompareOptions(ignore_whitespace=True))["source"]["summary"]["total"] == 0
    assert svc.compare(b"a  b\n", b" a b\n", CompareOptions(ignore_whitespace=False))["source"]["summary"]["total"] == 1
    with pytest.raises(TextParseError):
        svc.compare(b"PK\x00\x03", b"x", CompareOptions(), original_name="a.zip")


def test_text_endpoint():
    r = APIClient().post("/api/compare/text/", {"original_file": up("a.txt", "x\n"),
                                                "modified_file": up("b.txt", "y\n")}, format="multipart")
    assert r.status_code == 200 and r.json()["content"] is None and r.json()["source"]["summary"]["modified"] == 1


# --- validator ------------------------------------------------------------------------
def test_well_formed_with_stats():
    r = XMLValidator().validate(b'<a xmlns="urn:x"><b id="1"><c/></b></a>')
    assert r["valid"] and r["well_formed"] and r["errors"] == []
    assert r["stats"]["root"] == "a" and r["stats"]["elements"] == 3 and r["stats"]["max_depth"] == 3
    assert r["stats"]["namespaces"] == ["urn:x"]


def test_syntax_errors_have_positions():
    r = XMLValidator().validate(b"<a>\n  <b>\n  </c>\n</a>")
    assert not r["valid"] and not r["well_formed"] and r["stats"] is None
    first = r["errors"][0]
    assert first["kind"] == "syntax" and first["line"] == 3 and first["id"] == 1
    assert r["summary"]["syntax"] == len(r["errors"]) >= 1


def test_schema_validation():
    v = XMLValidator()
    ok = v.validate(b"<order><qty>2</qty><sku>A</sku></order>", XSD)
    assert ok["valid"] and ok["schema"] == {"provided": True, "filename": "schema.xsd", "valid": True}
    bad = v.validate(b"<order>\n<qty>two</qty>\n<sku>A</sku></order>", XSD)
    assert bad["well_formed"] and not bad["valid"] and bad["schema"]["valid"] is False
    assert bad["summary"]["schema"] >= 1 and bad["errors"][0]["kind"] == "schema" and bad["errors"][0]["line"] == 2


def test_schema_must_be_valid_and_self_contained():
    v = XMLValidator()
    with pytest.raises(ValidationInputError):
        v.validate(b"<a/>", b"<not-a-schema/>", schema_name="s.xsd")
    with pytest.raises(ValidationInputError):
        v.validate(b"<a/>", b"<xs:schema xmlns:xs='http://www.w3.org/2001/XMLSchema'>"
                            b"<xs:include schemaLocation='file:///etc/passwd'/></xs:schema>")
    with pytest.raises(ValidationInputError):
        v.validate(b"<a/>", b"<oops", schema_name="s.xsd")


def test_xxe_is_not_resolved():
    evil = b'<?xml version="1.0"?><!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><a>&x;</a>'
    r = XMLValidator().validate(evil)
    assert "root:" not in r["text"].replace("&x;", "") and "root:" not in str(r["errors"])


def test_validate_endpoint():
    c = APIClient()
    r = c.post("/api/validate/xml/", {"xml_file": up("a.xml", "<a>")}, format="multipart")
    assert r.status_code == 200 and r.json()["valid"] is False and r.json()["errors"]
    r = c.post("/api/validate/xml/", {"xml_file": up("a.xml", "<order><qty>1</qty><sku>x</sku></order>"),
                                      "schema_file": up("s.xsd", XSD)}, format="multipart")
    assert r.json()["valid"] is True
    r = c.post("/api/validate/xml/", {"xml_file": up("a.xml", "<a/>"), "schema_file": up("s.xsd", "<x/>")},
               format="multipart")
    assert r.status_code == 400 and "s.xsd" in r.json()["error"]
    assert c.post("/api/validate/xml/", {}, format="multipart").status_code == 400
    assert c.post("/api/validate/json/", {}, format="multipart").status_code == 404
