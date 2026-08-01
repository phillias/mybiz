import { clerkMiddleware } from "@clerk/astro/server";

// Clerk v4 injects `locals.auth`; read it in pages via `Astro.locals.auth`.
// Requires PUBLIC_CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY at runtime.
export const onRequest = clerkMiddleware((auth, context) => {
  const { userId } = auth();
  if (context.url.pathname.startsWith("/app") && !userId) {
    return context.redirect("/sign-in");
  }
});
