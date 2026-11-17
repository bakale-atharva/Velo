"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { TooltipProvider } from "@/components/ui/tooltip";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/** Convex authenticated with the Clerk session (token audience "convex"). */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <TooltipProvider>{children}</TooltipProvider>
    </ConvexProviderWithClerk>
  );
}
