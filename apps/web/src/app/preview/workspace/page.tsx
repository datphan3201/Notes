import { previewSections } from "@/components/preview/shared";
import WorkspacePreview from "@/components/preview/workspace";
import { guestLanguage } from "@/lib/auth-flow";
import "@/styles/workspace-preview.css";
import "@/styles/dashboard-preview.css";
import "@/styles/tasks-preview.css";
import "@/styles/full-preview.css";

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{
        lang?: string | string[];
        section?: string | string[];
    }>;
}) {
    const params = await searchParams;
    return (
        <WorkspacePreview
            initialLocale={(await guestLanguage(searchParams)) || "vi"}
            initialSection={
                typeof params.section === "string" &&
                previewSections.includes(params.section)
                    ? params.section
                    : "dashboard"
            }
        />
    );
}
