
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
  icon?: React.ElementType; // Optional: for a themed icon next to the action
}

export const USER_ACTIONS: UserAction[] = [
  {
    id: "drinkWater",
    question: "Did you drink water?",
    frequencyPerDay: 3,
    yesOption: { text: "Yes!", happinessChange: 5 },
    noOption: { text: "Not yet", happinessChange: -10 },
    // icon: Droplets, // Example if you want to use lucide icons
  },
  {
    id: "eatenWell",
    question: "Are you hungry but still haven't eaten?",
    frequencyPerDay: 2,
    yesOption: { text: "Yes, I am", happinessChange: -10 }, // User admits they are hungry & haven't eaten
    noOption: { text: "No, I'm good", happinessChange: 7 },    // User says they are not hungry / have eaten
  },
  {
    id: "proudOfYou",
    question: "I am proud of you. You do know that right!?",
    frequencyPerDay: 5,
    yesOption: { text: "Yes, I do!", happinessChange: 10 },
    noOption: { 
      text: "No, I am overwhelmed", 
      happinessChange: -15, 
      popupMessage: " gentle headpats... everything will be okay. "
    },
  },
];
