import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "NULLWORKS NPB Feed App", short_name: "NPB Feed", description: "NULLWORKS NPB sports intelligence beta", start_url: "/npb?view=app", display: "standalone", background_color: "#05070a", theme_color: "#05070a", icons: [{ src: "/sports-icon.svg", sizes: "any", type: "image/svg+xml" }] };
}
