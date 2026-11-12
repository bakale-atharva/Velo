import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
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
  title: "Velo",
  description: "Issue tracking that moves as fast as your team ships. Inspired by Sonny Sangha. Built using Claude.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          <header className="flex h-14 items-center justify-end gap-3 px-6 text-sm font-medium">
            <Suspense>
              <Show when="signed-out">
                <SignInButton>
                  <button className="h-9 cursor-pointer rounded-full border border-black/[.08] px-4 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]">
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton>
                  <button className="h-9 cursor-pointer rounded-full bg-foreground px-4 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]">
                    Sign up
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </Suspense>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
