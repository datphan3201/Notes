import pytest

from planner.note_document import document_text


def paragraph(text, **attrs):
    return {"type": "paragraph", "attrs": attrs, "content": [{"type": "text", "text": text}]}


def rich_document():
    return {"type": "doc", "content": [
        {"type": "heading", "attrs": {"level": 2, "indent": 0}, "content": [{"type": "text", "text": "Heading", "marks": [{"type": "bold"}, {"type": "highlight"}]}]},
        {"type": "taskList", "content": [{"type": "taskItem", "attrs": {"checked": True}, "content": [paragraph("Done"), {"type": "taskList", "content": [{"type": "taskItem", "attrs": {"checked": False}, "content": [paragraph("Nested")]}]}]}]},
        paragraph("Indented", indent=1),
        {"type": "codeBlock", "attrs": {"language": "javascript"}, "content": [{"type": "text", "text": "const x = 1;"}]},
    ]}


def test_rich_note_roundtrip_and_plain_edit_clears_formatting(client):
    document = rich_document()
    created = client.post("/api/v1/notes", json={"title": "Rich", "content": "ignored", "document": document})
    assert created.status_code == 201, created.text
    row = created.json()
    assert row["document"] == document
    assert row["content"] == "Heading\n- [x] Done\n- [ ] Nested\n\tIndented\nconst x = 1;"
    updated = client.patch(f'/api/v1/notes/{row["id"]}', json={"version": row["version"], "fields": {"title": "Renamed"}})
    assert updated.status_code == 200, updated.text
    assert updated.json()["document"] == document
    plain = client.patch(f'/api/v1/notes/{row["id"]}', json={"version": updated.json()["version"], "fields": {"content": "Plain replacement"}})
    assert plain.status_code == 200, plain.text
    assert plain.json()["content"] == "Plain replacement"
    assert plain.json()["document"] is None


@pytest.mark.parametrize("node", [
    {"type": "image", "attrs": {"src": "https://example.com"}},
    {"type": "heading", "attrs": {"level": 4}},
    paragraph("Bad", indent=9),
    {"type": "paragraph", "content": [{"type": "text", "text": "Bad", "marks": [{"type": "link", "attrs": {"href": "javascript:alert(1)"}}]}]},
])
def test_unsupported_formatting_is_rejected(client, node):
    response = client.post("/api/v1/notes", json={"title": "Bad", "document": {"type": "doc", "content": [node]}})
    assert response.status_code == 422, response.text


def test_supported_marks_and_safe_links():
    for mark in ["bold", "italic", "strike", "highlight", "code", "link"]:
        node = paragraph("Text")
        node["content"][0]["marks"] = [{"type": mark, **({"attrs": {"href": "https://example.com", "target": "_blank", "rel": "noopener noreferrer nofollow", "class": None}} if mark == "link" else {})}]
        assert document_text({"type": "doc", "content": [node]}) == "Text"


def test_rich_note_sharing_and_lock_mask(client, stranger):
    row = client.post("/api/v1/notes", json={"title": "Private", "document": rich_document()}).json()
    path = f'/api/v1/notes/{row["id"]}'
    assert stranger.get(path).status_code == 404
    assert client.post(path + "/invitations", json={"email": "other@example.com", "can_edit": True}).status_code == 201
    assert stranger.post(path + "/invitations/accept").status_code == 204
    doc = {"type": "doc", "content": [paragraph("Shared edit")]}
    result = stranger.patch(path, json={"version": row["version"], "fields": {"document": doc}})
    assert result.status_code == 200, result.text
    assert result.json()["content"] == "Shared edit"
    assert client.post(path + "/password", json={"new_password": "note-password"}).status_code == 200
    masked = stranger.get("/api/v1/workspace/snapshot").json()["notes"][0]
    assert "document" not in masked and masked["content"] == ""
