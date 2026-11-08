import AuthForm from "@/components/auth-form";
import { guestLanguage, type GuestParams } from "@/lib/auth-flow";
export default async function Page({
    searchParams,
}: {
    searchParams: GuestParams;
}) {
    return (
        <AuthForm
            mode="two-factor"
            initialLocale={await guestLanguage(searchParams)}
        />
    );
}
