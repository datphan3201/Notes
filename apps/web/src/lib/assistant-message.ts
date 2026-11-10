import type { Kind } from "./api.ts";

export type InlineToken =
    | { type: "text"; value: string }
    | { type: "entity"; kind: string; id: string }
    | { type: "bold"; value: string }
    | { type: "italic"; value: string }
    | { type: "code"; value: string };

export type Block =
    | { type: "p"; content: string }
    | { type: "header"; level: number; content: string }
    | {
          type: "ol";
          items: { content: string; subItems: string[] }[];
      }
    | { type: "ul"; items: string[] };

export function normalizeKind(k: string): Kind {
    const raw = k.toLowerCase();
    if (raw === "area" || raw === "areas") return "areas";
    if (raw === "goal" || raw === "goals") return "goals";
    if (raw === "milestone" || raw === "milestones") return "milestones";
    if (raw === "task" || raw === "tasks") return "tasks";
    if (raw === "note" || raw === "notes") return "notes";
    if (raw === "habit" || raw === "habits") return "habits";
    return (raw.endsWith("s") ? raw : raw + "s") as Kind;
}

export function parseBlocks(text: string): Block[] {
    const lines = text.split(/\r?\n/);
    const blocks: Block[] = [];
    let currentOl: {
        type: "ol";
        items: { content: string; subItems: string[] }[];
    } | null = null;
    let currentUl: { type: "ul"; items: string[] } | null = null;
    let currentP: string[] | null = null;

    function flushP() {
        if (currentP) {
            blocks.push({ type: "p", content: currentP.join("\n") });
            currentP = null;
        }
    }
    function flushLists() {
        if (currentOl) {
            blocks.push(currentOl);
            currentOl = null;
        }
        if (currentUl) {
            blocks.push(currentUl);
            currentUl = null;
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) {
            flushP();
            flushLists();
            continue;
        }

        const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headerMatch) {
            flushP();
            flushLists();
            blocks.push({
                type: "header",
                level: headerMatch[1].length,
                content: headerMatch[2],
            });
            continue;
        }

        const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
        if (olMatch) {
            flushP();
            if (currentUl) {
                blocks.push(currentUl);
                currentUl = null;
            }
            if (!currentOl) {
                currentOl = { type: "ol", items: [] };
            }
            currentOl.items.push({
                content: olMatch[3],
                subItems: [],
            });
            continue;
        }

        const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
        if (ulMatch) {
            flushP();
            const indent = ulMatch[1].length;
            const content = ulMatch[2];

            if (currentOl && currentOl.items.length > 0 && (indent >= 2 || currentUl === null)) {
                currentOl.items[currentOl.items.length - 1].subItems.push(content);
                continue;
            }

            if (currentOl) {
                blocks.push(currentOl);
                currentOl = null;
            }
            if (!currentUl) {
                currentUl = { type: "ul", items: [] };
            }
            currentUl.items.push(content);
            continue;
        }

        if (currentOl || currentUl) {
            flushLists();
        }
        if (!currentP) {
            currentP = [];
        }
        currentP.push(line);
    }

    flushP();
    flushLists();
    return blocks;
}

export function tokenizeInline(text: string): InlineToken[] {
    const regex =
        /(\[(?:area|goal|milestone|task|note|habit|areas|goals|milestones|tasks|notes|habits):[a-zA-Z0-9_-]+\]|\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;

    const tokens: InlineToken[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            tokens.push({
                type: "text",
                value: text.slice(lastIndex, match.index),
            });
        }
        const m = match[0];
        if (m.startsWith("[") && m.includes(":")) {
            const inner = m.slice(1, -1);
            const [rawKind, id] = inner.split(":");
            tokens.push({ type: "entity", kind: rawKind, id });
        } else if (
            (m.startsWith("**") && m.endsWith("**")) ||
            (m.startsWith("__") && m.endsWith("__"))
        ) {
            tokens.push({ type: "bold", value: m.slice(2, -2) });
        } else if (m.startsWith("`") && m.endsWith("`")) {
            tokens.push({ type: "code", value: m.slice(1, -1) });
        } else if (
            (m.startsWith("*") && m.endsWith("*")) ||
            (m.startsWith("_") && m.endsWith("_"))
        ) {
            tokens.push({ type: "italic", value: m.slice(1, -1) });
        }
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
        tokens.push({ type: "text", value: text.slice(lastIndex) });
    }
    return tokens;
}
