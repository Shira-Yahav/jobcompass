import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase browser client — used in Client Components.
 * Safe to call multiple times; SSR package memoizes the instance.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
