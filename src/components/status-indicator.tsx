
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
  let progressColorClass = "bg-primary"; // Default green (theme primary)
  if (value < 30) {
    progressColorClass = "bg-destructive"; // Red for low status (theme destructive)
  } else if (value < 60) {
    // Using a CSS variable for medium status that can be themed
    // We'll assume --warning or similar could be added to globals.css if needed,
    // or use accent for now.
    // For now, let's use a slightly less vibrant primary or a specific theme variable if available.
    // Using accent for medium status, which is light pastel green by default.
    progressColorClass = "bg-accent-foreground"; // Or another theme color like 'bg-secondary' or 'bg-yellow-500' if defined in theme
                                          // For now, choosing accent-foreground which is a darker green on the light green accent
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
      <Progress 
        value={value} 
        aria-label={`${label} level: ${value}%`} 
        className="h-3 [&>div]:transition-all [&>div]:duration-500" 
        indicatorClassName={progressColorClass} 
      />
    </div>
  );
}
