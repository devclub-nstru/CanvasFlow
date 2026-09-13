"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { trpc } from "~/trpc/client";

export function EmailVerificationNotice() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();

  const verified = searchParams.get("verified");

  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!verified || handled.current === verified) return;
    handled.current = verified;

    if (verified === "1") {
      toast.success("Email address confirmed.");
      void utils.user.getMe.invalidate();
    } else if (verified === "invalid") {
      toast.error("That confirmation link has expired or was already used. Send a new one from your profile.");
    } else {
      toast.error("Something went wrong confirming your address. Try sending a new link from your profile.");
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete("verified");
    const query = next.toString();
    router.replace(query ? `${window.location.pathname}?${query}` : window.location.pathname, {
      scroll: false,
    });
  }, [verified, router, searchParams, utils]);

  return null;
}
