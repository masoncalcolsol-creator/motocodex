import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "NULLWORKS NHL Feed App", short_name: "NHL Feed", description: "NULLWORKS NHL sports intelligence beta", start_url: "/nhl?view=app", display: "standalone", background_color: "#05070a", theme_color: "#05070a", icons: [{ src: "/sports-icon.svg", sizes: "any", type: "image/svg+xml" }] };
}
