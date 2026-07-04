import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "NULLWORKS MLB Feed App", short_name: "MLB Feed", description: "NULLWORKS MLB sports intelligence beta", start_url: "/mlb?view=app", display: "standalone", background_color: "#05070a", theme_color: "#05070a", icons: [{ src: "/sports-icon.svg", sizes: "any", type: "image/svg+xml" }] };
}
