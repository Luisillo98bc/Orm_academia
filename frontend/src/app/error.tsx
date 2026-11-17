"use client";

import { useEffect } from "react";

import { RecoveryScreen } from "@/components/system/recovery-screen";

export default function ErrorPage({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  retry?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <RecoveryScreen
      kind="error"
      onRetry={retry ?? reset}
      reference={error.digest}
    />
  );
}
