import { notFound } from "next/navigation";
import AccountAction from "@/components/account-action";
import { guestLanguage, type GuestParams } from "@/lib/auth-flow";
export default async function Page({
    params,
    searchParams,
}: {
    params: Promise<{ action: string }>;
    searchParams: GuestParams;
}) {
    const { action } = await params;
    if (action !== "recover" && action !== "reset" && action !== "verify")
        notFound();
    return (
        <AccountAction
            action={action}
            initialLocale={await guestLanguage(searchParams)}
        />
    );
}
