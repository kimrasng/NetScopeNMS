import type React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export interface SkeletonLoaderProps {
  variant?: "card" | "table" | "chart";
  count?: number;
  className?: string;
}

function SkeletonPulse({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("rounded bg-muted animate-pulse", className)} style={style} />;
}

function CardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonPulse className="h-3 w-1/3" />
          <SkeletonPulse className="h-3 w-12" />
        </div>
        <SkeletonPulse className="h-8 w-2/3" />
        <SkeletonPulse className="h-3 w-1/2" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <div className="p-1">
        <div className="flex gap-4 px-3 py-2.5 border-b">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonPulse key={i} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-3 py-3 border-b last:border-0">
            {Array.from({ length: 5 }).map((_, j) => (
              <SkeletonPulse
                key={j}
                className="h-3 flex-1"
                style={{ width: `${50 + Math.random() * 40}%` } as React.CSSProperties}
              />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonPulse className="h-3 w-24" />
          <SkeletonPulse className="h-3 w-16" />
        </div>
        <div className="flex items-end gap-1.5 h-32">
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonPulse
              key={i}
              className="flex-1 rounded-t"
              style={{ height: `${20 + Math.random() * 80}%` }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function SkeletonLoader({ variant, count = 1, className }: SkeletonLoaderProps) {
  if (!variant) {
    return <SkeletonPulse className={cn("h-4", className)} />;
  }

  const items = Array.from({ length: count });

  const Skeleton =
    variant === "card"
      ? CardSkeleton
      : variant === "table"
        ? TableSkeleton
        : ChartSkeleton;

  return (
    <div className={cn(variant === "card" && count > 1 && "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3", className)}>
      {items.map((_, i) => (
        <Skeleton key={i} />
      ))}
    </div>
  );
}
