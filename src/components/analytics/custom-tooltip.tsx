"use client";

import React from "react";
import { formatCurrency } from "@/lib/utils";

interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  dataKey?: string;
  color?: string;
  fill?: string;
  payload?: Record<string, unknown>;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  formatterType?: "currency" | "count" | "amountInLakhs" | "percentage" | "mixed";
  valueLabel?: string;
}

export function AnalyticsCustomTooltip({
  active,
  payload,
  label,
  formatterType = "mixed",
  valueLabel,
}: CustomTooltipProps) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const firstItem = payload[0];
  const payloadData = firstItem.payload || {};

  const formatValue = (key: string | undefined, val: unknown) => {
    const num = typeof val === "number" ? val : Number(val) || 0;

    if (key === "amount" || formatterType === "currency") {
      return formatCurrency(num);
    }
    if (key === "amountInLakhs" || formatterType === "amountInLakhs") {
      return `₹${num.toLocaleString("en-IN")} L`;
    }
    if (key === "amountInCrores") {
      return `₹${num.toLocaleString("en-IN")} Cr`;
    }
    if (key === "percentage" || formatterType === "percentage") {
      return `${num}%`;
    }
    if (key === "applications" || key === "count" || formatterType === "count") {
      return `${num.toLocaleString("en-IN")} apps`;
    }
    return String(val);
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card/95 p-3 shadow-xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/10 text-xs min-w-[180px] animate-in fade-in-50 zoom-in-95 duration-100">
      {label && (
        <div className="pb-1.5 mb-2 border-b border-border/50 font-semibold text-foreground tracking-tight">
          {label}
        </div>
      )}
      <div className="space-y-1.5">
        {payload.map((item, idx) => {
          const itemColor = item.color || item.fill || "hsl(var(--primary))";
          const dataKey = item.dataKey || "";
          const name = valueLabel || item.name || dataKey;
          const displayVal = formatValue(dataKey, item.value);

          return (
            <div key={`${dataKey}-${idx}`} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: itemColor }}
                />
                <span className="text-muted-foreground capitalize">
                  {name.replace(/([A-Z])/g, " $1").toLowerCase()}
                </span>
              </div>
              <span className="font-bold text-foreground tabular-nums">
                {displayVal}
              </span>
            </div>
          );
        })}

        {/* If payloadData contains extra metadata like branchName, show it */}
        {Boolean(payloadData.branchName) && payloadData.branchName !== label && (
          <div className="mt-1 pt-1 border-t border-border/40 text-[10px] text-muted-foreground">
            Branch: <span className="font-medium text-foreground">{String(payloadData.branchName)}</span>
          </div>
        )}

        {/* If payload has both applications and amount, show total volume */}
        {payloadData.amount !== undefined && !payload.some((p) => p.dataKey === "amount") && (
          <div className="mt-1 pt-1 border-t border-border/40 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Total Vol:</span>
            <span className="font-semibold text-primary tabular-nums">
              {formatCurrency(Number(payloadData.amount))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
