import type { LucideIcon } from "lucide-react";

export interface UserActionOption {
  text: string;
  happinessChange: number;
  popupMessage?: string;
}

export interface UserAction {
  id: string;
  question: string;
  frequencyPerDay: number;
  yesOption: UserActionOption;
  noOption: UserActionOption;
  icon?: LucideIcon; 
}

export const USER_ACTIONS: UserAction[] = [
  {
    id: "drinkWater",
    question: "Did you drink water?",
    frequencyPerDay: 3,
    yesOption: { text: "Yes!", happinessChange: 5 },
    noOption: { text: "Not yet", happinessChange: -10 },
    // icon: Droplets, 
  },
  {
    id: "eatenWell",
    question: "Are you hungry but still haven't eaten?",
    frequencyPerDay: 2,
    yesOption: { text: "Yes, I am", happinessChange: -10 }, 
    noOption: { text: "No, I'm good", happinessChange: 7 },    
  },
  {
    id: "proudOfYou",
    question: "I am proud of you. You do know that right!?",
    frequencyPerDay: 5,
    yesOption: { text: "Yes, I do!", happinessChange: 10 },
    noOption: { 
      text: "No, I am overwhelmed", 
      happinessChange: -15, 
      popupMessage: "{PET_NAME} is here for you. Gentle headpats... everything will be okay." 
    },
  },
];
