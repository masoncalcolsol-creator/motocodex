import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "NULLWORKS UFC Feed App", short_name: "UFC Feed", description: "NULLWORKS UFC sports intelligence beta", start_url: "/ufc?view=app", display: "standalone", background_color: "#05070a", theme_color: "#05070a", icons: [{ src: "/sports-icon.svg", sizes: "any", type: "image/svg+xml" }] };
}
