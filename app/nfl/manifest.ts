import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "NULLWORKS NFL Feed App", short_name: "NFL Feed", description: "NULLWORKS NFL sports intelligence beta", start_url: "/nfl?view=app", display: "standalone", background_color: "#05070a", theme_color: "#05070a", icons: [{ src: "/sports-icon.svg", sizes: "any", type: "image/svg+xml" }] };
}
