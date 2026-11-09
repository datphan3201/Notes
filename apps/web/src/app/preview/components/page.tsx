import ComponentLibrary from "@/components/component-library";
import { guestLanguage, type GuestParams } from "@/lib/auth-flow";
import "@/styles/tasks-preview.css";
import "@/styles/full-preview.css";
import "@/styles/component-library.css";

export default async function Page({ searchParams }: { searchParams: GuestParams }) {
    return <ComponentLibrary initialLocale={(await guestLanguage(searchParams)) || "en"} />;
}
