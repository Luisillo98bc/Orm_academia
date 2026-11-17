"use client";

import { useEffect } from "react";

import { RecoveryScreen } from "@/components/system/recovery-screen";
import styles from "@/components/system/recovery-screen.module.css";
import "./globals.css";

export default function GlobalError({
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
    <html lang="es" className={styles.document}>
      <head>
        <title>Pausa técnica | Academia Virtual</title>
      </head>
      <body className={styles.documentBody}>
        <RecoveryScreen
          kind="error"
          onRetry={retry ?? reset}
          reference={error.digest}
          standalone
        />
      </body>
    </html>
  );
}
