# Plain-text Note editor

The editor and behavior helpers originate from the retired PHP/JS frontend. The old `frontend/` source tree was removed in `8714dc0`; provenance can be inspected in Git history. These copied sources are now maintained here, with the translation helper using the shared baseline dictionary.

[NoteDocument](../../components/note-document.tsx) owns the editor's React lifecycle through typed declarations. The mounted [Notes view](../../components/preview/notes.tsx) uses that wrapper. Preserve literal checkbox prefixes, selection, composition, paste and undo behavior. User HTML is not interpreted as markup. This editor does not activate realtime collaborative editing; shared Notes use version conflicts/recovery in the current runtime.

See [current Notes documentation](../../../../../docs/ui/notes/README.md) and [interaction invariants](../../../../../docs/architecture/interactions.md) before changing behavior. There is no second runnable legacy baseline to synchronize fixes with.
