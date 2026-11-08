import { notFound } from "next/navigation";
import Workspace from "@/components/workspace";

const sections = [
    "admin",
    "dashboard",
    "help",
    "notes",
    "goals",
    "tasks",
    "habits",
    "calendar",
    "reviews",
    "settings",
];
export default async function Page({
    params,
}: {
    params: Promise<{ section: string }>;
}) {
    const { section } = await params;
    if (!sections.includes(section)) notFound();
    return <Workspace section={section} />;
}
