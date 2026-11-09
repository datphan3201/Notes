import test from "node:test";
import assert from "node:assert/strict";
import { documentText, notePreview, textDocument } from "../src/lib/note-document.ts";

test("preview scans the whole document and exclusively prioritizes headings", () => {
    const document = textDocument("normal ".repeat(100) + "\n- [x] checklist");
    document.content!.push({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Important" }] });
    assert.deepEqual(notePreview("", document), { kind: "headings", lines: [{ text: "Important", level: 2 }] });
});
test("checkbox preview excludes normal text and preserves checked state", () => {
    assert.deepEqual(notePreview("normal\n- [ ] Next\n- [x] Done\nending"), { kind: "checkboxes", lines: [{ text: "Next", checked: false }, { text: "Done", checked: true }] });
});
test("legacy text stays literal and plain preview is limited", () => {
    const text = '<script>alert("literal")</script>\nhello';
    assert.equal(documentText(textDocument(text)), text);
    assert.equal(notePreview("a".repeat(300)).lines[0].text.length, 200);
    assert.equal(notePreview("old", textDocument("")).lines[0].text, "");
});
test("nested checklist text and indentation remain searchable", () => {
    assert.equal(documentText({ type: "paragraph", attrs: { indent: 2 }, content: [{ type: "text", text: "Indented", marks: [{ type: "bold" }] }] }), "\t\tIndented");
    assert.equal(documentText(textDocument("- [x] Done\nplain")), "- [x] Done\nplain");
});
