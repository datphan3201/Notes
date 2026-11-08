import { notFound } from "next/navigation";
import Workspace from "@/components/workspace";

export default async function Page({ params }: { params: Promise<{ section: string; id: string }> }) {
    const { section, id } = await params;
    if (section === "settings" && ["profile", "preferences", "password", "notifications", "history", "archive", "reports"].includes(id)) {
        return <Workspace section="settings" setting={id} />;
    }
    if (section === "goals") return <Workspace section="roadmap" entityId={id} />;
    if (section === "tasks") return <Workspace section="task-detail" entityId={id} />;
    notFound();
}
