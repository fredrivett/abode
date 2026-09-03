import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/app";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: "Your digital home",
    start_url: "/",
    display: "standalone",
    background_color: "#1f1f1f",
    theme_color: "#1f1f1f",
    // Registers abode in the Android share sheet (iOS Safari doesn't support
    // share_target — covered there by the "Save to abode" Shortcut instead)
    share_target: {
      action: "/save",
      method: "GET",
      params: {
        url: "url",
        text: "text",
        title: "title",
      },
    },
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
