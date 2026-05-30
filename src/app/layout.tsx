import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { SolutionProvider } from "@/lib/solution-store";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "parcie",
  description: "Pallet-packing workspace",
};

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/pallet", label: "Pallet" },
  { href: "/route", label: "Route" },
  { href: "/engine", label: "Engine" },
  { href: "/constraints", label: "Constraints" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-[var(--border)]">
          <nav className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-6 text-sm">
            <Link href="/" className="font-medium tracking-tight">
              parcie
            </Link>
            <div className="flex items-center gap-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <main className="flex-1">
          <SolutionProvider>{children}</SolutionProvider>
        </main>
      </body>
    </html>
  );
}
