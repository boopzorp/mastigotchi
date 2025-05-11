"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface StatusIndicatorProps {
  label: string;
  value: number; // 0-100
  icon: React.ReactNode;
  className?: string;
}

export function StatusIndicator({ label, value, icon, className }: StatusIndicatorProps) {
  let progressColorClass = "bg-primary"; // Default green
  if (value < 30) {
    progressColorClass = "bg-destructive"; // Red for low status
  } else if (value < 60) {
    progressColorClass = "bg-yellow-500"; // Yellow for medium status - Note: Using a direct Tailwind color here as an example if not in theme
  }


  return (
    <div className={cn("w-full p-3 bg-card/50 rounded-lg shadow", className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-lg text-foreground">{icon}</span>
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <span className="text-sm font-semibold text-foreground">{value}%</span>
      </div>
      <Progress value={value} aria-label={`${label} level: ${value}%`} className="h-3 [&>div]:transition-all [&>div]:duration-500" indicatorClassName={progressColorClass} />
    </div>
  );
}
