"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MentiIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/menti");
  }, [router]);

  return null;
}
