export function noteLines(value: string): {
    raw: string;
    start: number;
    prefix: string;
    indent: string;
    text: string;
    checked: boolean | null;
}[];
