import { clerkMiddleware } from "@clerk/astro/server";
import { sequence } from "astro:middleware";
import { legacyHostRedirect } from "./lib/domain-redirect";

// Domain cutover 2026-08-24 (captain decision): codevex.app is the commercial
// domain; phillias.us traffic 301s to the same path on codevex.app.
// See src/lib/domain-redirect.ts for the loop-safety rationale and unit-tested
// helpers.

// Clerk v4 injects `locals.auth`; read it in pages via `Astro.locals.auth`.
// Requires PUBLIC_CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY at runtime.
const clerk = clerkMiddleware((auth, context) => {
  const { userId } = auth();
  if (context.url.pathname.startsWith("/app") && !userId) {
    return context.redirect("/sign-in");
  }
});

export const onRequest = sequence(legacyHostRedirect, clerk);
