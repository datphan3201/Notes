import AccountAction from "@/components/account-action";
import { guestLanguage, type GuestParams } from "@/lib/auth-flow";
export default async function Page({
    searchParams,
}: {
    searchParams: GuestParams;
}) {
    return (
        <AccountAction
            action="verify"
            initialLocale={await guestLanguage(searchParams)}
        />
    );
}
