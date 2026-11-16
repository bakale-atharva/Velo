import { clerkMiddleware } from "@clerk/nextjs/server";

// Paths anyone may open. Everything else needs a signed-in user.
const PUBLIC_PREFIXES = ["/sign-in", "/sign-up", "/onboarding", "/dev"];

function isPublic(pathname: string): boolean {
  return (
    pathname === "/" ||
    PUBLIC_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  );
}

export default clerkMiddleware(
  async (auth, req) => {
    if (!isPublic(req.nextUrl.pathname)) {
      await auth.protect();
    }
  },
  {
    // `/<orgSlug>/...` makes that organization active. If the user is not a
    // member, the active org is left unchanged and the workspace layout
    // shows not-found.
    organizationSyncOptions: {
      organizationPatterns: ["/:slug", "/:slug/(.*)"],
    },
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
