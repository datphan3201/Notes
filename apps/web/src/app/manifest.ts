import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Personal AI Planner",
        short_name: "Planner",
        description: "Notes, goals and daily plans.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f3f7ff",
        theme_color: "#067287",
        icons: [
            {
                src: "/icon.svg",
                sizes: "any",
                type: "image/svg+xml",
                purpose: "any",
            },
        ],
    };
}
