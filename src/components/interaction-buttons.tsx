"use client";

import { Button } from "@/components/ui/button";
import { Utensils, Gamepad2, ShowerHead, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface InteractionButtonProps {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
}

function ActionButton({ label, icon: Icon, onClick, disabled }: InteractionButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 transform transition-transform duration-150 ease-in-out hover:scale-105 active:scale-95 shadow-md"
      aria-label={label}
    >
      <Icon className="mr-2 h-5 w-5" />
      {label}
    </Button>
  );
}

interface InteractionButtonsProps {
  onFeed: () => void;
  onPlay: () => void;
  onClean: () => void;
  isLoading: boolean;
  className?: string;
}

export function InteractionButtons({
  onFeed,
  onPlay,
  onClean,
  isLoading,
  className,
}: InteractionButtonsProps) {
  return (
    <div className={cn("grid grid-cols-3 gap-3 w-full p-4 bg-card/30 rounded-lg shadow", className)}>
      <ActionButton label="Feed" icon={Utensils} onClick={onFeed} disabled={isLoading} />
      <ActionButton label="Play" icon={Gamepad2} onClick={onPlay} disabled={isLoading} />
      <ActionButton label="Clean" icon={ShowerHead} onClick={onClean} disabled={isLoading} />
    </div>
  );
}
