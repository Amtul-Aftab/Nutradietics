import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { auth } from "@/auth";
import { Providers } from "@/components/Providers";
import { SignOutButton } from "@/components/SignOutButton";
import { dashboardPathForRole } from "@/lib/routes";

export const metadata: Metadata = {
  title: {
    default: "Nutradietics",
    template: "%s · Nutradietics",
  },
  description:
    "A marketplace connecting clients with nutritionists and fitness trainers.",
  icons: {
    icon: "/icon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <header className="app-header">
            <Link href="/" className="app-header__brand">
              Nutradietics
            </Link>
            <nav className="app-header__nav">
              {session?.user ? (
                <>
                  <Link href={dashboardPathForRole(session.user.role)}>
                    Dashboard
                  </Link>
                  <SignOutButton />
                </>
              ) : (
                <>
                  <Link href="/signin">Sign in</Link>
                  <Link href="/signup">Get started</Link>
                </>
              )}
            </nav>
          </header>
          <div className="app-main">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
