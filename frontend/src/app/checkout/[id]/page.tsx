"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { trackConversion } from "@/lib/analytics";

export default function LegacyCheckoutRedirect() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !params.id) return;
    if (user) {
      trackConversion("CHECKOUT_STARTED", { cohortId: params.id, metadata: { source: "legacy_redirect" } });
      router.replace(`/dashboard/checkout?cohortId=${params.id}`);
    } else {
      trackConversion("REGISTRATION_STARTED", { cohortId: params.id, metadata: { source: "legacy_redirect" } });
      router.replace(`/register?cohortId=${params.id}`);
    }
  }, [isLoading, params.id, router, user]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      Preparando tu inscripción…
    </div>
  );
}
