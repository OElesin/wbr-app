import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NextAuthProvider from "@/components/auth/NextAuthProvider";
import Link from 'next/link'; // Import Link
import SignInButton from "@/components/auth/SignInButton"; // Import SignInButton
import SignOutButton from "@/components/auth/SignOutButton"; // Import SignOutButton
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
  title: "WBR App", // Updated title
  description: "Weekly Business Review Platform", // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`} // Ensure font-sans is applied if Geist is similar to Inter
      >
        <NextAuthProvider>
          <header className="bg-slate-800 text-white p-4 shadow-md">
            <nav className="container mx-auto flex justify-between items-center">
              <Link href="/" className="text-xl font-bold hover:text-slate-300">
                WBR App
              </Link>
              <div className="flex items-center space-x-4">
                {/* Example of how to conditionally render SignOutButton or SignInButton */}
                {/* A more robust solution would use useSession in a client component here */}
                <SignOutButton />
                {/* <SignInButton /> */}
                 {/* You'll likely want a client component here to check session status
                     and display SignIn or SignOut appropriately, or user info.
                     For now, including both and relying on their internal logic.
                     A cleaner approach is a dedicated NavAuthControls component.
                 */}
              </div>
            </nav>
          </header>
          <main className="container mx-auto p-4">
            {children}
          </main>
          <footer className="bg-slate-100 text-slate-600 text-center p-4 mt-8 border-t border-slate-300">
            <p>&copy; {new Date().getFullYear()} WBR App. All rights reserved.</p>
          </footer>
        </NextAuthProvider>
      </body>
    </html>
  );
}
