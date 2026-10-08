"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Unknown routes go to the landing page (§2). */
export default function NotFound() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
