import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { auth } from "@/auth";
import { Providers } from "@/components/Providers";
import { SignOutButton } from "@/components/SignOutButton";
import { dashboardPathForRole } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Nutradietics",
  description:
    "A marketplace connecting clients with nutritionists and fitness trainers.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en">
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
                  <Link href="/signup">Sign up</Link>
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
