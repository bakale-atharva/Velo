import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Figtree, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// Soft geometric grotesk for all UI text.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Clerk's components read Velo's tokens, so they follow the light/dark theme.
const CLERK_APPEARANCE = {
  variables: {
    colorBackground: "var(--popover)",
    colorForeground: "var(--foreground)",
    colorMutedForeground: "var(--muted-foreground)",
    colorPrimary: "var(--primary)",
    colorPrimaryForeground: "var(--primary-foreground)",
    colorInput: "var(--popover)",
    colorInputForeground: "var(--foreground)",
    colorNeutral: "var(--foreground)",
    colorDanger: "var(--destructive)",
    fontFamily: "var(--font-figtree)",
    borderRadius: "10px",
  },
};

export const metadata: Metadata = {
  title: "Velo",
  description: "Issue tracking that moves as fast as your team ships. Inspired by Sonny Sangha. Built using Claude.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the theme class on <html> before hydration.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${figtree.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider appearance={CLERK_APPEARANCE}>
          <Providers>{children}</Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
