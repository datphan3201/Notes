"use client";
import type { ComponentProps } from "react";
import Dialog from "./dialog";

// The same editor content can live in the Notes dialog or inside a Task.
export default function NoteEditorFrame({ inline, ...props }: ComponentProps<typeof Dialog> & { inline: boolean }) {
    if (!inline) return <Dialog {...props} />;
    return <section className="task-note-editor review-note-modal" aria-label={props.title}>
        <header className="drawer-heading"><div>{props.heading}</div></header>
        {props.children}
    </section>;
}
