import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finax",
    short_name: "Finax",
    description: "Finanças pessoais com clareza.",
    start_url: "/home",
    display: "standalone",
    background_color: "#f6f5f1",
    theme_color: "#131418",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
