import type { Metadata } from "next";
import "@fontsource/be-vietnam-pro/latin-400.css";
import "@fontsource/be-vietnam-pro/vietnamese-400.css";
import "@fontsource/be-vietnam-pro/latin-500.css";
import "@fontsource/be-vietnam-pro/vietnamese-500.css";
import "@fontsource/be-vietnam-pro/latin-600.css";
import "@fontsource/be-vietnam-pro/vietnamese-600.css";
import "./globals.css";
import "../styles/baseline/app.css";
import "../styles/parity.css";
import "../styles/auth.css";
import "../styles/workspace-preview.css";
import "../styles/dashboard-preview.css";
import "../styles/activity.css";

export const metadata: Metadata = {
    title: "Planner — Personal AI Planner",
    description: "A calm space for your notes, goals and daily plans.",
};

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="vi">
            <body>{children}</body>
        </html>
    );
}
