export class NoteContentEditor {
    constructor(textarea: HTMLTextAreaElement);
    frame: HTMLDivElement;
    root: HTMLDivElement;
    value: string;
    setValue(value: string, options?: { reset?: boolean }): void;
    setReadOnly(readOnly: boolean): void;
    focus(): void;
}
