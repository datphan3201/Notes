import { Extension } from "@tiptap/core";

export const NoteIndent = Extension.create({
    name: "noteIndent",
    addGlobalAttributes() {
        return [{
            types: ["paragraph", "heading"],
            attributes: {
                indent: {
                    default: 0,
                    parseHTML: element => Math.max(0, Math.min(8, Math.floor(Number(element.getAttribute("data-indent"))) || 0)),
                    renderHTML: attributes => attributes.indent
                        ? { "data-indent": attributes.indent, style: `margin-left: ${attributes.indent * 24}px` }
                        : {},
                },
            },
        }];
    },
    addKeyboardShortcuts() {
        const indent = (direction: number) => {
            const editor = this.editor;
            for (const item of ["taskItem", "listItem"]) {
                if (editor.isActive(item)) {
                    if (direction > 0) editor.commands.sinkListItem(item);
                    else editor.commands.liftListItem(item);
                    return true;
                }
            }
            return editor.commands.command(({ state, tr }) => {
                const { from, to, $from, $to } = state.selection;
                if (editor.isActive("codeBlock") && $from.sameParent($to)) {
                    const text = $from.parent.textContent;
                    const begin = $from.parentOffset === 0 ? 0 : text.lastIndexOf("\n", $from.parentOffset - 1) + 1;
                    const nextBreak = text.indexOf("\n", $to.parentOffset);
                    const end = nextBreak < 0 ? text.length : nextBreak;
                    const changed = text.slice(begin, end).split("\n").map(line =>
                        direction > 0 ? "\t" + line : line.replace(/^(\t| {1,4})/, ""),
                    ).join("\n");
                    tr.insertText(changed, $from.start() + begin, $from.start() + end);
                } else {
                    state.doc.nodesBetween(from, to, (node, pos) => {
                        if (["paragraph", "heading"].includes(node.type.name)) {
                            tr.setNodeMarkup(pos, undefined, {
                                ...node.attrs,
                                indent: Math.max(0, Math.min(8, (node.attrs.indent || 0) + direction)),
                            });
                        }
                    });
                }
                return true;
            });
        };
        return { Tab: () => indent(1), "Shift-Tab": () => indent(-1) };
    },
});
