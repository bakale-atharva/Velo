"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Light/dark theme (the `.dark` class on <html>; Velo is dark first, the
 * member can pick light or system), and Convex authenticated with the Clerk
 * session (token audience "convex").
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <TooltipProvider>{children}</TooltipProvider>
      </ConvexProviderWithClerk>
    </ThemeProvider>
  );
}
