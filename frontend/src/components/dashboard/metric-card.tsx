import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  detail?: string;
  icon: LucideIcon;
  tone?: "primary" | "success" | "warning" | "info";
}

const toneClasses = {
  primary: "text-primary bg-primary/10 border-primary/10",
  success: "text-accent bg-accent/10 border-accent/15",
  warning: "text-amber-600 bg-amber-500/10 border-amber-500/15 dark:text-amber-400",
  info: "text-primary bg-primary/10 border-primary/10",
};

export function MetricCard({ label, value, detail, icon: Icon, tone = "primary" }: MetricCardProps) {
  return (
    <div className="metric-card dashboard-panel group flex items-start justify-between gap-4 p-5 sm:p-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-2 text-[2rem] font-bold tracking-[-0.05em] text-foreground">{value}</p>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </div>
      <div className={`rounded-xl border p-2.5 ${toneClasses[tone]}`}><Icon className="h-5 w-5" aria-hidden="true" /></div>
    </div>
  );
}
