"use client";

import type { UserAction, UserActionOption } from "@/config/userActions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThumbsUp, ThumbsDown, HelpCircle } from "lucide-react"; 

interface UserActionsDisplayProps {
  actions: UserAction[];
  onActionInteract: (actionId: string, option: UserActionOption, choiceKey: 'yes' | 'no') => void;
  getActionState: (actionId: string) => { countToday: number; canPerform: boolean };
  petName: string;
}

export function UserActionsDisplay({ actions, onActionInteract, getActionState, petName }: UserActionsDisplayProps) {
  if (!actions || actions.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 sm:mt-6 w-full max-w-lg space-y-3 sm:space-y-4">
      <h3 className="text-lg sm:text-xl font-semibold text-center text-foreground">Daily Check-ins for {petName}</h3>
      {actions.map((action) => {
        const { canPerform, countToday } = getActionState(action.id);
        const IconComponent = action.icon || HelpCircle;

        return (
          <Card key={action.id} className="bg-card/70 shadow-md">
            <CardHeader className="pb-2 sm:pb-3 pt-3 sm:pt-4 px-3 sm:px-4">
              <CardTitle className="text-sm sm:text-base flex items-center">
                <IconComponent size={18} className="mr-2 text-primary shrink-0 sm:size-20" />
                {action.question}
              </CardTitle>
              <CardDescription className="text-xs sm:text-xs">
                Can perform: {action.frequencyPerDay - countToday} more time(s) today.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-around gap-2 px-3 sm:px-4 pb-3 sm:pb-4">
              <Button
                onClick={() => onActionInteract(action.id, action.yesOption, 'yes')}
                disabled={!canPerform}
                variant="outline"
                className="flex-1 border-primary/50 text-primary hover:bg-primary/10 focus:ring-primary text-xs sm:text-sm py-1.5 sm:py-2 h-auto"
              >
                <ThumbsUp size={14} className="mr-1 sm:mr-2 sm:size-16" />
                {action.yesOption.text}
              </Button>
              <Button
                onClick={() => onActionInteract(action.id, action.noOption, 'no')}
                disabled={!canPerform}
                variant="outline"
                className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10 focus:ring-destructive text-xs sm:text-sm py-1.5 sm:py-2 h-auto"
              >
                <ThumbsDown size={14} className="mr-1 sm:mr-2 sm:size-16" />
                {action.noOption.text}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
