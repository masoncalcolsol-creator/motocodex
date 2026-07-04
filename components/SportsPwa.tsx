"use client";

import { useEffect } from "react";

export function SportsPwa({ slug }: { slug: string }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sports-sw.js", { scope: `/${slug}/` }).catch(() => undefined);
    }
  }, [slug]);
  return null;
}
