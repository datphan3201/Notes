import { Check } from "lucide-react";
import { notePreview, type RichNoteDocument } from "@/lib/note-document";

export default function NotePreview({ content, document, checkedLabel, uncheckedLabel }: {
    content: string;
    document?: RichNoteDocument | null;
    checkedLabel: string;
    uncheckedLabel: string;
}) {
    const preview = notePreview(content, document);
    return (
        <div className="note-card-preview" data-preview-kind={preview.kind}>
            {preview.lines.map((line, index) => (
                <span key={index} className={preview.kind === "headings" ? "note-preview-heading" : "note-preview-line"} data-level={line.level}>
                    {preview.kind === "checkboxes" && (
                        <span className={`note-preview-box ${line.checked ? "is-checked" : ""}`} role="img"
                            aria-label={line.checked ? checkedLabel : uncheckedLabel}>
                            {line.checked && <Check size={11} aria-hidden="true" />}
                        </span>
                    )}
                    <span>{line.text}</span>
                </span>
            ))}
        </div>
    );
}
