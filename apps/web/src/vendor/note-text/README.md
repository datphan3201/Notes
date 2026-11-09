# Plain-text Note editor

The editor and behavior helpers originate from the retired PHP/JS frontend. The old `frontend/` source tree was removed in `8714dc0`; provenance can be inspected in Git history. These copied sources are now maintained here, with the translation helper using the shared baseline dictionary.

The active [NoteDocument](../../components/note-document.tsx) uses Tiptap with validated JSON and a derived plain-text representation. These historical sources remain for the existing plain-text helper consumers; they no longer mount the Notes editor. Legacy text is converted to safe JSON nodes without interpreting HTML. Shared Notes continue to use version conflicts/recovery rather than realtime co-editing.

See [current Notes documentation](../../../../../docs/ui/notes/README.md) and [interaction invariants](../../../../../docs/architecture/interactions.md) before changing behavior. There is no second runnable legacy baseline to synchronize fixes with.
