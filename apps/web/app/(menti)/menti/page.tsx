"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MentiIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/menti/demo-pres-1/edit");
  }, [router]);

  return null;
}
