"use client";
import { useEffect, useRef, useState } from "react";
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Flag,
    Plus,
    ShieldCheck,
    X,
} from "lucide-react";
import Dialog from "../dialog";
import { usePreviewData, type Report, type Member } from "./workspace-data";
import { Confirm, Field, Header, Tabs } from "./ui";
import type { Text } from "./shared";
const guide = [
    [
        "dashboard",
        "dashboard",
        "Your day, at a glance",
        "Một ngày trong tầm mắt",
        "Choose your focus Goal. Pick today's work, then check in a Habit.",
        "Chọn mục tiêu chính. Chọn công việc hôm nay, rồi điểm danh thói quen.",
    ],
    [
        "goals",
        "goals",
        "From direction to action",
        "Từ hướng đi đến hành động",
        "Create a Goal in an Area. Add Milestones, then Tasks. Expand child Goals independently.",
        "Tạo mục tiêu trong lĩnh vực. Thêm cột mốc, rồi công việc. Mở từng nhánh mục tiêu con độc lập.",
    ],
    [
        "roadmap",
        "goals",
        "Follow your roadmap",
        "Theo lộ trình của bạn",
        "Open the Goal head for information and Strategy. A branch opens its Milestone; prerequisites are set separately.",
        "Bấm đầu mục tiêu để xem thông tin và Chiến lược. Nhánh mở cột mốc; điều kiện tiên quyết được thiết lập riêng.",
    ],
    [
        "task-detail",
        "tasks",
        "Work one step at a time",
        "Thực hiện từng bước",
        "Capture dates, check a Checklist and keep a working Note. Repeating Tasks have their own templates.",
        "Đặt ngày, đánh dấu danh sách kiểm tra và ghi chép khi làm. Công việc lặp có mẫu riêng.",
    ],
    [
        "calendar-week",
        "calendar",
        "Make room in your week",
        "Sắp chỗ trong tuần",
        "Switch month, week or Gantt. Drag a task to reschedule, or use Alt and arrow keys on a Gantt bar.",
        "Đổi giữa tháng, tuần và Gantt. Kéo để đổi lịch, hoặc dùng Alt và phím mũi tên trên thanh Gantt.",
    ],
    [
        "habits",
        "habits",
        "Build a steady rhythm",
        "Giữ nhịp đều đặn",
        "Check in today or a past day. Plan rest within the next three days; it is not a completion.",
        "Điểm danh hôm nay hoặc ngày đã qua. Đặt ngày nghỉ trong ba ngày tới; ngày nghỉ không tính là hoàn thành.",
    ],
    [
        "note-editor",
        "notes",
        "Keep ideas close",
        "Giữ ý tưởng bên mình",
        "Write a Note, link a Goal or Task, attach a file and choose read or edit sharing. Locked Notes stay outside assistant context.",
        "Viết ghi chú, liên kết mục tiêu hoặc công việc, đính kèm tệp và chọn quyền đọc hoặc sửa khi chia sẻ. Ghi chú khóa không được dùng làm ngữ cảnh trợ lý.",
    ],
    [
        "reviews",
        "reviews",
        "Look back with intention",
        "Nhìn lại có chủ đích",
        "Save a daily, weekly or monthly snapshot and add a reflection. Later edits to Tasks do not rewrite saved figures.",
        "Lưu ảnh chụp ngày, tuần hoặc tháng rồi ghi suy ngẫm. Sửa công việc về sau không viết lại số liệu đã lưu.",
    ],
    [
        "appearance",
        "appearance",
        "A space of your own",
        "Không gian của riêng bạn",
        "Try scenery, light or dark, your own image and accent. Preview before saving.",
        "Thử khung cảnh, sáng hoặc tối, ảnh riêng và màu nhấn. Xem trước rồi lưu.",
    ],
    [
        "assistant",
        "dashboard",
        "Review before applying",
        "Duyệt trước khi áp dụng",
        "Read the proposal's before and after. Confirm to apply, reject to keep work unchanged.",
        "Đọc nội dung trước và sau của đề xuất. Xác nhận để áp dụng, từ chối để giữ nguyên dữ liệu.",
    ],
    [
        "archive",
        "archive",
        "Keep a way back",
        "Giữ đường quay lại",
        "Restore groups together. Restore an archived parent first. Permanent deletion requires a separate confirmation.",
        "Khôi phục cùng nhóm. Khôi phục mục cha trước. Xóa vĩnh viễn cần xác nhận riêng.",
    ],
];
export function TourPreview({
    text,
    onClose,
}: {
    text: Text;
    onClose: () => void;
}) {
    const db = usePreviewData(),
        [index, setIndex] = useState(0);
    const step = guide[index];
    return (
        <Dialog
            title={text("A quick tour of Planner", "Làm quen với Planner")}
            closeLabel={text("Close", "Đóng")}
            className="preview-dialog review-dialog review-tour"
            onClose={onClose}
        >
            <div className="preview-dialog-body">
                <img
                    src={`/guide/${db.locale}/${step[0]}.webp`}
                    alt={text(step[2], step[3])}
                />
                <h2>{text(step[2], step[3])}</h2>
                <p>{text(step[4], step[5])}</p>
                <label className="review-checkbox">
                    <input type="checkbox" defaultChecked />
                    {text(
                        "Dismiss this tour for this preview session",
                        "Ẩn hướng dẫn trong phiên xem thử này",
                    )}
                </label>
            </div>
            <footer className="preview-dialog-footer">
                <button
                    className="text-button"
                    onClick={() => {
                        db.navigate("help");
                        onClose();
                    }}
                >
                    {text("Open the full guide", "Mở hướng dẫn đầy đủ")}
                </button>
                <button
                    className="icon-button"
                    disabled={!index}
                    onClick={() => setIndex(index - 1)}
                    aria-label={text("Previous", "Trước")}
                >
                    <ChevronLeft size={18} />
                </button>
                <span>
                    {index + 1}/{guide.length}
                </span>
                <button
                    className="button button-primary"
                    onClick={() =>
                        index === guide.length - 1
                            ? onClose()
                            : setIndex(index + 1)
                    }
                >
                    {text(
                        index === guide.length - 1 ? "Done" : "Next",
                        index === guide.length - 1 ? "Xong" : "Tiếp",
                    )}
                </button>
            </footer>
        </Dialog>
    );
}
export default function SupportPreview({
    text,
    section,
}: {
    text: Text;
    section: string;
}) {
    const db = usePreviewData();
    const [tab, setTab] = useState("reports"),
        [reportId, setReportId] = useState(""),
        [actions, setActions] = useState<string[]>([]),
        [reply, setReply] = useState(""),
        [error, setError] = useState(""),
        [reportKind, setReportKind] = useState<"user" | "note">("user"),
        [target, setTarget] = useState(""),
        [evidence, setEvidence] = useState<string[]>([]),
        [reportState, setReportState] = useState("open"),
        [query, setQuery] = useState(""),
        [confirm, setConfirm] = useState<{
            kind: "resolve" | "dismiss" | "lock" | "delete";
            member?: Member;
        } | null>(null),
        [image, setImage] = useState(""),
        [deleteEmail, setDeleteEmail] = useState("");
    const selfId = db.live?.identity.user.id || "member-an";
    async function policy(
        mode = db.registration,
        invitations = db.invitations,
    ) {
        try {
            await db.live!.request("/admin/registration", {
                method: "PUT",
                body: JSON.stringify({ mode, invitations }),
            });
            await db.live!.refresh();
            db.setMessage(
                text(
                    "Registration settings saved.",
                    "Đã lưu thiết lập đăng ký.",
                ),
            );
        } catch (err) {
            setError((err as Error).message);
        }
    }
    const files = useRef<string[]>([]);
    useEffect(
        () => () => files.current.forEach((url) => URL.revokeObjectURL(url)),
        [],
    );
    useEffect(() => {
        if (db.nav.section === "reports" && db.nav.note) {
            setReportKind("note");
            setTarget(db.nav.note);
        }
    }, [db.nav.stamp]);
    const report = db.reports.find((r) => r.id === reportId),
        owner = db.members.find((m) => m.id === report?.owner);
    const log = (title: string) =>
        db.setAdminLog((rows) => [
            { id: crypto.randomUUID(), title, at: new Date().toISOString() },
            ...rows,
        ]);
    const openReport = (row: Report) => {
        setReportId(row.id);
        setActions([]);
        setReply("");
        setError("");
    };
    const actionLabel = (value: string) =>
        value === "warn"
            ? text("Warn account", "Cảnh báo tài khoản")
            : value === "lock"
              ? text("Lock account", "Khóa tài khoản")
              : text("Withdraw Note shares", "Thu hồi chia sẻ ghi chú");
    const reportTitle = (value: Report) =>
        value.kind === "note"
            ? db.notes.find((note) => note.id === value.target)?.title ||
              value.snapshot.split("\n")[0] ||
              text("Shared Note", "Ghi chú chia sẻ")
            : value.target;
    const stateLabel = (value: string) =>
        value === "open"
            ? text("Awaiting review", "Đang chờ xem xét")
            : value === "resolved"
              ? text("Resolved", "Đã xử lý")
              : text("Dismissed", "Đã bỏ qua");
    function resolve(dismiss: boolean) {
        if (!report) return;
        if (!dismiss && !owner) {
            setError(
                text(
                    "This email has no matching account. Dismiss only.",
                    "Email không khớp tài khoản nào. Chỉ có thể bỏ qua.",
                ),
            );
            return;
        }
        if (!dismiss && !actions.length && !owner?.locked) {
            setError(
                text(
                    "Choose at least one action before resolving.",
                    "Chọn ít nhất một hành động trước khi xử lý.",
                ),
            );
            return;
        }
        setConfirm({ kind: dismiss ? "dismiss" : "resolve" });
    }
    async function perform() {
        if (db.live && confirm) {
            try {
                if (confirm.member) {
                    const member = confirm.member;
                    if (confirm.kind === "delete")
                        await db.live.request(`/admin/users/${member.id}`, {
                            method: "DELETE",
                            body: JSON.stringify({
                                confirm_email: deleteEmail,
                            }),
                        });
                    else
                        await db.live.request(
                            `/admin/users/${member.id}/lock`,
                            {
                                method: "PUT",
                                body: JSON.stringify({
                                    locked: !member.locked,
                                    reason: reply,
                                }),
                            },
                        );
                } else if (report)
                    await db.live.request(
                        `/admin/reports/${report.id}/resolve`,
                        {
                            method: "POST",
                            body: JSON.stringify({
                                state:
                                    confirm.kind === "dismiss"
                                        ? "dismissed"
                                        : "resolved",
                                actions:
                                    confirm.kind === "dismiss"
                                        ? []
                                        : actions.map((a) =>
                                              a === "unshare"
                                                  ? "revoke_shares"
                                                  : a,
                                          ),
                                reply,
                            }),
                        },
                    );
                await db.live.refresh();
                setConfirm(null);
                setError("");
                db.setMessage(
                    text("Action completed.", "Đã hoàn tất thao tác."),
                );
            } catch (err) {
                setError((err as Error).message);
            }
            return;
        }
        if (confirm?.kind === "delete" && confirm.member) {
            const member = confirm.member;
            if (
                member.admin ||
                member.id === selfId ||
                deleteEmail !== member.email
            )
                return;
            db.setMembers((rows) => rows.filter((row) => row.id !== member.id));
            db.setReports((rows) =>
                rows.map((row) =>
                    row.owner === member.id ? { ...row, owner: "" } : row,
                ),
            );
            log(
                text("Deleted sample account: ", "Xóa tài khoản mẫu: ") +
                    member.email,
            );
        } else if (confirm?.kind === "lock" && confirm.member) {
            const member = confirm.member;
            if (member.admin || member.id === selfId) return;
            db.setMembers((rows) =>
                rows.map((m) =>
                    m.id === member.id ? { ...m, locked: !m.locked } : m,
                ),
            );
            log(
                text(
                    member.locked ? "Unlocked account: " : "Locked account: ",
                    member.locked ? "Mở khóa tài khoản: " : "Khóa tài khoản: ",
                ) + member.email,
            );
        } else if (report) {
            const dismiss = confirm?.kind === "dismiss";
            db.setReports((rows) =>
                rows.map((r) =>
                    r.id === report.id
                        ? {
                              ...r,
                              state: dismiss ? "dismissed" : "resolved",
                              actions: dismiss ? [] : actions,
                              reply,
                          }
                        : r,
                ),
            );
            if (!dismiss && owner) {
                db.setMembers((rows) =>
                    rows.map((m) =>
                        m.id === owner.id
                            ? {
                                  ...m,
                                  warned: m.warned || actions.includes("warn"),
                                  locked: m.locked || actions.includes("lock"),
                              }
                            : m,
                    ),
                );
                if (actions.includes("unshare"))
                    db.setNotes((rows) =>
                        rows.map((n) =>
                            n.id === report.target
                                ? { ...n, shared: false, shares: [] }
                                : n,
                        ),
                    );
            }
            log(
                text(
                    dismiss ? "Dismissed report: " : "Resolved report: ",
                    dismiss ? "Bỏ qua báo cáo: " : "Xử lý báo cáo: ",
                ) +
                    report.id +
                    (!dismiss
                        ? " · " + actions.map(actionLabel).join(", ")
                        : ""),
            );
            db.setMessage(
                text(
                    "Sample moderation recorded. No real account was changed.",
                    "Đã ghi thao tác quản trị mẫu. Không thay đổi tài khoản thật.",
                ),
            );
        }
        setConfirm(null);
    }
    if (section === "help")
        return (
            <div>
                <Header
                    title={text("User guide", "Hướng dẫn sử dụng")}
                    description={text(
                        "A clear path from an idea to your next step.",
                        "Từ một ý tưởng đến bước tiếp theo rõ ràng.",
                    )}
                />
                <div className="review-guide-layout">
                    <nav
                        className="planning-panel review-guide-nav"
                        aria-label={text("Guide contents", "Mục lục hướng dẫn")}
                    >
                        {guide.map(([id, , en, vi]) => (
                            <a key={id} href={`#guide-${id}`}>
                                {text(en, vi)}
                            </a>
                        ))}
                        <a href="#guide-faq">
                            {text(
                                "Frequently asked questions",
                                "Câu hỏi thường gặp",
                            )}
                        </a>
                    </nav>
                    <article className="review-guide-content">
                        <section className="planning-panel">
                            <h2>
                                {text(
                                    "How it fits together",
                                    "Các phần liên kết với nhau",
                                )}
                            </h2>
                            <p>
                                {text(
                                    "Areas hold your directions. Goals describe results; child Goals break them down. Milestones mark checkpoints, Tasks are finite actions, and Habits build rhythm. Notes support your thinking; Reviews preserve what you learned.",
                                    "Lĩnh vực giữ các hướng đi. Mục tiêu mô tả kết quả; mục tiêu con chia nhỏ hướng đi. Cột mốc đánh dấu chặng, công việc là hành động hữu hạn, còn thói quen tạo nhịp. Ghi chú hỗ trợ suy nghĩ; Nhìn lại giữ điều bạn đã học.",
                                )}
                            </p>
                            <p className="notice">
                                {text(
                                    db.live
                                        ? "Your changes are saved to your account. Guide images illustrate the retained personal workflow."
                                        : "This is a synthetic UI preview. Guide images are retained from the earlier version for comparison. Refresh resets changes; backend behavior is not connected here.",
                                    db.live
                                        ? "Thay đổi được lưu vào tài khoản của bạn. Ảnh hướng dẫn minh họa các thao tác quen thuộc."
                                        : "Đây là bản xem thử giao diện với dữ liệu mẫu. Ảnh hướng dẫn được giữ từ phiên bản cũ để đối chiếu. Tải lại sẽ đặt lại thay đổi; chưa nối hành vi backend.",
                                )}
                            </p>
                        </section>
                        {guide.map(
                            ([id, destination, en, vi, enBody, viBody]) => (
                                <section
                                    className="planning-panel"
                                    id={`guide-${id}`}
                                    key={id}
                                >
                                    <h2>{text(en, vi)}</h2>
                                    <p>{text(enBody, viBody)}</p>
                                    <button
                                        className="review-guide-image"
                                        onClick={() =>
                                            setImage(
                                                `/guide/${db.locale}/${id}.webp`,
                                            )
                                        }
                                        aria-label={text(
                                            "Enlarge screenshot",
                                            "Phóng to ảnh hướng dẫn",
                                        )}
                                    >
                                        <img
                                            src={`/guide/${db.locale}/${id}.webp`}
                                            alt={text(en, vi)}
                                            loading="lazy"
                                        />
                                    </button>
                                    <button
                                        className="button button-quiet"
                                        onClick={() =>
                                            id === "assistant"
                                                ? db.setAssistantOpen(true)
                                                : db.navigate(destination)
                                        }
                                    >
                                        {text(
                                            "Try this screen",
                                            "Mở màn hình này",
                                        )}
                                    </button>
                                </section>
                            ),
                        )}
                        <section id="guide-faq" className="planning-panel">
                            <h2>
                                {text(
                                    "Frequently asked questions",
                                    "Câu hỏi thường gặp",
                                )}
                            </h2>
                            {[
                                [
                                    "Do Habits change Goal progress?",
                                    "Thói quen có đổi tiến độ mục tiêu không?",
                                    "No. Only finite primary work contributes to the Goal percentage.",
                                    "Không. Chỉ công việc hữu hạn trực tiếp mới đóng góp vào phần trăm mục tiêu.",
                                ],
                                [
                                    "Does selecting Today change dates?",
                                    "Chọn Hôm nay có đổi ngày không?",
                                    "No. A daily selection is a plan choice and also selects this week.",
                                    "Không. Đây là lựa chọn kế hoạch; chọn hôm nay cũng chọn tuần này.",
                                ],
                                [
                                    "Why can I not restore a Task?",
                                    "Vì sao chưa thể khôi phục công việc?",
                                    "Restore its archived parent first. Items archived together return as a group.",
                                    "Khôi phục mục cha đang lưu trữ trước. Các mục lưu cùng nhau sẽ quay lại theo nhóm.",
                                ],
                                [
                                    "Does the assistant apply changes automatically?",
                                    "Trợ lý có tự thay đổi dữ liệu không?",
                                    "No. Read and explicitly confirm the exact proposal first.",
                                    "Không. Cần đọc và xác nhận rõ đề xuất trước khi áp dụng.",
                                ],
                            ].map(([en, vi, a, b]) => (
                                <details key={en}>
                                    <summary>{text(en, vi)}</summary>
                                    <p>{text(a, b)}</p>
                                </details>
                            ))}
                        </section>
                    </article>
                </div>
                {image && (
                    <Dialog
                        title={text("Guide screenshot", "Ảnh hướng dẫn")}
                        onClose={() => setImage("")}
                        wide
                    >
                        <img
                            className="review-full-image"
                            src={image}
                            alt={text(
                                "Retained interface screenshot",
                                "Ảnh giao diện phiên bản trước",
                            )}
                        />
                    </Dialog>
                )}
            </div>
        );
    if (section === "reports")
        return (
            <div>
                <Header
                    title={text("Reports", "Báo cáo")}
                    description={text(
                        "Tell us what needs a closer look.",
                        "Cho biết nội dung cần được xem xét.",
                    )}
                />
                <form
                    className="planning-panel stack-form review-settings-card"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        const element = e.currentTarget;
                        if (db.live) {
                            try {
                                await db.live.request("/reports", {
                                    method: "POST",
                                    body: JSON.stringify({
                                        kind: reportKind,
                                        target,
                                        reason: String(
                                            new FormData(element).get("reason"),
                                        ),
                                        evidence: evidence.map((url) =>
                                            url.split("/").pop(),
                                        ),
                                    }),
                                });
                                await db.live.refresh();
                                setTarget("");
                                setEvidence([]);
                                setError("");
                                element.reset();
                                db.setMessage(
                                    text(
                                        "Report submitted.",
                                        "Đã gửi báo cáo.",
                                    ),
                                );
                            } catch (err) {
                                setError((err as Error).message);
                            }
                            return;
                        }
                        const form = new FormData(e.currentTarget),
                            reason = String(form.get("reason")).trim(),
                            member =
                                reportKind === "user"
                                    ? db.members.find(
                                          (m) =>
                                              m.email.toLowerCase() ===
                                              target.trim().toLowerCase(),
                                      )
                                    : db.members.find(
                                          (m) => m.id === "member-binh",
                                      ),
                            note = db.notes.find((n) => n.id === target);
                        if (reportKind === "note" && (!note || note.locked)) {
                            setError(
                                text(
                                    "Choose an unlocked shared Note.",
                                    "Chọn ghi chú được chia sẻ và chưa khóa.",
                                ),
                            );
                            return;
                        }
                        const row: Report = {
                            id: `report-${Date.now()}`,
                            kind: reportKind,
                            target: target.trim(),
                            owner: member?.id || "",
                            reporter: "member-an",
                            reason,
                            evidence,
                            snapshot: note
                                ? note.title + "\n" + note.content
                                : "",
                            state: "open",
                            actions: [],
                            reply: "",
                        };
                        db.setReports((rows) => [row, ...rows]);
                        setTarget("");
                        setEvidence([]);
                        setError("");
                        e.currentTarget.reset();
                        db.setMessage(
                            text(
                                "Report saved in this preview. View it in Administration.",
                                "Đã lưu báo cáo mẫu. Có thể xem trong Quản trị.",
                            ),
                        );
                    }}
                >
                    <h2>{text("Submit a report", "Gửi báo cáo")}</h2>
                    <Field label={text("Report type", "Loại báo cáo")}>
                        <select
                            value={reportKind}
                            onChange={(e) => {
                                setReportKind(
                                    e.target.value as "user" | "note",
                                );
                                setTarget("");
                            }}
                        >
                            <option value="user">
                                {text("User account", "Tài khoản")}
                            </option>
                            <option value="note">
                                {text("Shared Note", "Ghi chú chia sẻ")}
                            </option>
                        </select>
                    </Field>
                    <Field
                        label={text(
                            reportKind === "user"
                                ? "Reported email"
                                : "Shared Note",
                            reportKind === "user"
                                ? "Email cần báo cáo"
                                : "Ghi chú chia sẻ",
                        )}
                    >
                        {reportKind === "user" ? (
                            <input
                                type="email"
                                required
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                                placeholder="binh@example.test"
                            />
                        ) : (
                            <select
                                required
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                            >
                                <option value="">
                                    {text("Choose Note", "Chọn ghi chú")}
                                </option>
                                {db.notes
                                    .filter(
                                        (n) =>
                                            n.permission !== "owner" &&
                                            !n.locked,
                                    )
                                    .map((n) => (
                                        <option key={n.id} value={n.id}>
                                            {n.title}
                                        </option>
                                    ))}
                            </select>
                        )}
                    </Field>
                    <Field label={text("Describe the concern", "Mô tả vấn đề")}>
                        <textarea
                            name="reason"
                            required
                            rows={5}
                            minLength={10}
                            maxLength={2000}
                        />
                    </Field>
                    <Field
                        label={text(
                            "Image evidence (up to 3)",
                            "Ảnh bằng chứng (tối đa 3)",
                        )}
                    >
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={async (e) => {
                                if (db.live) {
                                    const selected = Array.from(
                                        e.target.files || [],
                                    ).slice(0, 3 - evidence.length);
                                    e.target.value = "";
                                    try {
                                        const urls: string[] = [];
                                        for (const file of selected) {
                                            const result =
                                                (await db.live.upload(
                                                    "/account-files",
                                                    file,
                                                    "evidence",
                                                )) as { url: string };
                                            urls.push(result.url);
                                        }
                                        setEvidence((previous) => [
                                            ...previous,
                                            ...urls,
                                        ]);
                                        setError("");
                                    } catch (err) {
                                        setError((err as Error).message);
                                    }
                                    return;
                                }
                                const selected = Array.from(
                                    e.target.files || [],
                                )
                                    .slice(0, 3 - evidence.length)
                                    .filter(
                                        (f) =>
                                            f.type.startsWith("image/") &&
                                            f.size < 5 * 1024 * 1024,
                                    )
                                    .map((f) => {
                                        const url = URL.createObjectURL(f);
                                        files.current.push(url);
                                        return url;
                                    });
                                setEvidence([...evidence, ...selected]);
                                e.target.value = "";
                            }}
                        />
                    </Field>
                    <div className="review-evidence">
                        {evidence.map((url) => (
                            <div key={url}>
                                <img
                                    src={url}
                                    alt={text(
                                        "Report evidence",
                                        "Bằng chứng báo cáo",
                                    )}
                                />
                                <button
                                    type="button"
                                    className="icon-button"
                                    aria-label={text("Remove image", "Bỏ ảnh")}
                                    onClick={() =>
                                        setEvidence(
                                            evidence.filter((v) => v !== url),
                                        )
                                    }
                                >
                                    <X size={15} />
                                </button>
                            </div>
                        ))}
                    </div>
                    {error && (
                        <p className="field-error" role="alert">
                            {error}
                        </p>
                    )}
                    <p className="review-caption">
                        {text(
                            db.live
                                ? "Reports and evidence are sent privately to administrators."
                                : "Sample report only. Images stay in browser memory; no message is sent.",
                            db.live
                                ? "Báo cáo và bằng chứng được gửi riêng đến quản trị viên."
                                : "Chỉ là báo cáo mẫu. Ảnh ở trong bộ nhớ trình duyệt; không gửi thông báo.",
                        )}
                    </p>
                    <div className="review-form-footer">
                        <button className="button button-primary">
                            <Flag size={16} />
                            {text("Submit report", "Gửi báo cáo")}
                        </button>
                    </div>
                </form>
                <section className="planning-panel review-settings-card">
                    <h2>{text("Your reports", "Báo cáo của bạn")}</h2>
                    {db.reports
                        .filter((r) =>
                            db.live
                                ? r.reporter_id === db.live.identity.user.id
                                : r.reporter === "member-an",
                        )
                        .map((r) => (
                            <div className="review-report-row" key={r.id}>
                                <strong>{reportTitle(r)}</strong>
                                <span>
                                    {r.state === "open"
                                        ? text(
                                              "Awaiting review",
                                              "Đang chờ xem xét",
                                          )
                                        : r.state === "resolved"
                                          ? text(
                                                "Reviewed; action taken",
                                                "Đã xem xét và xử lý",
                                            )
                                          : text(
                                                "Reviewed; no action needed",
                                                "Đã xem xét; không cần xử lý",
                                            )}
                                </span>
                                <p>{r.reason}</p>
                                {r.reply && <blockquote>{r.reply}</blockquote>}
                            </div>
                        ))}
                </section>
            </div>
        );
    if (!db.admin)
        return (
            <section className="planning-panel review-state">
                <ShieldCheck size={32} />
                <h2>
                    {text(
                        "Administration is unavailable",
                        "Không có quyền quản trị",
                    )}
                </h2>
                <p>
                    {text(
                        db.live
                            ? "This account does not have administrator access."
                            : "Select the administrator preview role to view the sample administration screens.",
                        db.live
                            ? "Tài khoản này không có quyền quản trị."
                            : "Chọn vai trò quản trị trong thanh xem thử để xem màn quản trị mẫu.",
                    )}
                </p>
            </section>
        );
    return (
        <div>
            <Header
                title={text("Administration", "Quản trị")}
                description={text(
                    "Review reports and account controls with care.",
                    "Xem xét báo cáo và tài khoản cẩn thận.",
                )}
            />
            <p className="notice">
                {text(
                    "All accounts and actions on this screen are synthetic. Administrator roles are assigned outside the real app.",
                    db.live
                        ? "Quyền quản trị được cấp bằng công cụ trên máy chủ. Mọi thao tác được ghi nhật ký."
                        : "Mọi tài khoản và thao tác ở đây là dữ liệu mẫu. Quyền quản trị của ứng dụng thật được cấp bên ngoài giao diện.",
                )}
            </p>
            <Tabs
                id="review-admin"
                label={text("Administration sections", "Các mục quản trị")}
                value={tab}
                onChange={(value) => {
                    setTab(value);
                    setReportId("");
                }}
                items={[
                    ["reports", text("Reports", "Báo cáo")],
                    ["users", text("Users", "Tài khoản")],
                    ["registration", text("Registration", "Đăng ký")],
                    ["log", text("Activity log", "Nhật ký")],
                ]}
            />
            {tab === "reports" &&
                (report ? (
                    <article className="planning-panel stack-form review-settings-card">
                        <button
                            className="text-button"
                            onClick={() => setReportId("")}
                        >
                            <ArrowLeft size={15} />
                            {text("All reports", "Mọi báo cáo")}
                        </button>
                        <h2>{reportTitle(report)}</h2>
                        <p>{report.reason}</p>
                        <Field
                            label={text(
                                "Snapshot when reported",
                                "Ảnh chụp lúc báo cáo",
                            )}
                        >
                            <textarea
                                readOnly
                                value={
                                    report.snapshot ||
                                    text(
                                        "No Note snapshot for this user report.",
                                        "Báo cáo tài khoản không có nội dung ghi chú.",
                                    )
                                }
                                rows={4}
                            />
                        </Field>
                        <div className="review-evidence">
                            {report.evidence.map((url) => (
                                <a
                                    key={url}
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    <img
                                        src={url}
                                        alt={text(
                                            "Report evidence",
                                            "Ảnh bằng chứng",
                                        )}
                                    />
                                </a>
                            ))}
                        </div>
                        {report.state === "open" ? (
                            <>
                                <h3>
                                    {text(
                                        "Resolution actions",
                                        "Hành động xử lý",
                                    )}
                                </h3>
                                {!owner && (
                                    <p className="notice">
                                        {text(
                                            "No matching account. Only dismissal is available.",
                                            "Không có tài khoản phù hợp. Chỉ có thể bỏ qua.",
                                        )}
                                    </p>
                                )}
                                {[
                                    [
                                        "unshare",
                                        "Withdraw all shares of this Note",
                                        "Thu hồi mọi chia sẻ của ghi chú",
                                    ],
                                    [
                                        "warn",
                                        "Warn account",
                                        "Cảnh báo tài khoản",
                                    ],
                                    ["lock", "Lock account", "Khóa tài khoản"],
                                ]
                                    .filter(
                                        ([key]) =>
                                            key !== "unshare" ||
                                            report.kind === "note",
                                    )
                                    .map(([key, en, vi]) => (
                                        <label
                                            className="review-checkbox"
                                            key={key}
                                        >
                                            <input
                                                type="checkbox"
                                                disabled={
                                                    !owner ||
                                                    (key === "lock" &&
                                                        (owner.admin ||
                                                            owner.id ===
                                                                "member-an"))
                                                }
                                                checked={actions.includes(key)}
                                                onChange={() =>
                                                    setActions((values) =>
                                                        values.includes(key)
                                                            ? values.filter(
                                                                  (v) =>
                                                                      v !== key,
                                                              )
                                                            : [...values, key],
                                                    )
                                                }
                                            />
                                            {text(en, vi)}
                                        </label>
                                    ))}
                                <Field
                                    label={text(
                                        "Reply to reporter (optional)",
                                        "Phản hồi người báo cáo (tùy chọn)",
                                    )}
                                >
                                    <textarea
                                        rows={3}
                                        value={reply}
                                        onChange={(e) =>
                                            setReply(e.target.value)
                                        }
                                    />
                                </Field>
                                {error && (
                                    <p role="alert" className="field-error">
                                        {error}
                                    </p>
                                )}
                                <div className="review-form-footer">
                                    <button
                                        className="button button-quiet"
                                        onClick={() => resolve(true)}
                                    >
                                        {text("Dismiss", "Bỏ qua")}
                                    </button>
                                    <button
                                        className="button button-primary"
                                        disabled={!owner}
                                        onClick={() => resolve(false)}
                                    >
                                        {text(
                                            "Resolve report",
                                            "Xử lý báo cáo",
                                        )}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="notice">
                                <strong>{stateLabel(report.state)}</strong>
                                <p>
                                    {report.actions
                                        .map(actionLabel)
                                        .join(", ") ||
                                        text(
                                            "No action taken",
                                            "Không thực hiện hành động",
                                        )}
                                </p>
                                <p>{report.reply}</p>
                            </div>
                        )}
                    </article>
                ) : (
                    <section className="planning-panel review-settings-card">
                        <div className="review-toolbar">
                            <h2>{text("Reports", "Báo cáo")}</h2>
                            <select
                                aria-label={text(
                                    "Report status",
                                    "Trạng thái báo cáo",
                                )}
                                value={reportState}
                                onChange={(e) => setReportState(e.target.value)}
                            >
                                <option value="open">
                                    {text("Open", "Chưa xử lý")}
                                </option>
                                <option value="resolved">
                                    {text("Resolved", "Đã xử lý")}
                                </option>
                                <option value="dismissed">
                                    {text("Dismissed", "Đã bỏ qua")}
                                </option>
                            </select>
                        </div>
                        {db.reports
                            .filter((r) => r.state === reportState)
                            .map((r) => (
                                <button
                                    className="review-report-row review-report-button"
                                    key={r.id}
                                    onClick={() => openReport(r)}
                                >
                                    <span>
                                        {r.kind === "note"
                                            ? text(
                                                  "Note report",
                                                  "Báo cáo ghi chú",
                                              )
                                            : text(
                                                  "User report",
                                                  "Báo cáo tài khoản",
                                              )}
                                    </span>
                                    <strong>{reportTitle(r)}</strong>
                                    <p>{r.reason}</p>
                                    <ChevronRight size={17} />
                                </button>
                            ))}
                        {!db.reports.some((r) => r.state === reportState) && (
                            <p className="review-inline-empty">
                                {text(
                                    "No reports in this state.",
                                    "Không có báo cáo ở trạng thái này.",
                                )}
                            </p>
                        )}
                    </section>
                ))}
            {tab === "users" && (
                <section className="planning-panel review-settings-card">
                    <div className="section-heading">
                        <h2>{text("Accounts", "Tài khoản")}</h2>
                        <input
                            aria-label={text("Find account", "Tìm tài khoản")}
                            placeholder={text(
                                "Name or email…",
                                "Tên hoặc email…",
                            )}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>
                    {db.members
                        .filter((m) =>
                            (m.name + " " + m.email)
                                .toLowerCase()
                                .includes(query.toLowerCase()),
                        )
                        .map((m) => (
                            <div className="review-user-row" key={m.id}>
                                <div>
                                    <strong>{m.name}</strong>
                                    <small>{m.email}</small>
                                </div>
                                <span className="review-badge">
                                    {m.admin
                                        ? text("Administrator", "Quản trị viên")
                                        : m.locked
                                          ? text("Locked", "Đã khóa")
                                          : text("Active", "Đang dùng")}
                                </span>
                                <button
                                    className="button button-quiet"
                                    disabled={m.admin || m.id === selfId}
                                    onClick={() =>
                                        setConfirm({ kind: "lock", member: m })
                                    }
                                >
                                    {text(
                                        m.locked ? "Unlock" : "Lock",
                                        m.locked ? "Mở khóa" : "Khóa",
                                    )}
                                </button>
                                <button
                                    className="text-button danger-text"
                                    disabled={m.admin || m.id === selfId}
                                    onClick={() => {
                                        setDeleteEmail("");
                                        setConfirm({
                                            kind: "delete",
                                            member: m,
                                        });
                                    }}
                                >
                                    {text("Delete account", "Xóa tài khoản")}
                                </button>
                            </div>
                        ))}
                </section>
            )}
            {tab === "registration" && (
                <>
                    {db.live && (
                        <form
                            className="planning-panel stack-form review-settings-card"
                            onSubmit={async (event) => {
                                event.preventDefault();
                                const limit = Number(
                                    new FormData(event.currentTarget).get(
                                        "limit",
                                    ),
                                );
                                try {
                                    await db.live!.request("/admin/history", {
                                        method: "PUT",
                                        body: JSON.stringify({ limit }),
                                    });
                                    await db.live!.refresh();
                                } catch (err) {
                                    setError((err as Error).message);
                                }
                            }}
                        >
                            <h2>{text("History limit", "Giới hạn lịch sử")}</h2>
                            <Field
                                label={text(
                                    "Maximum retained Tasks per account",
                                    "Số công việc lịch sử tối đa mỗi tài khoản",
                                )}
                            >
                                <input
                                    type="number"
                                    name="limit"
                                    min={1}
                                    max={100000}
                                    defaultValue={db.live.historyLimit}
                                    required
                                />
                            </Field>
                            <button className="button button-primary">
                                {text("Save limit", "Lưu giới hạn")}
                            </button>
                        </form>
                    )}
                    <form
                        className="planning-panel stack-form review-settings-card"
                        onSubmit={(e) => {
                            e.preventDefault();
                            const mode = String(
                                new FormData(e.currentTarget).get("mode"),
                            ) as "open" | "invitation" | "closed";
                            if (db.live) {
                                void policy(mode);
                                return;
                            }
                            db.setRegistration(mode);
                            log(
                                text(
                                    "Registration mode: ",
                                    "Chế độ đăng ký: ",
                                ) + mode,
                            );
                            db.setMessage(
                                text(
                                    "Registration mode saved in the preview.",
                                    "Đã lưu chế độ đăng ký mẫu.",
                                ),
                            );
                        }}
                    >
                        <h2>
                            {text("Who can register?", "Ai có thể đăng ký?")}
                        </h2>
                        <Field
                            label={text("Registration mode", "Chế độ đăng ký")}
                        >
                            <select name="mode" defaultValue={db.registration}>
                                <option value="open">
                                    {text(
                                        "Open to everyone",
                                        "Mở cho mọi người",
                                    )}
                                </option>
                                <option value="invitation">
                                    {text(
                                        "Invitation only",
                                        "Chỉ người được mời",
                                    )}
                                </option>
                                <option value="closed">
                                    {text("Closed", "Đóng đăng ký")}
                                </option>
                            </select>
                        </Field>
                        <div className="review-form-footer">
                            <button className="button button-primary">
                                {text("Save mode", "Lưu chế độ")}
                            </button>
                        </div>
                    </form>
                    <form
                        className="planning-panel stack-form review-settings-card"
                        onSubmit={(e) => {
                            e.preventDefault();
                            const email = String(
                                new FormData(e.currentTarget).get("email"),
                            ).toLowerCase();
                            if (db.invitations.includes(email)) {
                                db.setMessage(
                                    text(
                                        "This email is already invited.",
                                        "Email này đã được mời.",
                                    ),
                                );
                                return;
                            }
                            if (db.live) {
                                void policy(db.registration, [
                                    ...db.invitations,
                                    email,
                                ]);
                                e.currentTarget.reset();
                                return;
                            }
                            db.setInvitations((rows) => [...rows, email]);
                            log(
                                text("Created invitation: ", "Tạo lời mời: ") +
                                    email,
                            );
                            e.currentTarget.reset();
                        }}
                    >
                        <h2>{text("Invitations", "Lời mời")}</h2>
                        <Field label="Email">
                            <input
                                name="email"
                                type="email"
                                required
                                placeholder="friend@example.test"
                            />
                        </Field>
                        <div className="review-form-footer">
                            <button className="button button-quiet">
                                <Plus size={16} />
                                {text(
                                    db.live
                                        ? "Create invitation"
                                        : "Create sample invitation",
                                    db.live ? "Tạo lời mời" : "Tạo lời mời mẫu",
                                )}
                            </button>
                        </div>
                        {db.invitations.map((email) => (
                            <div className="review-user-row" key={email}>
                                <span>{email}</span>
                                <button
                                    className="text-button"
                                    type="button"
                                    onClick={() => {
                                        if (db.live) {
                                            void policy(
                                                db.registration,
                                                db.invitations.filter(
                                                    (v) => v !== email,
                                                ),
                                            );
                                            return;
                                        }
                                        db.setInvitations((rows) =>
                                            rows.filter((v) => v !== email),
                                        );
                                        log(
                                            text(
                                                "Revoked invitation: ",
                                                "Thu hồi lời mời: ",
                                            ) + email,
                                        );
                                    }}
                                >
                                    {text("Revoke", "Thu hồi")}
                                </button>
                            </div>
                        ))}
                        <p className="review-caption">
                            {text(
                                "No invitation email is sent.",
                                "Không gửi email mời thật.",
                            )}
                        </p>
                    </form>
                </>
            )}
            {tab === "log" && (
                <section className="planning-panel review-settings-card">
                    <h2>
                        {text("Administrator activity", "Hoạt động quản trị")}
                    </h2>
                    {db.adminLog.map((row) => (
                        <div className="review-fact" key={row.id}>
                            <span className="review-fact-dot" />
                            <span>{row.title}</span>
                            <time>
                                {new Intl.DateTimeFormat(db.locale, {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                    timeZone: db.profile.timezone,
                                }).format(new Date(row.at))}
                            </time>
                        </div>
                    ))}
                </section>
            )}
            {confirm && (
                <Confirm
                    text={text}
                    title={
                        confirm.kind === "delete"
                            ? text(
                                  db.live
                                      ? "Delete this account?"
                                      : "Delete this sample account?",
                                  db.live
                                      ? "Xóa tài khoản này?"
                                      : "Xóa tài khoản mẫu này?",
                              )
                            : text(
                                  confirm.kind === "lock"
                                      ? confirm.member?.locked
                                          ? db.live
                                              ? "Unlock this account?"
                                              : "Unlock this sample account?"
                                          : db.live
                                            ? "Lock this account?"
                                            : "Lock this sample account?"
                                      : confirm.kind === "dismiss"
                                        ? "Dismiss without action?"
                                        : "Apply these moderation actions?",
                                  confirm.kind === "lock"
                                      ? confirm.member?.locked
                                          ? db.live
                                              ? "Mở khóa tài khoản?"
                                              : "Mở khóa tài khoản mẫu?"
                                          : db.live
                                            ? "Khóa tài khoản?"
                                            : "Khóa tài khoản mẫu?"
                                      : confirm.kind === "dismiss"
                                        ? "Bỏ qua và không xử lý?"
                                        : "Áp dụng các hành động xử lý?",
                              )
                    }
                    disabled={
                        confirm.kind === "delete" &&
                        deleteEmail !== confirm.member?.email
                    }
                    danger={confirm.kind !== "dismiss"}
                    onClose={() => setConfirm(null)}
                    onConfirm={perform}
                >
                    <p>
                        {confirm.member?.email ||
                            (report && reportTitle(report))}
                    </p>
                    {confirm.kind === "delete" && (
                        <Field
                            label={text(
                                "Type the email to confirm",
                                "Nhập email để xác nhận",
                            )}
                        >
                            <input
                                type="email"
                                value={deleteEmail}
                                onChange={(event) =>
                                    setDeleteEmail(event.target.value)
                                }
                                autoComplete="off"
                            />
                        </Field>
                    )}
                    <p>
                        {confirm.kind === "resolve"
                            ? actions.map(actionLabel).join(", ")
                            : text(
                                  db.live
                                      ? "This changes account access and is recorded in the audit log."
                                      : "This action changes sample data only and is recorded in the activity log.",
                                  db.live
                                      ? "Thao tác thay đổi quyền truy cập tài khoản và được ghi nhật ký."
                                      : "Thao tác chỉ thay đổi dữ liệu mẫu và được ghi trong nhật ký.",
                              )}
                    </p>
                </Confirm>
            )}
        </div>
    );
}
