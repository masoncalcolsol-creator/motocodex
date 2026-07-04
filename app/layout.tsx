import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MotoCODEX | MotoINTELLIGENCE",
    template: "%s | MotoINTELLIGENCE",
  },
  description:
    "MotoCODEX news intelligence, MotoFEEDS social signal, and MOTOPEDIA historical motocross memory.",
  metadataBase: new URL("https://motocodex.vercel.app"),
  openGraph: {
    title: "MotoCODEX | MotoINTELLIGENCE",
    description:
      "One operating layer for motocross news, social signal, results, riders, seasons, standings, and historical provenance.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
