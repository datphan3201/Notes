import type { NextConfig } from "next";

const api = (process.env.API_ORIGIN || "http://127.0.0.1:8001")
    .trim()
    .replace(/\/+$/, "");
const upstream = new URL(api);
if (
    upstream.origin !== api ||
    upstream.username ||
    upstream.password ||
    !["http:", "https:"].includes(upstream.protocol)
) {
    throw new Error(
        "API_ORIGIN must be an exact HTTP(S) origin without credentials or paths",
    );
}
if (
    process.env.VERCEL === "1" &&
    (upstream.protocol !== "https:" ||
        ["localhost", "127.0.0.1", "[::1]"].includes(upstream.hostname))
) {
    throw new Error("Vercel requires a public HTTPS API_ORIGIN");
}
const developmentScripts =
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
const config: NextConfig = {
    distDir: process.env.PLANNER_DIST_DIR || ".next",
    allowedDevOrigins: JSON.parse(process.env.PLANNER_DEV_HOSTS || "[]"),
    poweredByHeader: false,
    async rewrites() {
        return [
            { source: "/api/v1/:path*", destination: `${api}/api/v1/:path*` },
        ];
    },
    async headers() {
        return [
            {
                source: "/:path*",
                headers: [
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "same-origin" },
                    {
                        key: "Content-Security-Policy",
                        value: `default-src 'self'; script-src 'self' 'unsafe-inline'${developmentScripts}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`,
                    },
                ],
            },
        ];
    },
};
export default config;
