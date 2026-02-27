import "./globals.css";

export const metadata = {
  title: "MotoCODEX",
  description: "MotoINTELLIGENCE feed console",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
