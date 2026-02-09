import "./globals.css";

export const metadata = {
  title: "MotoCodex",
  description: "All Moto No Fluff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "Arial, Helvetica, sans-serif",
          background: "#fff",
          color: "#000",
        }}
      >
        {children}
      </body>
    </html>
  );
}
