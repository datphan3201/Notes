import { redirectSignedIn } from "@/lib/guest-page";
import AuthForm from "@/components/auth-form";
import { guestLanguage, type GuestParams } from "@/lib/auth-flow";
export default async function Page({
    searchParams,
}: {
    searchParams: GuestParams;
}) {
    await redirectSignedIn();
    return (
        <AuthForm
            mode="register"
            initialLocale={await guestLanguage(searchParams)}
        />
    );
}
