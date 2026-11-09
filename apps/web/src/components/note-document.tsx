"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Bold, Italic, Strikethrough, Highlighter, List, ListOrdered, ListTodo, Quote, Code, SquareCode, Link as LinkIcon } from "lucide-react";
import { documentText, textDocument, type RichNoteDocument } from "@/lib/note-document";
import { NoteIndent } from "@/lib/note-editor-indent";
import Dialog from "./dialog";
import "@/styles/note-editor.css";

export default function NoteDocument({ value, document, onChange, readOnly = false, label }: {
    value: string;
    document?: RichNoteDocument | null;
    onChange: (value: string, document: RichNoteDocument) => void;
    readOnly?: boolean;
    label: string;
}) {
    const onInput = useRef(onChange);
    onInput.current = onChange;
    const [linkOpen, setLinkOpen] = useState(false), [href, setHref] = useState(""), [linkError, setLinkError] = useState("");
    const [, setRevision] = useState(0);
    const locale = typeof window !== "undefined" ? window.document.documentElement.lang : "en";
    const text = (en: string, vi: string) => locale === "vi" ? vi : en;
    const editor: Editor | null = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                underline: false,
                horizontalRule: false,
                link: {
                    defaultProtocol: "https",
                    protocols: ["http", "https", "mailto"],
                    isAllowedUri: (url, context) => /^(https?:|mailto:)/i.test(url) && context.defaultValidate(url),
                },
            }),
            Highlight, TaskList, TaskItem.configure({ nested: true }), NoteIndent,
        ],
        content: document || textDocument(value),
        editable: !readOnly,
        editorProps: {
            attributes: {
                class: "note-content-editor rich-note-content",
                role: "textbox", "aria-label": label, "aria-multiline": "true",
                "data-note-content-editor": "",
            },
            handlePaste: (_view, event) => {
                if (!editor?.isEditable) return false;
                const plain = event.clipboardData?.getData("text/plain") || "";
                if (!event.clipboardData?.getData("text/html") && /^\s*- \[[ xX]\] /m.test(plain)) {
                    editor?.commands.insertContent(textDocument(plain).content || []);
                    return true;
                }
                return false;
            },
        },
        onUpdate: ({ editor }) => {
            const next = editor.getJSON();
            onInput.current(documentText(next), next);
        },
        onSelectionUpdate: () => setRevision(value => value + 1),
        onTransaction: () => setRevision(value => value + 1),
    });
    useEffect(() => {
        if (!editor || editor.isDestroyed) return;
        const next = document || textDocument(value);
        // Acknowledgements for our own draft must not reset the caret/history.
        if (document ? JSON.stringify(editor.getJSON()) === JSON.stringify(next) : documentText(editor.getJSON()) === value) return;
        const { from, to } = editor.state.selection;
        editor.commands.setContent(next, { emitUpdate: false });
        const end = editor.state.doc.content.size;
        editor.commands.setTextSelection({ from: Math.min(from, end), to: Math.min(to, end) });
    }, [value, document, editor]);
    useEffect(() => {
        editor?.setEditable(!readOnly, false);
        if (readOnly) setLinkOpen(false);
        if (editor) editor.view.dom.setAttribute("aria-readonly", String(readOnly));
    }, [readOnly, editor]);
    function button(name: string, icon: ReactNode, active: boolean, action: () => void) {
        return <button type="button" className="note-format-button" aria-label={name} title={name}
            aria-pressed={active} onMouseDown={event => event.preventDefault()} onClick={action}>{icon}</button>;
    }
    return (
        <div className="note-document rich-note-editor">
            {editor && !readOnly && <div className="note-document-toolbar rich-note-toolbar" role="toolbar" aria-label={text("Text formatting", "Định dạng văn bản")}>
                <select aria-label={text("Paragraph style", "Kiểu đoạn văn")}
                    value={editor.isActive("heading") ? String(editor.getAttributes("heading").level) : "paragraph"}
                    onChange={event => event.target.value === "paragraph" ? editor.chain().focus().setParagraph().run() : editor.chain().focus().setHeading({ level: Number(event.target.value) as 1 | 2 | 3 }).run()}>
                    <option value="paragraph">{text("Paragraph", "Văn bản")}</option>
                    {[1, 2, 3].map(level => <option key={level} value={level}>{text("Heading", "Tiêu đề")} {level}</option>)}
                </select>
                {button(text("Bold", "In đậm"), <Bold size={17} />, editor.isActive("bold"), () => editor.chain().focus().toggleBold().run())}
                {button(text("Italic", "In nghiêng"), <Italic size={17} />, editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run())}
                {button(text("Strikethrough", "Gạch ngang"), <Strikethrough size={17} />, editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run())}
                {button(text("Highlight", "Tô sáng"), <Highlighter size={17} />, editor.isActive("highlight"), () => editor.chain().focus().toggleHighlight().run())}
                {button(text("Bullet list", "Danh sách chấm"), <List size={17} />, editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run())}
                {button(text("Numbered list", "Danh sách đánh số"), <ListOrdered size={17} />, editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run())}
                {button(text("Check box", "Ô đánh dấu"), <ListTodo size={17} />, editor.isActive("taskList"), () => editor.chain().focus().toggleTaskList().run())}
                {button(text("Quote", "Trích dẫn"), <Quote size={17} />, editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run())}
                {button(text("Inline code", "Mã nội tuyến"), <Code size={17} />, editor.isActive("code"), () => editor.chain().focus().toggleCode().run())}
                {button(text("Code block", "Khối mã"), <SquareCode size={17} />, editor.isActive("codeBlock"), () => editor.chain().focus().toggleCodeBlock().run())}
                {button(text("Link", "Liên kết"), <LinkIcon size={17} />, editor.isActive("link"), () => {
                    setHref(editor.getAttributes("link").href || ""); setLinkError(""); setLinkOpen(true);
                })}
            </div>}
            <EditorContent editor={editor} />
            {linkOpen && editor && <Dialog title={text("Link", "Liên kết")} closeLabel={text("Close", "Đóng")}
                className="review-note-link-dialog" onClose={() => setLinkOpen(false)}>
                <form className="stack-form" onSubmit={event => {
                    event.preventDefault();
                    const url = href.trim().match(/^[a-z][a-z\d+.-]*:/i) ? href.trim() : "https://" + href.trim();
                    try {
                        const parsed = new URL(url);
                        if (!["http:", "https:", "mailto:"].includes(parsed.protocol) || url.length > 2048) throw new Error();
                        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
                        setLinkOpen(false);
                    } catch { setLinkError(text("Enter a valid http, https or mailto link.", "Nhập liên kết http, https hoặc mailto hợp lệ.")); }
                }}>
                    <label className="field">URL<input value={href} onChange={event => setHref(event.target.value)} required autoComplete="off" /></label>
                    {linkError && <p role="alert" className="field-error">{linkError}</p>}
                    <div className="action-row">
                        <button type="button" className="button button-quiet" onClick={() => { editor.chain().focus().extendMarkRange("link").unsetLink().run(); setLinkOpen(false); }}>{text("Remove link", "Bỏ liên kết")}</button>
                        <button type="submit" className="button button-primary">{text("Apply", "Áp dụng")}</button>
                    </div>
                </form>
            </Dialog>}
        </div>
    );
}
