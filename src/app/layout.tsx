import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nutradietics",
  description:
    "A marketplace connecting clients with nutritionists and fitness trainers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <Link href="/" className="app-header__brand">
            Nutradietics
          </Link>
        </header>
        <div className="app-main">{children}</div>
      </body>
    </html>
  );
}
