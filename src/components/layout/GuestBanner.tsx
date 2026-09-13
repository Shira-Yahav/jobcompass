"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

/**
 * Shown only to anonymous (guest) sessions. Lets them upgrade to a real
 * Google account in place — same auth.uid(), so their profile and
 * research history carry over instead of starting fresh.
 */
export function GuestBanner() {
  const supabase = createClient();
  const [isGuest, setIsGuest] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsGuest(!!user?.is_anonymous);
    });
  }, [supabase]);

  async function handleSave() {
    setLinking(true);
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      toast.error(error.message);
      setLinking(false);
    }
    // On success, browser redirects to Google — no need to reset state
  }

  if (!isGuest) return null;

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-800">
      <span>You&apos;re exploring as a guest — your work here isn&apos;t tied to an account yet.</span>
      <button
        onClick={handleSave}
        disabled={linking}
        className="shrink-0 rounded-md bg-amber-600 px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
      >
        {linking ? "Redirecting…" : "Save with Google"}
      </button>
    </div>
  );
}
