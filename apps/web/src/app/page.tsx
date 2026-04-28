"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    apiGet<{ needsSetup: boolean }>("/api/setup/status")
      .then((res) => {
        if (res.needsSetup) {
          router.replace("/setup");
        } else {
          router.replace("/dashboard");
        }
      })
      .catch(() => {
        router.replace("/login");
      })
      .finally(() => setChecked(true));
  }, [router]);

  if (!checked) return null;
  return null;
}
