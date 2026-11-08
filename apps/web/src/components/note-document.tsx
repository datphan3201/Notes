"use client";
import { useEffect, useId, useRef } from "react";
import { NoteContentEditor } from "@/vendor/note-text/js/notes/note-content-editor.js";

export default function NoteDocument({
    value,
    onChange,
    readOnly = false,
    label,
}: {
    value: string;
    onChange: (value: string) => void;
    readOnly?: boolean;
    label: string;
}) {
    const textarea = useRef<HTMLTextAreaElement>(null);
    const editor = useRef<NoteContentEditor | null>(null);
    const onInput = useRef(onChange);
    const initial = useRef(value);
    const id = useId();
    onInput.current = onChange;
    useEffect(() => {
        const field = textarea.current!;
        const instance = new NoteContentEditor(field);
        instance.root.removeAttribute("aria-labelledby");
        instance.root.setAttribute("aria-label", label);
        editor.current = instance;
        // The retained engine emits native input on its canonical textarea.
        const input = () => onInput.current(field.value);
        field.addEventListener("input", input);
        return () => {
            field.removeEventListener("input", input);
            instance.frame.remove();
            field.hidden = false;
            editor.current = null;
        };
    }, []);
    useEffect(() => {
        editor.current?.setValue(value);
    }, [value]);
    useEffect(() => {
        editor.current?.setReadOnly(readOnly);
    }, [readOnly]);
    return (
        <div className="editor-body-field">
            <textarea
                id={id}
                ref={textarea}
                defaultValue={initial.current}
                aria-label={label}
            />
        </div>
    );
}
