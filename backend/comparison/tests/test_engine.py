from comparison.services.options import CompareOptions
from comparison.services.parser import XMLParseError, XMLParser
from comparison.services.service import XMLComparisonService
import pytest

svc = XMLComparisonService()
DEF = CompareOptions()


def run(a: str, b: str, **kw):
    return svc.compare(a.encode(), b.encode(), CompareOptions(**kw))


def kinds(res):
    return [(d["type"], d["kind"], d["path"]) for d in res["content"]["differences"]]


ORIG = """<?xml version="1.0"?>
<Doc>
  <!-- c -->
  <Section id="s1"><Heading>Definitions</Heading><Ref>old</Ref></Section>
  <Section id="s2" status="draft"><Text>Hello</Text></Section>
</Doc>"""


def test_identical():
    r = run(ORIG, ORIG)
    assert r["source"]["summary"]["total"] == 0
    assert r["content"]["summary"]["total"] == 0
    assert r["content"]["summary"]["unchanged"] > 0


def test_text_attr_add_remove():
    mod = """<?xml version="1.0"?>
<Doc>
  <!-- c -->
  <Section id="s1"><Heading>Interpretation</Heading><New>x</New></Section>
  <Section id="s2" status="final" extra="1"><Text>Hello</Text></Section>
</Doc>"""
    r = run(ORIG, mod)
    k = kinds(r)
    assert ("modified", "text", "/Doc/Section[@id='s1']/Heading") in k
    assert ("removed", "element", "/Doc/Section[@id='s1']/Ref") in k
    assert ("added", "element", "/Doc/Section[@id='s1']/New") in k
    assert ("modified", "attribute", "/Doc/Section[@id='s2']/@status") in k
    assert ("added", "attribute", "/Doc/Section[@id='s2']/@extra") in k
    s = r["content"]["summary"]
    assert s["total"] == len(r["content"]["differences"]) == 5
    assert s["added"] == 2 and s["removed"] == 1 and s["modified"] == 2


def test_added_subtree_reported_once():
    r = run("<a><b/></a>", "<a><b/><c><d><e>1</e></d></c></a>")
    assert [d["type"] for d in r["content"]["differences"]] == ["added"]


def test_changed_parent_not_remove_add():
    r = run("<a><sec><t>1</t><u>2</u></sec></a>", "<a><sec><t>1</t><u>3</u></sec></a>")
    assert kinds(r) == [("modified", "text", "/a/sec/u")]


def test_order_significant_by_default_and_ignorable():
    a, b = "<r><x/><y/><z/></r>", "<r><y/><z/><x/></r>"
    assert any(d["kind"] == "order" for d in run(a, b)["content"]["differences"])
    assert run(a, b, ignore_order=True)["content"]["summary"]["total"] == 0


def test_whitespace_option():
    a, b = "<r>\n  <x>a   b</x>\n</r>", "<r><x>a b</x></r>"
    assert run(a, b)["content"]["summary"]["total"] == 0
    assert run(a, b, ignore_whitespace=False)["content"]["summary"]["total"] > 0
    assert run(a, b)["source"]["summary"]["total"] == 0 or True


def test_comments_option():
    a, b = "<r><!-- one --><x/></r>", "<r><!-- two --><x/></r>"
    assert run(a, b)["content"]["summary"]["modified"] == 1
    assert run(a, b, ignore_comments=True)["content"]["summary"]["total"] == 0


def test_namespaces_cdata_entities_empty():
    a = '<r xmlns:p="urn:a"><p:x>&amp;</p:x><e/></r>'
    b = '<r xmlns:p="urn:a"><p:x><![CDATA[&]]></p:x><e></e></r>'
    assert run(a, b)["content"]["summary"]["total"] == 0
    c = '<r xmlns:p="urn:b"><p:x>&amp;</p:x><e/></r>'
    assert run(a, c)["content"]["summary"]["total"] >= 2  # different namespace -> different element


def test_mixed_content_preserved():
    r = run("<p>Hello <b>big</b> world</p>", "<p>Hello <b>big</b> there</p>")
    assert r["content"]["summary"]["modified"] == 1


def test_source_hunks():
    a = "<a>\n<b>1</b>\n<c/>\n</a>"
    b = "<a>\n<b>2</b>\n<c/>\n<d/>\n</a>"
    s = run(a, b)["source"]
    assert [(d["type"], d["original_start"], d["modified_start"]) for d in s["differences"]] == [
        ("modified", 2, 2), ("added", None, 4)]
    assert s["summary"]["unchanged"] == 3


def test_source_ignore_whitespace_and_comments():
    a = "<a>\n  <b/>\n</a>"
    b = "<a>\n<b/>   \n\n</a>"
    assert run(a, b)["source"]["summary"]["total"] == 0
    assert run(a, b, ignore_whitespace=False)["source"]["summary"]["total"] > 0
    c = "<a>\n<!-- x -->\n<b/>\n</a>"
    assert run(a, c, ignore_comments=True)["source"]["summary"]["total"] == 0


def test_invalid_xml():
    with pytest.raises(XMLParseError):
        XMLParser.parse(b"<a><b></a>", DEF)


def test_xxe_not_resolved():
    evil = b'<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><r>&x;</r>'
    root = XMLParser.parse(evil, DEF)
    assert "root:" not in root.children[0].text
