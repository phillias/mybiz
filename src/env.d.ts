/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Injected by Clerk middleware (@clerk/astro v4) */
    auth?: { userId: string | null };
  }
}