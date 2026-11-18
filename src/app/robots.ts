import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const privatePaths = ["/api/", "/account", "/staff-portal"];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: privatePaths },
      // Explicitly welcome AI answer engines (GEO), but keep them out of private pages too.
      { userAgent: ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended", "Bingbot"], allow: "/", disallow: privatePaths },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
