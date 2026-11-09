import type { JSONContent } from "@tiptap/core";

export type RichNoteDocument = JSONContent;

export function documentText(node: JSONContent): string {
    if (node.type === "text") return node.text || "";
    if (node.type === "hardBreak") return "\n";
    const inline = ["paragraph", "heading", "codeBlock"].includes(node.type || "");
    let text = (node.content || []).map(documentText).join(inline ? "" : "\n");
    if (node.type === "taskItem") text = `- [${node.attrs?.checked ? "x" : " "}] ${text}`;
    return "\t".repeat(node.attrs?.indent || 0) + text;
}

// Legacy text is never parsed as HTML; only existing checkbox prefixes become nodes.
export function textDocument(value: string): JSONContent {
    const blocks: JSONContent[] = [];
    for (const line of value.split("\n")) {
        const match = /^(\s*)- \[([ xX])\] (.*)$/.exec(line);
        const text = match ? match[3] : line;
        const paragraph: JSONContent = {
            type: "paragraph",
            content: text ? [{ type: "text", text }] : [],
        };
        if (match) {
            let list = blocks.at(-1);
            if (list?.type !== "taskList") {
                list = { type: "taskList", content: [] };
                blocks.push(list);
            }
            list.content!.push({ type: "taskItem", attrs: { checked: match[2] !== " " }, content: [paragraph] });
            // Keep pre-existing indentation as literal text when opening older Notes.
            if (match[1]) paragraph.content!.unshift({ type: "text", text: match[1] });
        } else blocks.push(paragraph);
    }
    return { type: "doc", content: blocks };
}

export type NotePreview = {
    kind: "headings" | "checkboxes" | "text";
    truncated?: boolean;
    lines: { text: string; level?: number; checked?: boolean }[];
};

export function notePreview(content: string, document?: JSONContent | null): NotePreview {
    const root = document || textDocument(content);
    const headings: NotePreview["lines"] = [], checkboxes: NotePreview["lines"] = [];
    function visit(node: JSONContent) {
        if (node.type === "heading") {
            const text = documentText(node).trim();
            if (text) headings.push({ text, level: node.attrs?.level || 1 });
        }
        if (node.type === "taskItem") {
            const text = documentText(node.content?.[0] || {}).trim();
            if (text) checkboxes.push({ text, checked: !!node.attrs?.checked });
        }
        for (const child of node.content || []) visit(child);
    }
    visit(root);
    if (headings.length) return { kind: "headings", lines: headings.slice(0, 3), ...(headings.length > 3 ? { truncated: true } : {}) };
    if (checkboxes.length) return { kind: "checkboxes", lines: checkboxes.slice(0, 3), ...(checkboxes.length > 3 ? { truncated: true } : {}) };
    const text = documentText(root);
    return { kind: "text", lines: [{ text: text.slice(0, 200) }], ...(text.length > 200 ? { truncated: true } : {}) };
}
