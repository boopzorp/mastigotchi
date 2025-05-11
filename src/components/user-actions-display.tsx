
"use client";

import type { UserAction, UserActionOption } from "@/config/userActions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThumbsUp, ThumbsDown, HelpCircle } from "lucide-react"; // Example icons

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
    <div className="mt-6 w-full max-w-lg space-y-4">
      <h3 className="text-xl font-semibold text-center text-foreground">Daily Check-ins for {petName}</h3>
      {actions.map((action) => {
        const { canPerform, countToday } = getActionState(action.id);
        const IconComponent = action.icon || HelpCircle;

        return (
          <Card key={action.id} className="bg-card/70 shadow-md">
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-md flex items-center">
                <IconComponent size={20} className="mr-2 text-primary shrink-0" />
                {action.question}
              </CardTitle>
              <CardDescription className="text-xs">
                Can perform: {action.frequencyPerDay - countToday} more time(s) today.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-around gap-2 pb-4">
              <Button
                onClick={() => onActionInteract(action.id, action.yesOption, 'yes')}
                disabled={!canPerform}
                variant="outline"
                className="flex-1 bg-green-100 hover:bg-green-200 dark:bg-green-800 dark:hover:bg-green-700 border-green-300 dark:border-green-600 text-green-700 dark:text-green-200"
              >
                <ThumbsUp size={16} className="mr-2" />
                {action.yesOption.text}
              </Button>
              <Button
                onClick={() => onActionInteract(action.id, action.noOption, 'no')}
                disabled={!canPerform}
                variant="outline"
                className="flex-1 bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 border-red-300 dark:border-red-600 text-red-700 dark:text-red-200"
              >
                <ThumbsDown size={16} className="mr-2" />
                {action.noOption.text}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
