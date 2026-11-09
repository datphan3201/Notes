"use client";

import { useEffect, useState } from "react";
import { TASK_PICKER_MIME, TASK_RETURN_MIME } from "@/lib/task-picker";
import { Plus, Trash2, X } from "lucide-react";
import {
    Badge, Button, Confirm, Field, FloatingActions, FormDialog, IconButton,
    Input, LoadingSpinner, Notice, PageHeader, Panel, Select, Surface, Tabs,
    Textarea, TextField, FloatingTaskPicker,
} from "./ui";

export default function ComponentLibrary({ initialLocale = "en" }: { initialLocale?: "en" | "vi" }) {
    const [locale, setLocale] = useState(initialLocale);
    const [theme, setTheme] = useState("light");
    const [scene, setScene] = useState("mountain");
    const [tab, setTab] = useState("tasks");
    const [dialog, setDialog] = useState<"form" | "confirm" | null>(null);
    const [message, setMessage] = useState("");
    const [pickerOpen, setPickerOpen] = useState(false);
    const [picked, setPicked] = useState<number[]>([]);
    const text = (en: string, vi: string) => locale === "vi" ? vi : en;
    useEffect(() => {
        const root = document.documentElement;
        const values = { "data-theme": theme, "data-visual-theme": scene, "data-show-illustrations": "true", lang: locale };
        const previousScene = root.style.getPropertyValue("--theme-scene");
        root.style.setProperty("--theme-scene", `url('/themes/${scene}.webp')`);
        const previous = Object.keys(values).map(name => [name, root.getAttribute(name)] as const);
        for (const [name, value] of Object.entries(values)) root.setAttribute(name, value);
        return () => {
            previous.forEach(([name, value]) => value === null ? root.removeAttribute(name) : root.setAttribute(name, value));
            if (previousScene) root.style.setProperty("--theme-scene", previousScene);
            else root.style.removeProperty("--theme-scene");
        };
    }, [theme, scene, locale]);
    return <main className="component-library">
        <PageHeader title={text("Planner component library", "Bộ giao diện Planner")}
            description={text("Shared components for a consistent workspace.", "Các thành phần dùng chung để giao diện nhất quán.")}>
            <Button variant="primary" onClick={() => setDialog("form")}><Plus size={18} aria-hidden="true" />{text("New task", "Công việc mới")}</Button>
            <Button onClick={() => setDialog("confirm")}>{text("Open confirmation", "Mở xác nhận")}</Button>
        </PageHeader>
        <div className="component-library-controls">
            <Field label={text("Language", "Ngôn ngữ")}>
                <Select value={locale} onChange={event => { setLocale(event.target.value as "en" | "vi"); setMessage(""); }}>
                    <option value="en">English</option><option value="vi">Tiếng Việt</option>
                </Select>
            </Field>
            <Field label={text("Appearance", "Giao diện")}>
                <Select value={theme} onChange={event => setTheme(event.target.value)}>
                    <option value="light">{text("Light", "Sáng")}</option><option value="dark">{text("Dark", "Tối")}</option>
                </Select>
            </Field>
            <Field label={text("Scenery", "Khung cảnh")}>
                <Select value={scene} onChange={event => setScene(event.target.value)}>
                    {[["mountain", "Mountain", "Núi"], ["forest", "Forest", "Rừng"], ["ocean", "Ocean", "Biển"], ["pisces", "Pisces", "Song Ngư"], ["stars", "Stars", "Sao"]].map(([key, en, vi]) => <option key={key} value={key}>{text(en, vi)}</option>)}
                </Select>
            </Field>
        </div>
        {message && <Notice tone="success">{message}</Notice>}
        <div className="component-library-grid">
            <Surface>
                <h2>{text("Buttons and actions", "Nút và thao tác")}</h2>
                <div className="component-library-row">
                    <Button variant="primary" onClick={() => setDialog("form")}><Plus size={18} aria-hidden="true" />{text("New task", "Công việc mới")}</Button>
                    <Button onClick={() => setMessage(text("Changes saved.", "Đã lưu thay đổi."))}>{text("Save changes", "Lưu thay đổi")}</Button>
                    <Button variant="danger" onClick={() => setDialog("confirm")}><Trash2 size={18} aria-hidden="true" />{text("Delete", "Xóa")}</Button>
                    <Button variant="ghost" onClick={() => setMessage("")}>{text("Clear message", "Ẩn thông báo")}</Button>
                    <IconButton label={text("Dismiss message", "Đóng thông báo")} onClick={() => setMessage("")}><X size={20} aria-hidden="true" /></IconButton>
                </div>
                <div className="component-library-row">
                    <Button disabled>{text("Unavailable", "Chưa khả dụng")}</Button>
                    <Button variant="primary" busy>{text("Saving…", "Đang lưu…")}</Button>
                </div>
            </Surface>
            <Surface>
                <h2>{text("Form controls", "Trường nhập liệu")}</h2>
                <div className="stack-form">
                    <TextField label={text("Task title", "Tên công việc")} placeholder={text("Plan the week", "Lên kế hoạch tuần")} hint={text("Keep it short and specific.", "Viết ngắn gọn, cụ thể.")} />
                    <TextField label={text("Email", "Email")} type="email" defaultValue="" error={text("Enter a valid email address.", "Nhập địa chỉ email hợp lệ.")} />
                    <Field label={text("Description", "Mô tả")}><Textarea rows={3} /></Field>
                    <Field label={text("Read-only field", "Trường chỉ đọc")}><Input readOnly value={text("Personal workspace", "Không gian cá nhân")} /></Field>
                </div>
            </Surface>
            <Surface>
                <h2>{text("Feedback and status", "Thông báo và trạng thái")}</h2>
                <div className="stack-form">
                    <Notice>{text("Verify your email to continue.", "Xác minh email để tiếp tục.")}</Notice>
                    <Notice tone="success">{text("Your changes have been saved.", "Thay đổi của bạn đã được lưu.")}</Notice>
                    <Notice tone="error">{text("Could not save. Keep your draft and try again.", "Chưa lưu được. Giữ bản nháp và thử lại.")}</Notice>
                    <div className="component-library-row"><Badge>{text("Not started", "Chưa bắt đầu")}</Badge><Badge tone="accent">{text("In progress", "Đang làm")}</Badge><Badge tone="success">{text("Complete", "Hoàn thành")}</Badge><Badge tone="danger">{text("Blocked", "Bị chặn")}</Badge></div>
                    <LoadingSpinner label={text("Loading…", "Đang tải…")} />
                </div>
            </Surface>
            <Surface>
                <h2>{text("Tabs and dialogs", "Tab và hộp thoại")}</h2>
                <Tabs id="component-example" label={text("Example tabs", "Tab mẫu")} items={[["tasks", text("Tasks", "Công việc")], ["notes", text("Notes", "Ghi chú")]]} value={tab} onChange={setTab} />
                <Panel id="component-example" tab="tasks" value={tab}><p>{text("Task details stay inside the same panel.", "Chi tiết công việc nằm trong cùng một khung.")}</p></Panel>
                <Panel id="component-example" tab="notes" value={tab}><p>{text("Notes reuse the same spacing and controls.", "Ghi chú dùng cùng khoảng cách và bộ điều khiển.")}</p></Panel>
                <div className="component-library-row"><Button onClick={() => setDialog("form")}>{text("Open form", "Mở form")}</Button><Button onClick={() => setDialog("confirm")}>{text("Open confirmation", "Mở xác nhận")}</Button></div>
            </Surface>
            <Surface>
                <h2>{text("Floating task picker", "Bảng nổi chọn công việc")}</h2>
                <p>{text("Search, filter, drag tasks into a destination or press Add.", "Tìm, lọc, kéo công việc vào vùng nhận hoặc bấm Thêm.")}</p>
                <Button onClick={() => setPickerOpen(true)}>{text("Choose tasks", "Chọn công việc")}</Button>
                <div className="component-picker-destination task-drop-zone" data-task-drop-target="sample"
                    onDragOver={event => { if (event.dataTransfer.types.includes(TASK_PICKER_MIME)) event.preventDefault(); }}
                    onDrop={event => {
                        event.preventDefault();
                        const id = Number(event.dataTransfer.getData(TASK_PICKER_MIME));
                        if ([1, 2, 3].includes(id)) setPicked(rows => [...new Set([...rows, id])]);
                    }}>
                    {picked.length ? `${picked.length} ${text("tasks selected", "công việc đã chọn")}` : text("Drop a task here", "Thả công việc vào đây")}
                    {picked.map(id => <div key={id} draggable className="component-picked-task"
                        onDragStart={event => event.dataTransfer.setData(TASK_RETURN_MIME, String(id))}>
                        {[text("Read documentation", "Đọc tài liệu"), text("Improve Notes", "Sửa giao diện Notes"), text("Plan the week", "Lập kế hoạch tuần")][id - 1]}
                    </div>)}
                </div>
            </Surface>
        </div>
        {pickerOpen && <FloatingTaskPicker text={text} destination={text("Today's plan", "Kế hoạch hôm nay")}
            hint={text("This example uses local sample data.", "Ví dụ sử dụng dữ liệu mẫu tại chỗ.")} error="" busyIds={[]}
            goals={[{id:"planner", title:"Planner"}]} tasks={[
                {id:1, title:text("Read documentation", "Đọc tài liệu"), goalId:"planner", goalLabel:"Planner", metadata:text("30 min", "30 phút"), scheduled:false, selected:picked.includes(1), returnable:picked.includes(1)},
                {id:2, title:text("Improve Notes", "Sửa giao diện Notes"), goalId:"planner", goalLabel:"Planner", metadata:text("45 min", "45 phút"), scheduled:false, selected:picked.includes(2), returnable:picked.includes(2)},
                {id:3, title:text("Plan the week", "Lập kế hoạch tuần"), goalId:"inbox", goalLabel:text("Inbox", "Hộp thư đến"), metadata:text("20 min", "20 phút"), scheduled:true, selected:picked.includes(3), returnable:picked.includes(3)},
            ]} onAdd={id => setPicked(rows => [...new Set([...rows, id])])}
            returnTarget="sample-return" returnLabel={text("Remove from plan", "Bỏ khỏi kế hoạch")}
            returnHint={text("Drop a selected task here to return it to the tray.", "Kéo công việc đã chọn về đây để bỏ khỏi kế hoạch.")}
            onReturn={id => setPicked(rows => rows.filter(row => row !== id))}
            onClose={() => setPickerOpen(false)} onCreate={() => { setPickerOpen(false); setDialog("form"); }}
            onPointerDrop={(id, target) => {
                if (target === "sample") setPicked(rows => [...new Set([...rows, id])]);
                else if (target === "sample-return") setPicked(rows => rows.filter(row => row !== id));
            }} />}
        <FloatingActions label={text("Page actions", "Thao tác trang")} closeLabel={text("Close actions", "Đóng thao tác")}>
            <Button variant="primary" onClick={() => setDialog("form")}><Plus size={18} aria-hidden="true" />{text("New task", "Công việc mới")}</Button>
            <Button onClick={() => setDialog("confirm")}>{text("Open confirmation", "Mở xác nhận")}</Button>
        </FloatingActions>
        {dialog === "form" && <FormDialog title={text("New task", "Công việc mới")} text={text} onClose={() => setDialog(null)} onSubmit={form => {
            setMessage(text("Created: ", "Đã tạo: ") + new FormData(form).get("title"));
            setDialog(null);
        }}><TextField label={text("Task title", "Tên công việc")} name="title" required /><Field label={text("Description", "Mô tả")}><Textarea name="description" /></Field></FormDialog>}
        {dialog === "confirm" && <Confirm title={text("Delete this example?", "Xóa mục mẫu này?")} text={text} danger onClose={() => setDialog(null)} onConfirm={() => {
            setMessage(text("Example deleted.", "Đã xóa mục mẫu.")); setDialog(null);
        }}><p>{text("This demonstrates the shared confirmation dialog.", "Đây là hộp thoại xác nhận dùng chung.")}</p></Confirm>}
    </main>;
}
