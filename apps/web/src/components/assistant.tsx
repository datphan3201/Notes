"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Compass, Sparkles } from "lucide-react";
import { api, type Identity, type Run } from "@/lib/api";
import type { Words } from "@/lib/i18n";
import Dialog from "./dialog";
import { AssistantCompiledMessage } from "./assistant-compiled-message";

export default function Assistant({
    identity,
    t,
    onClose,
    onApplied,
}: {
    identity: Identity;
    t: Words;
    onClose: () => void;
    onApplied: () => void;
}) {
    const [prompt, setPrompt] = useState("");
    const [run, setRun] = useState<Run | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const stream = useRef<EventSource | null>(null);
    useEffect(() => () => stream.current?.close(), []);
    async function ask(event: React.FormEvent) {
        event.preventDefault();
        setBusy(true);
        setError("");
        setRun(null);
        stream.current?.close();
        try {
            const created = await api<{ id: string }>(
                "/assistant/runs",
                { method: "POST", body: JSON.stringify({ prompt }) },
                identity.csrf,
            );
            const source = new EventSource(
                `/api/v1/assistant/runs/${created.id}/events`,
            );
            stream.current = source;
            source.onmessage = (event) => {
                const current = JSON.parse(event.data) as Run;
                setRun(current);
                if (["completed", "failed"].includes(current.status)) {
                    source.close();
                    setBusy(false);
                    if (current.status === "failed")
                        setError(
                            "The assistant could not finish this request. Try again later.",
                        );
                }
            };
            source.onerror = () => {
                source.close();
                setBusy(false);
                setError(
                    "Connection interrupted. Your request continues in the background.",
                );
            };
        } catch (err) {
            setError((err as Error).message);
            setBusy(false);
        }
    }
    async function apply() {
        if (!run) return;
        setBusy(true);
        setError("");
        try {
            const next = await api<Run>(
                `/assistant/runs/${run.id}/apply`,
                {
                    method: "POST",
                    body: JSON.stringify({ proposal_hash: run.proposal_hash }),
                },
                identity.csrf,
            );
            setRun(next);
            onApplied();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    }
    return (
        <Dialog title={t.assistant} onClose={onClose}>
            <div className="assistant-body">
                <div className="assistant-intro">
                    <span className="assistant-mark">
                        <Compass size={28} />
                    </span>
                    <h3>{t.plan}</h3>
                    <p className="muted">
                        {identity.user.locale === "vi"
                            ? "Tìm lại ý tưởng, chia nhỏ mục tiêu và lên kế hoạch từ ngữ cảnh của bạn. Bạn luôn là người xác nhận thay đổi."
                            : "Find ideas, break down goals and make plans with your context. You confirm every change."}
                    </p>
                </div>
                {run?.answer && (
                    <div className="answer">
                        <AssistantCompiledMessage
                            content={run.answer}
                            proposal={run.proposal}
                            text={(en, vi) => (identity.user.locale === "vi" ? vi : en)}
                        />
                    </div>
                )}
                {busy && (
                    <p role="status" className="thinking">
                        <Sparkles size={16} />
                        {t.working}
                    </p>
                )}
                {run?.sources?.length ? (
                    <div className="sources">
                        {run.sources.map((source) => (
                            <a
                                key={`${source.kind}:${source.id}`}
                                href={`/${source.kind === "milestones" ? "goals" : source.kind}?open=${source.id}&kind=${source.kind}`}
                            >
                                {source.kind}: {source.id.slice(0, 8)}
                            </a>
                        ))}
                    </div>
                ) : null}
                {run?.proposal && (
                    <section className="proposal">
                        <h3>{t.proposal}</h3>
                        {run.proposal.operations.map((operation, i) => (
                            <div key={i}>
                                <strong>
                                    {operation.action} {operation.kind}
                                </strong>
                                <pre>
                                    {JSON.stringify(operation.fields, null, 2)}
                                </pre>
                            </div>
                        ))}
                        <button
                            className="primary"
                            disabled={busy || !!run.applied_at}
                            onClick={() => void apply()}
                        >
                            <Check size={16} />
                            {run.applied_at ? t.applied : t.apply}
                        </button>
                    </section>
                )}
                {error && (
                    <p className="error" role="alert">
                        {error}
                    </p>
                )}
            </div>
            <form className="assistant-input" onSubmit={ask}>
                <textarea
                    aria-label={t.ask}
                    placeholder={t.ask}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    rows={3}
                    maxLength={4000}
                    required
                />
                <button
                    className="primary"
                    aria-label={t.send}
                    disabled={busy || !prompt.trim()}
                >
                    <ArrowUp size={20} />
                </button>
            </form>
        </Dialog>
    );
}
