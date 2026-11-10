"use client";

import React, { type ReactNode } from "react";
import {
    CheckSquare,
    Compass,
    FileText,
    Flag,
    Flame,
    Folder,
    Target,
} from "lucide-react";
import type { Kind, Run } from "@/lib/api";
import type { Text } from "./preview/shared";
import {
    normalizeKind,
    parseBlocks,
    tokenizeInline,
    type Block,
    type InlineToken,
} from "@/lib/assistant-message";

interface Props {
    content: string;
    proposal?: Run["proposal"];
    db?: any;
    live?: any;
    text: Text;
}

export function AssistantEntityChip({
    kind,
    id,
    proposal,
    db,
    live,
    text,
}: {
    kind: string;
    id: string;
    proposal?: Run["proposal"];
    db?: any;
    live?: any;
    text: Text;
}) {
    const normKind = normalizeKind(kind);

    const kindConfig: Record<
        Kind,
        {
            icon: typeof CheckSquare;
            label: [string, string];
        }
    > = {
        tasks: { icon: CheckSquare, label: ["Task", "Công việc"] },
        milestones: { icon: Flag, label: ["Milestone", "Cột mốc"] },
        goals: { icon: Target, label: ["Goal", "Mục tiêu"] },
        areas: { icon: Folder, label: ["Area", "Khu vực"] },
        notes: { icon: FileText, label: ["Note", "Ghi chú"] },
        habits: { icon: Flame, label: ["Habit", "Thói quen"] },
        reviews: { icon: Compass, label: ["Review", "Đánh giá"] },
        "task-series": { icon: CheckSquare, label: ["Series", "Chuỗi lặp"] },
    };

    const config = kindConfig[normKind] || {
        icon: Compass,
        label: [normKind, normKind],
    };
    const Icon = config.icon;
    const kindLabel = text(...config.label);

    // 1. Proposed reference (e.g. "c1", "c2", "c3"...)
    if (id.startsWith("c") && /^\d+$/.test(id.slice(1))) {
        const created = proposal?.operations.find(
            (op) => op.ref === id && normalizeKind(op.kind) === normKind,
        );
        const opTitle = created
            ? String(created.fields.title || kindLabel)
            : `${kindLabel} #${id}`;

        return (
            <span
                className="assistant-entity-chip is-proposal"
                data-kind={normKind}
                title={`${kindLabel} #${id}${created?.fields?.title ? `: ${created.fields.title}` : ""}`}
            >
                <Icon size={11} aria-hidden="true" />
                <span>
                    {kindLabel} #{id}
                </span>
            </span>
        );
    }

    // 2. Existing entity in db
    let resolvedTitle = "";
    let serverMatch: any = null;

    if (db) {
        const rows =
            normKind === "task-series" ? db.series : db[normKind] || [];
        serverMatch = rows.find((r: any) =>
            live ? live.serverId(r.id) === id || String(r.id) === id : String(r.id) === id,
        );
        if (serverMatch) {
            const raw = serverMatch.title || serverMatch.name || "";
            resolvedTitle = Array.isArray(raw) ? text(raw[0], raw[1]) : String(raw);
        }
    }

    const handleClick = () => {
        if (!db?.navigate) return;
        if (normKind === "areas") {
            db.navigate("goals", { area: id });
        } else if (normKind === "notes") {
            db.navigate("notes", { note: id });
        } else if (normKind === "goals") {
            db.navigate("goals", { goal: id });
        } else if (normKind === "milestones") {
            const parentGoal = serverMatch?.goal;
            db.navigate("goals", { goal: parentGoal, milestone: id });
        } else if (normKind === "tasks") {
            db.navigate("tasks", { task: serverMatch?.id || id });
        } else {
            db.navigate(normKind);
        }
    };

    const displayText = resolvedTitle || kindLabel;

    if (db?.navigate) {
        return (
            <button
                type="button"
                className="assistant-entity-chip is-clickable"
                data-kind={normKind}
                title={`${kindLabel}: ${resolvedTitle || id}`}
                onClick={handleClick}
            >
                <Icon size={11} aria-hidden="true" />
                <span>{displayText}</span>
            </button>
        );
    }

    return (
        <span
            className="assistant-entity-chip"
            data-kind={normKind}
            title={`${kindLabel}: ${resolvedTitle || id}`}
        >
            <Icon size={11} aria-hidden="true" />
            <span>{displayText}</span>
        </span>
    );
}

function renderInlineContent(
    textStr: string,
    proposal?: Run["proposal"],
    db?: any,
    live?: any,
    text?: Text,
): ReactNode[] {
    const tokens = tokenizeInline(textStr);
    return tokens.map((token, i) => {
        if (token.type === "text") {
            return <React.Fragment key={i}>{token.value}</React.Fragment>;
        }
        if (token.type === "entity") {
            return (
                <AssistantEntityChip
                    key={i}
                    kind={token.kind}
                    id={token.id}
                    proposal={proposal}
                    db={db}
                    live={live}
                    text={text || ((en, vi) => vi || en)}
                />
            );
        }
        if (token.type === "bold") {
            return (
                <strong key={i}>
                    {renderInlineContent(token.value, proposal, db, live, text)}
                </strong>
            );
        }
        if (token.type === "italic") {
            return (
                <em key={i}>
                    {renderInlineContent(token.value, proposal, db, live, text)}
                </em>
            );
        }
        if (token.type === "code") {
            return <code key={i}>{token.value}</code>;
        }
        return null;
    });
}

export function AssistantCompiledMessage({
    content,
    proposal,
    db,
    live,
    text,
}: Props) {
    if (!content) return null;
    const blocks = parseBlocks(content);

    return (
        <div className="assistant-compiled-content">
            {blocks.map((block, index) => {
                if (block.type === "header") {
                    const HeadingTag =
                        block.level === 1
                            ? "h3"
                            : block.level === 2
                              ? "h4"
                              : "h5";
                    return (
                        <HeadingTag key={index}>
                            {renderInlineContent(
                                block.content,
                                proposal,
                                db,
                                live,
                                text,
                            )}
                        </HeadingTag>
                    );
                }

                if (block.type === "ol") {
                    return (
                        <ol key={index} className="assistant-message-ol">
                            {block.items.map((item, itemIdx) => (
                                <li key={itemIdx}>
                                    <div className="assistant-ol-item-head">
                                        {renderInlineContent(
                                            item.content,
                                            proposal,
                                            db,
                                            live,
                                            text,
                                        )}
                                    </div>
                                    {item.subItems.length > 0 && (
                                        <ul className="assistant-message-ul">
                                            {item.subItems.map(
                                                (sub, subIdx) => (
                                                    <li key={subIdx}>
                                                        {renderInlineContent(
                                                            sub,
                                                            proposal,
                                                            db,
                                                            live,
                                                            text,
                                                        )}
                                                    </li>
                                                ),
                                            )}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ol>
                    );
                }

                if (block.type === "ul") {
                    return (
                        <ul key={index} className="assistant-message-ul">
                            {block.items.map((item, itemIdx) => (
                                <li key={itemIdx}>
                                    {renderInlineContent(
                                        item,
                                        proposal,
                                        db,
                                        live,
                                        text,
                                    )}
                                </li>
                            ))}
                        </ul>
                    );
                }

                return (
                    <p key={index}>
                        {renderInlineContent(
                            block.content,
                            proposal,
                            db,
                            live,
                            text,
                        )}
                    </p>
                );
            })}
        </div>
    );
}

export default AssistantCompiledMessage;
