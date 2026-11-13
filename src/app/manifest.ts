import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** Lets visitors add NEA to their home screen, so the Skin Diary and Glow Club open like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.shortName,
    description: site.promise,
    start_url: "/",
    display: "standalone",
    background_color: "#fdfbfc",
    theme_color: "#fdfbfc",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
