"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { safeRedirect } from "~/lib/utils";

function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Sanitised rather than trusted: this value has been out to a third-party
  // provider and back, so it arrives as untrusted input.
  const redirectTo = safeRedirect(searchParams.get("redirect"));

  useEffect(() => {
    document.cookie = `cf_session=1; path=/; max-age=${60 * 60 * 24 * 7}; secure; samesite=lax`;
    router.replace(redirectTo);
  }, [router, redirectTo]);

  return null;
}

export default function AuthCallbackPage() {
  // `useSearchParams` needs a Suspense boundary to prerender.
  return (
    <Suspense fallback={null}>
      <AuthCallback />
    </Suspense>
  );
}
