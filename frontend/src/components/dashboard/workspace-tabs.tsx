"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function WorkspaceTabs({ label, tabs, defaultValue }: {
  label: string;
  tabs: { id: string; label: string; count?: number; content: ReactNode }[];
  defaultValue?: string;
}) {
  const id = useId();
  const [selected, setSelected] = useState(defaultValue || tabs[0]?.id);
  return <div className="space-y-5 min-w-0">
    <div role="tablist" aria-label={label} className="workspace-tabs">
      {tabs.map((tab, index) => <button key={tab.id} type="button" role="tab"
        id={`${id}-tab-${tab.id}`} aria-controls={`${id}-panel-${tab.id}`}
        aria-selected={selected === tab.id} tabIndex={selected === tab.id ? 0 : -1}
        onClick={() => setSelected(tab.id)}
        onKeyDown={(event) => {
          let next = index;
          if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
          else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = tabs.length - 1;
          else return;
          event.preventDefault();
          setSelected(tabs[next].id);
          document.getElementById(`${id}-tab-${tabs[next].id}`)?.focus();
        }} className={cn("workspace-tab", selected === tab.id && "workspace-tab-active")}>
        {tab.label}{tab.count !== undefined && <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums">{tab.count}</span>}
      </button>)}
    </div>
    {tabs.map(tab => <div key={tab.id} role="tabpanel" id={`${id}-panel-${tab.id}`}
      aria-labelledby={`${id}-tab-${tab.id}`} hidden={selected !== tab.id} tabIndex={0}
      className="min-w-0 space-y-5 focus-visible:outline-2 focus-visible:outline-ring">{selected === tab.id && tab.content}</div>)}
  </div>;
}

export function SummaryStrip({ items, label = "Resumen" }: {
  items: { label: string; value: ReactNode; detail?: string }[]; label?: string;
}) {
  return <dl aria-label={label} className="summary-strip">{items.map(item => <div key={item.label} className="min-w-0 px-5 py-4">
    <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
    <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{item.value}</dd>
    {item.detail && <dd className="mt-1 text-xs text-muted-foreground">{item.detail}</dd>}
  </div>)}</dl>;
}
