
"use client";

import { useState, useEffect, useCallback, type FormEvent, useRef } from "react";
import Image from "next/image";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PetDisplay } from "@/components/pet-display";
import { StatusIndicator } from "@/components/status-indicator";
import { InteractionButtons } from "@/components/interaction-buttons";
import { UserActionsDisplay } from "@/components/user-actions-display";
import { USER_ACTIONS, type UserAction, type UserActionOption } from "@/config/userActions";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { petNeedsAssessment, PetNeedsAssessmentInput } from "@/ai/flows/pet-needs-assessment";
import { Apple, Smile, Droplets, LogOut, UserCircle, UserPlus, LogInIcon, PawPrint, BellRing } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth, type AuthUser } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot, Timestamp, collection, addDoc, query, limit, updateDoc } from "firebase/firestore";
import { PET_TYPES, type PetType } from "@/config/pets";
import { useBrowserNotifications } from "@/hooks/useBrowserNotifications";

const INITIAL_HUNGER = 60;
const INITIAL_HAPPINESS = 60;
const INITIAL_CLEANLINESS = 50;
const MAX_PETS = 2;

// New constants for server-side calculation
const STAT_DECREASE_INTERVAL_MINUTES_FOR_CALCULATION = 60; // 60 minutes
const STAT_DECREASE_PERCENT_PER_INTERVAL = 7; // 7 percent

const AI_COOLDOWN = 30000; // 30 seconds

const NOTIFICATION_CHECK_INTERVAL = 1800000; // Check every 30 minutes
const NOTIFICATION_PROBABILITY = 0.3; // 30% chance to send a notification per check if conditions met

const CRITICAL_STAT_NOTIFICATION_INTERVAL = 60 * 1000; // 1 minute
const BELOW_20_NOTIFICATION_COOLDOWN = 1 * 60 * 60 * 1000; // 1 hour
const BELOW_10_NOTIFICATION_CYCLE_COOLDOWN = 1 * 60 * 60 * 1000; // 1 hour (to restart a full 2-notification cycle if it dips again after this long)
const BELOW_10_SECOND_NOTIFICATION_DELAY = 20 * 60 * 1000; // 20 minutes


interface ActionState {
  countToday: number;
  lastPerformedDate: string; // YYYY-MM-DD
}
interface FirestorePetData {
  petName: string;
  selectedPetTypeId: string;
  hunger: number;
  happiness: number;
  cleanliness: number;
  lastUpdated: Timestamp;
  actionStates?: Record<string, ActionState>;
}

interface PetData extends FirestorePetData {
  id: string;
}

interface NotifiedActionState {
  notifiedTodayCount: number;
  lastNotifiedDate: string; // YYYY-MM-DD
}

// --- Top-level UI Component Definitions ---

interface AuthAreaProps {
  user: AuthUser | null;
  onSignOut: () => void;
  authLoading: boolean;
}

const AuthAreaComponent: React.FC<AuthAreaProps> = ({ user, onSignOut, authLoading }) => {
  if (!user) return null;
  return (
    <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
      <div className="flex items-center gap-2 bg-card p-2 rounded-lg shadow-md">
        {user.photoURL ?
          <Image src={user.photoURL} alt="User avatar" width={32} height={32} className="rounded-full" /> :
          <UserCircle size={24} className="text-foreground" />
        }
        <span className="text-xs sm:text-sm text-foreground hidden md:inline">{user.displayName || user.email}</span>
        <Button variant="outline" size="sm" onClick={onSignOut} disabled={authLoading}>
          <LogOut size={16} className="mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Sign Out</span>
          <span className="sm:hidden">Out</span>
        </Button>
      </div>
    </div>
  );
};

interface PetSelectionUIProps {
  petTypes: PetType[];
  onSelectSpecies: (petDefinition: PetType) => void;
  onCancel: () => void;
  userPetsCount: number;
  maxPets: number;
}

const PetSelectionUIComponent: React.FC<PetSelectionUIProps> = ({ petTypes, onSelectSpecies, onCancel, userPetsCount, maxPets }) => (
  <Card className="w-full max-w-md shadow-2xl rounded-xl overflow-hidden bg-card mt-4 sm:mt-8">
    <CardHeader className="text-center">
      <CardTitle className="text-xl sm:text-2xl font-bold">Choose Your mastigotchi!</CardTitle>
      <CardDescription className="text-xs sm:text-sm">Select a species for your new companion.</CardDescription>
    </CardHeader>
    <CardContent className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      {petTypes.map((petDef) => (
        <Button
          key={petDef.id}
          onClick={() => onSelectSpecies(petDef)}
          className="w-full justify-center py-4 sm:py-6 text-sm sm:text-lg h-auto flex-col items-center sm:flex-row sm:items-center sm:text-left"
          variant="outline"
          disabled={userPetsCount >= maxPets}
        >
          <Image
            src={petDef.images.default.url}
            alt={petDef.name}
            width={32}
            height={32}
            className="mb-2 sm:mb-0 sm:mr-4 rounded-md w-8 h-8 sm:w-10 sm:h-10"
            data-ai-hint={petDef.images.default.hint}
          />
          <span className="text-center sm:text-left">{petDef.name}</span>
        </Button>
      ))}
    </CardContent>
    <CardFooter className="p-4">
      <Button variant="ghost" onClick={onCancel} className="w-full">
        Cancel
      </Button>
    </CardFooter>
  </Card>
);

interface PetNamingUIProps {
  speciesForNaming: PetType | null;
  newPetNameInput: string;
  onNewPetNameInputChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onBackClick: () => void;
  isPetDataLoading: boolean;
}

const PetNamingUIComponent: React.FC<PetNamingUIProps> = ({
  speciesForNaming,
  newPetNameInput,
  onNewPetNameInputChange,
  onSubmit,
  onBackClick,
  isPetDataLoading,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: This effect should only run when speciesForNaming changes to focus the input.
  useEffect(() => {
    if (speciesForNaming && inputRef.current) {
      inputRef.current.focus();
    }
  }, [speciesForNaming]);

  if (!speciesForNaming) return null;

  return (
    <Card className="w-full max-w-md shadow-2xl rounded-xl overflow-hidden bg-card mt-4 sm:mt-8">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl font-bold text-center">Name Your New Pal!</CardTitle>
        <CardDescription className="text-center text-xs sm:text-sm">You've chosen a {speciesForNaming.name}. What will you call it?</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
          <Image
            src={speciesForNaming.images.default.url}
            alt={speciesForNaming.name}
            width={80}
            height={80}
            className="mx-auto rounded-md mb-3 sm:mb-4 w-20 h-20 sm:w-24 sm:h-24"
            data-ai-hint={speciesForNaming.images.default.hint}
          />
          <div>
            <Label htmlFor="petName" className="text-xs sm:text-sm">Pet's Name</Label>
            <Input
              ref={inputRef}
              id="petName"
              type="text"
              placeholder="e.g., Sparky"
              value={newPetNameInput}
              onChange={(e) => onNewPetNameInputChange(e.target.value)}
              required
              className="mt-1 text-sm sm:text-base"
              autoFocus
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between p-3 sm:p-4">
          <Button variant="ghost" type="button" onClick={onBackClick}>Back</Button>
          <Button type="submit" disabled={isPetDataLoading}>Adopt {newPetNameInput.trim() || speciesForNaming.defaultName || "Pal"}!</Button>
        </CardFooter>
      </form>
    </Card>
  );
};

interface PetSwitcherUIProps {
  userPets: PetData[];
  activePetId: string | null;
  onSwitchPet: (petId: string) => void;
}

const PetSwitcherUIComponent: React.FC<PetSwitcherUIProps> = ({ userPets, activePetId, onSwitchPet }) => {
  if (userPets.length <= 1) return null;
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {userPets.map(pet => (
        <Button
          key={pet.id}
          variant={pet.id === activePetId ? "default" : "outline"}
          onClick={() => onSwitchPet(pet.id)}
          size="sm"
          className="shadow-md text-xs sm:text-sm"
        >
          <PawPrint size={14} className="mr-1 sm:mr-2 sm:size-16" />
          {pet.petName}
        </Button>
      ))}
    </div>
  );
};


// --- Main Page Component ---
export default function PocketPalPage() {
  const { user, loading: authLoading, signInWithEmail, signUpWithEmail, signOut } = useAuth();
  const { toast } = useToast();
  const { permission: notificationPermission, isSupported: notificationsSupported, requestPermission: requestNotificationPermission, sendNotification } = useBrowserNotifications();

  const [userPets, setUserPets] = useState<PetData[]>([]);
  const [activePetId, setActivePetId] = useState<string | null>(null);
  
  const [petImage, setPetImage] = useState(PET_TYPES[0].images.default.url);
  const [petImageHint, setPetImageHint] = useState(PET_TYPES[0].images.default.hint);
  const [petMessage, setPetMessage] = useState("Welcome to mastigotchi!");
  
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [lastAiCallTimestamp, setLastAiCallTimestamp] = useState(0);
  const [isPetDataLoading, setIsPetDataLoading] = useState(true);
  
  const [showPetSelectionScreen, setShowPetSelectionScreen] = useState(false);
  const [isNamingPet, setIsNamingPet] = useState(false);
  const [speciesForNaming, setSpeciesForNaming] = useState<PetType | null>(null);
  const [newPetNameInput, setNewPetNameInput] = useState("");

  const [authAction, setAuthAction] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");

  const [notifiedActionStates, setNotifiedActionStates] = useState<Record<string, NotifiedActionState>>({});
  const notifiedActionStatesRef = useRef<Record<string, NotifiedActionState>>(notifiedActionStates);

  useEffect(() => {
    notifiedActionStatesRef.current = notifiedActionStates;
  }, [notifiedActionStates]);


  const currentActivePet = userPets.find(p => p.id === activePetId);
  const currentPetDefinition = currentActivePet ? PET_TYPES.find(pt => pt.id === currentActivePet.selectedPetTypeId) : null;
  const currentPetDisplayName = currentActivePet?.petName || "Your Pal";

  const saveSinglePetData = useCallback(async (petId: string, dataToUpdate: Partial<FirestorePetData>) => {
    if (user && user.uid && petId) {
      const petDocRef = doc(db, "users", user.uid, "pets", petId);
      try {
        await setDoc(petDocRef, { ...dataToUpdate, lastUpdated: Timestamp.now() }, { merge: true });
      } catch (error) {
        console.error("Error saving pet data:", error);
        toast({ title: "Error", description: "Could not save pet progress.", variant: "destructive" });
      }
    }
  }, [user, toast]);

  const updatePetVisualsAndMessage = useCallback(() => {
    if (!user) { 
         setPetImage(""); 
         setPetImageHint("");
         setPetMessage(""); 
         return;
      }

    if (showPetSelectionScreen) {
         setPetImage("");
         setPetImageHint("");
         setPetMessage("Choose your first mastigotchi!");
         return;
    }
    if (isNamingPet && speciesForNaming) {
        setPetImage(speciesForNaming.images.default.url);
        setPetImageHint(speciesForNaming.images.default.hint);
        setPetMessage(`What will you name your new ${speciesForNaming.name}?`);
        return;
    }

    if (!currentActivePet || !currentPetDefinition) {
        setPetImage(PET_TYPES[0].images.default.url); 
        setPetImageHint(PET_TYPES[0].images.default.hint);
        setPetMessage("Loading your Pal or adopt one!");
        return;
    }
    
    const images = currentPetDefinition.images;
    let finalImageSet = images.default; 
    let finalMessage = `${currentActivePet.petName} is doing okay.`; 

    const { hunger, happiness, cleanliness } = currentActivePet;

    if (hunger < 50 && happiness < 50 && cleanliness < 50) {
        if (cleanliness <= happiness && cleanliness <= hunger) { 
            finalImageSet = images.dirty;
            finalMessage = `${currentActivePet.petName} feels really yucky, is sad, and hungry! A bath is needed most.`;
        } else if (happiness <= hunger) { 
            finalImageSet = images.sad;
            finalMessage = `${currentActivePet.petName} is very sad and also hungry. The sadness is hitting hard.`;
        } else { 
            finalImageSet = images.hungry;
            finalMessage = `${currentActivePet.petName} is extremely hungry! Also sad and needs a bath. That tummy is rumbling loudest.`;
        }
    } else { 
        if (cleanliness < 50) { 
            finalImageSet = images.dirty;
            finalMessage = `${currentActivePet.petName} feels a bit yucky...`;
        } else if (happiness < 50) { 
            finalImageSet = images.sad;
            finalMessage = `${currentActivePet.petName} is feeling down...`;
        } else if (hunger < 50) { 
            finalImageSet = images.hungry;
            finalMessage = `${currentActivePet.petName} is so hungry...`;
        } else if (happiness > 60) { 
            finalImageSet = images.content;
            finalMessage = `${currentActivePet.petName} is feeling pretty content!`;
            if (hunger > 80 && cleanliness > 80) { 
                 finalMessage = `${currentActivePet.petName} is feeling great! Thanks to you!`;
                 finalImageSet = images.happy; 
            }
        } else {
            finalImageSet = images.default; 
            finalMessage = `${currentActivePet.petName} is doing alright.`;
        }
    }
    
    setPetImage(finalImageSet.url);
    setPetImageHint(finalImageSet.hint);

    if (!isLoadingAi) {
        setPetMessage(finalMessage);
    }
  }, [currentActivePet, currentPetDefinition, isLoadingAi, user, showPetSelectionScreen, isNamingPet, speciesForNaming]);

  const callPetNeedsAI = useCallback(async () => {
    if (!currentActivePet || isLoadingAi || Date.now() - lastAiCallTimestamp < AI_COOLDOWN) {
      return;
    }
    setIsLoadingAi(true);
    setLastAiCallTimestamp(Date.now());
    try {
      const assessmentInput: PetNeedsAssessmentInput = { 
        hunger: currentActivePet.hunger, 
        happiness: currentActivePet.happiness, 
        cleanliness: currentActivePet.cleanliness 
      };
      setPetMessage("Thinking about what I need...");
      const result = await petNeedsAssessment(assessmentInput);
      setPetMessage(result.needs);
      toast({
        title: `${currentPetDisplayName} Says:`,
        description: result.needs,
        duration: 5000,
      });
    } catch (error) {
      console.error("Error calling petNeedsAssessment:", error);
      setPetMessage("Hmm, I'm not sure what I need right now. Maybe try an action?");
      toast({
        title: "Error",
        description: "Could not get pet's needs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAi(false);
    }
  }, [currentActivePet, isLoadingAi, lastAiCallTimestamp, toast, currentPetDisplayName]);

  const getActionStateForPet = useCallback((actionId: string): { countToday: number; canPerform: boolean } => {
    if (!currentActivePet || !USER_ACTIONS) return { countToday: 0, canPerform: false };

    const actionDefinition = USER_ACTIONS.find(a => a.id === actionId);
    if (!actionDefinition) return { countToday: 0, canPerform: false };

    const todayStr = new Date().toISOString().split('T')[0];
    const petActionState = currentActivePet.actionStates?.[actionId];

    if (petActionState && petActionState.lastPerformedDate === todayStr) {
      return {
        countToday: petActionState.countToday,
        canPerform: petActionState.countToday < actionDefinition.frequencyPerDay,
      };
    }
    return { countToday: 0, canPerform: true };
  }, [currentActivePet]);


  useEffect(() => {
    if (authLoading || !user || !user.uid) {
      if (!authLoading && !user) { 
        setUserPets([]);
        setActivePetId(null);
        setShowPetSelectionScreen(false);
        setIsNamingPet(false);
        setIsPetDataLoading(false);
      }
      return;
    }
  
    setIsPetDataLoading(true);
    const petsColRef = collection(db, "users", user.uid, "pets");
    const q = query(petsColRef, limit(MAX_PETS));
    
    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const petsFromFirestore: PetData[] = [];
      const firestoreUpdatePromises: Promise<void>[] = [];
      const now = new Date(); 
      const todayStr = now.toISOString().split('T')[0];
  
      querySnapshot.forEach((docSnap) => {
        const petDataFromSnap = docSnap.data() as FirestorePetData;
        const currentPetId = docSnap.id;
        let updatedPetDataForState: FirestorePetData = { ...petDataFromSnap };
        let hasChangesToPersist = false;
        const dataToUpdateInFirestore: Partial<FirestorePetData> & { lastUpdated?: Timestamp } = {};

        // Action States Reset Logic
        const currentPetActionStates = petDataFromSnap.actionStates || {};
        const processedActionStates: Record<string, ActionState> = {};
        let actionStatesChanged = false;
        for (const actionId in currentPetActionStates) {
          const actionState = currentPetActionStates[actionId];
          if (actionState.lastPerformedDate !== todayStr && actionState.countToday !== 0) {
            processedActionStates[actionId] = { ...actionState, countToday: 0 };
            actionStatesChanged = true;
          } else {
            processedActionStates[actionId] = actionState;
          }
        }
        if (actionStatesChanged) {
            dataToUpdateInFirestore.actionStates = processedActionStates;
            hasChangesToPersist = true;
        }
        updatedPetDataForState.actionStates = processedActionStates;

        // Stat Decrease Logic (replaces setInterval)
        const lastUpdatedDate = petDataFromSnap.lastUpdated.toDate();
        const timeDiffMs = now.getTime() - lastUpdatedDate.getTime();
        const timeDiffMinutes = timeDiffMs / (1000 * 60);
        
        if (timeDiffMinutes >= 1) { // Process only if some time has passed
            const intervalsPassed = Math.floor(timeDiffMinutes / STAT_DECREASE_INTERVAL_MINUTES_FOR_CALCULATION);

            if (intervalsPassed > 0) {
                const totalDecreasePercent = intervalsPassed * STAT_DECREASE_PERCENT_PER_INTERVAL;

                let newHunger = Math.max(0, updatedPetDataForState.hunger - totalDecreasePercent);
                let newCleanliness = Math.max(0, updatedPetDataForState.cleanliness - totalDecreasePercent);
                let newHappiness = updatedPetDataForState.happiness;

                if (newHunger < 40 || newCleanliness < 40) {
                    newHappiness = Math.max(0, updatedPetDataForState.happiness - totalDecreasePercent);
                } else if (updatedPetDataForState.happiness > 0) {
                    newHappiness = Math.max(0, updatedPetDataForState.happiness - Math.floor(totalDecreasePercent / 1.5));
                }
                
                if (updatedPetDataForState.hunger !== newHunger || 
                    updatedPetDataForState.cleanliness !== newCleanliness || 
                    updatedPetDataForState.happiness !== newHappiness) {
                    
                    dataToUpdateInFirestore.hunger = newHunger;
                    dataToUpdateInFirestore.happiness = newHappiness;
                    dataToUpdateInFirestore.cleanliness = newCleanliness;
                    
                    updatedPetDataForState.hunger = newHunger;
                    updatedPetDataForState.happiness = newHappiness;
                    updatedPetDataForState.cleanliness = newCleanliness;
                    hasChangesToPersist = true;
                }
            }
        }
        
        if (hasChangesToPersist) {
            dataToUpdateInFirestore.lastUpdated = Timestamp.fromDate(now);
        }
        updatedPetDataForState.lastUpdated = Timestamp.fromDate(now); // Always update for React state if read

        petsFromFirestore.push({
          id: currentPetId,
          ...updatedPetDataForState,
        });
  
        if (hasChangesToPersist) {
          const petDocRef = doc(db, "users", user.uid, "pets", currentPetId);
          firestoreUpdatePromises.push(setDoc(petDocRef, dataToUpdateInFirestore, { merge: true }));
        }
      });
  
      if (firestoreUpdatePromises.length > 0) {
        try {
          await Promise.all(firestoreUpdatePromises);
        } catch (error) {
          console.error("Error updating pet data in Firestore:", error);
          toast({ title: "Data Sync Issue", description: "Could not sync all pet updates.", variant: "destructive" });
        }
      }
  
      setUserPets(petsFromFirestore);
  
      if (petsFromFirestore.length > 0) {
        if (!activePetId || !petsFromFirestore.find(p => p.id === activePetId)) {
          setActivePetId(petsFromFirestore[0].id);
        }
        setShowPetSelectionScreen(false);
        setIsNamingPet(false);
      } else {
        setActivePetId(null);
        setShowPetSelectionScreen(true);
        setIsNamingPet(false);
      }
      setIsPetDataLoading(false);
    }, (error) => {
      console.error("Error fetching pets data:", error);
      toast({ title: "Error", description: "Could not load your pets.", variant: "destructive" });
      setUserPets([]);
      setActivePetId(null);
      setShowPetSelectionScreen(true);
      setIsNamingPet(false);
      setIsPetDataLoading(false);
    });
  
    return () => unsubscribe();
  }, [user, authLoading, toast, activePetId]);


  useEffect(() => {
    updatePetVisualsAndMessage();
  }, [currentActivePet, currentPetDefinition, updatePetVisualsAndMessage]);

  // Removed old client-side stat decrease interval useEffect

  useEffect(() => {
    if (!user || !currentActivePet || isLoadingAi || showPetSelectionScreen || isNamingPet) return;
    if ((currentActivePet.hunger < 25 || currentActivePet.happiness < 25 || currentActivePet.cleanliness < 25) && (Date.now() - lastAiCallTimestamp > AI_COOLDOWN)) {
      callPetNeedsAI();
    }
  }, [currentActivePet, isLoadingAi, lastAiCallTimestamp, callPetNeedsAI, user, showPetSelectionScreen, isNamingPet]);


  useEffect(() => {
    if (!user || !activePetId) {
      if (Object.keys(notifiedActionStatesRef.current).length > 0) {
        setNotifiedActionStates({});
      }
      return;
    }
    
    const loadNotifiedStates = () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const currentDayStorageKey = `notifiedActionStates_${user.uid}_${activePetId}_${todayStr}`;
      let loadedStates: Record<string, NotifiedActionState> = {};
      
      try {
        const storedStatesRaw = typeof window !== 'undefined' ? localStorage.getItem(currentDayStorageKey) : null;
        if (storedStatesRaw) {
          const parsedStates = JSON.parse(storedStatesRaw);
          Object.keys(parsedStates).forEach(key => {
            if (parsedStates[key].lastNotifiedDate === todayStr) {
              loadedStates[key] = parsedStates[key];
            }
          });
        }
      } catch (e) {
        console.error("Error accessing localStorage for notifiedActionStates:", e);
      }
      
      const currentNotifiedActionStates = notifiedActionStatesRef.current;
      let statesChanged = JSON.stringify(loadedStates) !== JSON.stringify(currentNotifiedActionStates);
      
      if (!statesChanged && Object.keys(currentNotifiedActionStates).length > 0) {
          const firstStateKey = Object.keys(currentNotifiedActionStates)[0];
          if (currentNotifiedActionStates[firstStateKey] && currentNotifiedActionStates[firstStateKey].lastNotifiedDate !== todayStr) {
              loadedStates = {}; 
              statesChanged = true;
          }
      }

      if (statesChanged) {
         setNotifiedActionStates(loadedStates);
      }

      try {
          if (typeof window !== 'undefined') {
              const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
              const yesterdayStorageKey = `notifiedActionStates_${user.uid}_${activePetId}_${yesterdayStr}`;
              localStorage.removeItem(yesterdayStorageKey);
          }
      } catch (e) {
          console.error("Error cleaning up old notifiedActionStates from localStorage:", e);
      }
    };
    loadNotifiedStates();
  }, [user, activePetId]);


  useEffect(() => {
    if (!user || !currentActivePet || !activePetId || notificationPermission !== 'granted' || showPetSelectionScreen || isNamingPet) {
      return;
    }

    const intervalId = setInterval(() => {
      const todayStr = new Date().toISOString().split('T')[0];
      const currentDayStorageKey = `notifiedActionStates_${user.uid}_${activePetId}_${todayStr}`;

      USER_ACTIONS.forEach(action => {
        const petActionState = getActionStateForPet(action.id); 
        if (!petActionState.canPerform) return;

        setNotifiedActionStates(prevNotifiedStates => {
          let currentActionNotifiedState = prevNotifiedStates[action.id] || { notifiedTodayCount: 0, lastNotifiedDate: '' };

          if (currentActionNotifiedState.lastNotifiedDate !== todayStr) {
            currentActionNotifiedState = { notifiedTodayCount: 0, lastNotifiedDate: todayStr };
          }
          
          const maxNotificationsForAction = action.frequencyPerDay - petActionState.countToday;

          if (currentActionNotifiedState.notifiedTodayCount < maxNotificationsForAction && Math.random() < NOTIFICATION_PROBABILITY) {
            let notificationTitle = "";
            let notificationBody = "";

            switch (action.id) {
              case "drinkWater":
                notificationTitle = `${currentPetDisplayName} is thirsty!`;
                notificationBody = `Remember to stay hydrated. Have you had water recently? 💧`;
                break;
              case "eatenWell":
                notificationTitle = `${currentPetDisplayName} is thinking of you!`;
                notificationBody = `Have you had a good meal today? Your pal is waiting! 🍎`;
                break;
              case "proudOfYou":
                notificationTitle = `${currentPetDisplayName} sends good vibes! ✨`;
                notificationBody = `Time for a quick positive check-in?`;
                break;
              default:
                notificationTitle = `A reminder from ${currentPetDisplayName}`;
                notificationBody = action.question;
            }
            
            const sent = sendNotification(notificationTitle, { body: notificationBody, icon: petImage, tag: `action_${action.id}_${currentPetDisplayName}` });
            if (sent) {
              const newNotifiedCount = currentActionNotifiedState.notifiedTodayCount + 1;
              const updatedNotifiedActionStateForCurrentAction = { ...currentActionNotifiedState, notifiedTodayCount: newNotifiedCount };
              
              const newStatesForStorage = {
                ...prevNotifiedStates, 
                [action.id]: updatedNotifiedActionStateForCurrentAction
              };
              try {
                if (typeof window !== 'undefined') localStorage.setItem(currentDayStorageKey, JSON.stringify(newStatesForStorage));
              } catch (e) {
                 console.error("Error saving notifiedActionStates to localStorage:", e);
              }
              return newStatesForStorage; 
            }
          }
          return prevNotifiedStates; 
        });
      });
    }, NOTIFICATION_CHECK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [user, currentActivePet, activePetId, notificationPermission, sendNotification, getActionStateForPet, petImage, currentPetDisplayName, showPetSelectionScreen, isNamingPet, toast]);

  useEffect(() => {
    if (!user || !activePetId || notificationPermission !== 'granted' || showPetSelectionScreen || isNamingPet) {
      return;
    }

    const intervalId = setInterval(() => {
      const pet = userPets.find(p => p.id === activePetId);
      if (!pet) return;

      const now = Date.now();
      const petDisplayName = pet.petName;
      
      const below20Key = `criticalNotificationState_below20_${user.uid}_${pet.id}`;
      let below20State: { lastSentTimestamp: number | null } = 
        JSON.parse(typeof window !== 'undefined' ? localStorage.getItem(below20Key) || '{"lastSentTimestamp":null}' : '{"lastSentTimestamp":null}');

      const isAnyStatBelow20 = pet.hunger < 20 || pet.happiness < 20 || pet.cleanliness < 20;

      if (isAnyStatBelow20) {
        if (!below20State.lastSentTimestamp || (now - below20State.lastSentTimestamp > BELOW_20_NOTIFICATION_COOLDOWN)) {
          sendNotification(`${petDisplayName} needs attention! Where are YOU?`, { icon: petImage, tag: `pet_status_${pet.id}_below20` });
          below20State.lastSentTimestamp = now;
          if (typeof window !== 'undefined') localStorage.setItem(below20Key, JSON.stringify(below20State));
        }
      } else {
        if (below20State.lastSentTimestamp !== null && (pet.hunger >= 30 && pet.happiness >= 30 && pet.cleanliness >= 30)) {
            below20State.lastSentTimestamp = null; 
            if (typeof window !== 'undefined') localStorage.setItem(below20Key, JSON.stringify(below20State));
        }
      }

      const below10Key = `criticalNotificationState_below10_${user.uid}_${pet.id}`;
      let below10State: {
        firstSentTimestamp: number | null;
        secondSentTimestamp: number | null;
      } = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem(below10Key) || '{"firstSentTimestamp":null, "secondSentTimestamp":null}' : '{"firstSentTimestamp":null, "secondSentTimestamp":null}');

      const isAnyStatBelow10 = pet.hunger < 10 || pet.happiness < 10 || pet.cleanliness < 10;

      if (isAnyStatBelow10) {
        const canStartNewCycle = !below10State.firstSentTimestamp || (now - below10State.firstSentTimestamp > BELOW_10_NOTIFICATION_CYCLE_COOLDOWN);

        if (canStartNewCycle) {
          sendNotification(`${petDisplayName} is in critical condition! Please check on me!`, { icon: petImage, tag: `pet_status_${pet.id}_below10_first` });
          below10State.firstSentTimestamp = now;
          below10State.secondSentTimestamp = null; 
          if (typeof window !== 'undefined') localStorage.setItem(below10Key, JSON.stringify(below10State));
        } else if (below10State.firstSentTimestamp && !below10State.secondSentTimestamp) {
          if (now - below10State.firstSentTimestamp >= BELOW_10_SECOND_NOTIFICATION_DELAY) {
            sendNotification(`${petDisplayName} really needs your help NOW! 🆘`, { icon: petImage, tag: `pet_status_${pet.id}_below10_second` });
            below10State.secondSentTimestamp = now;
            if (typeof window !== 'undefined') localStorage.setItem(below10Key, JSON.stringify(below10State));
          }
        }
      } else {
        if (below10State.firstSentTimestamp !== null && (pet.hunger >= 15 && pet.happiness >= 15 && pet.cleanliness >= 15)) {
            below10State.firstSentTimestamp = null; 
            below10State.secondSentTimestamp = null;
            if (typeof window !== 'undefined') localStorage.setItem(below10Key, JSON.stringify(below10State));
        }
      }
    }, CRITICAL_STAT_NOTIFICATION_INTERVAL);

    return () => clearInterval(intervalId);
  }, [user, activePetId, userPets, notificationPermission, sendNotification, petImage, showPetSelectionScreen, isNamingPet, toast]);


  const handleInteraction = (statUpdater: (prevPet: PetData) => Partial<PetData>, message: string, toastMessage: string) => {
    if (!currentActivePet || !user || showPetSelectionScreen || isNamingPet) return;
    
    setUserPets(prevPets => 
      prevPets.map(p => {
        if (p.id !== activePetId) return p;
        const changes = statUpdater(p);
        const updatedPetData = {
          ...p,
          ...changes,
          hunger: Math.min(100, Math.max(0, changes.hunger ?? p.hunger)),
          happiness: Math.min(100, Math.max(0, changes.happiness ?? p.happiness)),
          cleanliness: Math.min(100, Math.max(0, changes.cleanliness ?? p.cleanliness)),
        };
        saveSinglePetData(p.id, {
          hunger: updatedPetData.hunger,
          happiness: updatedPetData.happiness,
          cleanliness: updatedPetData.cleanliness,
          // lastUpdated will be set by saveSinglePetData
        });
        return updatedPetData;
      })
    );
    setPetMessage(message);
    toast({ description: toastMessage.replace("{PET_NAME}", currentPetDisplayName) });
  };

  const handleFeed = () => handleInteraction(
    (p) => ({
      hunger: p.hunger + 25 + Math.floor(Math.random() * 10),
      happiness: p.happiness + 5 + Math.floor(Math.random() * 5),
    }),
    "Yummy! That hit the spot!",
    `You fed ${currentPetDisplayName}!`
  );

  const handlePlay = () => handleInteraction(
    (p) => ({
      happiness: p.happiness + 30 + Math.floor(Math.random() * 10),
      hunger: p.hunger - 5 - Math.floor(Math.random() * 5),
    }),
    "Whee! That was fun!",
    `You played with ${currentPetDisplayName}!`
  );

  const handleClean = () => handleInteraction(
    (p) => ({
      cleanliness: p.cleanliness + 40 + Math.floor(Math.random() * 10),
      happiness: p.happiness + 10 + Math.floor(Math.random() * 5),
    }),
    "So fresh and so clean!",
    `You cleaned ${currentPetDisplayName}!`
  );

  const handleUserActionInteract = (actionId: string, option: UserActionOption, choiceKey: 'yes' | 'no') => {
    if (!currentActivePet || !user) return;

    const actionDefinition = USER_ACTIONS.find(a => a.id === actionId);
    if (!actionDefinition) return;

    const { canPerform } = getActionStateForPet(actionId);

    if (!canPerform) {
      toast({ description: "You've done this enough for today!", variant: "default" });
      return;
    }

    const newHappiness = Math.min(100, Math.max(0, currentActivePet.happiness + option.happinessChange));
    
    const todayStr = new Date().toISOString().split('T')[0];
    const petSpecificActionState = currentActivePet.actionStates?.[actionId];
    
    let newCountToday;
    if (petSpecificActionState && petSpecificActionState.lastPerformedDate === todayStr) {
        newCountToday = petSpecificActionState.countToday + 1;
    } else {
        newCountToday = 1; 
    }

    const newActionStates = {
      ...(currentActivePet.actionStates || {}),
      [actionId]: {
        countToday: newCountToday,
        lastPerformedDate: todayStr,
      },
    };

    setUserPets(prevPets =>
      prevPets.map(p =>
        p.id === activePetId ? { ...p, happiness: newHappiness, actionStates: newActionStates } : p
      )
    );
    saveSinglePetData(currentActivePet.id, { 
        happiness: newHappiness, 
        actionStates: newActionStates 
        // lastUpdated will be set by saveSinglePetData
    });

    const feedbackMessage = choiceKey === 'yes' 
      ? `You chose "${option.text}" for "${actionDefinition.question}" ${currentPetDisplayName} ${option.happinessChange >= 0 ? 'liked that!' : 'disliked that.'}`
      : `You chose "${option.text}" for "${actionDefinition.question}" ${currentPetDisplayName} ${option.happinessChange >= 0 ? 'liked that!' : 'disliked that.'}`;
    
    toast({ description: feedbackMessage });

    if (option.popupMessage) {
      setPopupMessage(option.popupMessage.replace('{PET_NAME}', currentPetDisplayName).replace('gentle headpats... everything will be okay.',' gentle headpats... everything will be okay. '+currentPetDisplayName+' is here for you.'));
      setShowPopup(true);
    }
  };


  const handleSelectSpeciesForNaming = (petDefinition: PetType) => {
    if (!user || userPets.length >= MAX_PETS) {
      toast({ title: "Oops!", description: `You can only have up to ${MAX_PETS} pets.`, variant: "destructive" });
      return;
    }
    setSpeciesForNaming(petDefinition);
    setIsNamingPet(true);
    setShowPetSelectionScreen(false);
    setNewPetNameInput(petDefinition.defaultName);
  };

  const handleNamePetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !speciesForNaming || !newPetNameInput.trim() || userPets.length >= MAX_PETS) {
      toast({ title: "Error", description: "Cannot add pet. Please check details.", variant: "destructive" });
      return;
    }
    
    const newPetFirestoreData: FirestorePetData = {
      petName: newPetNameInput.trim(),
      selectedPetTypeId: speciesForNaming.id,
      hunger: INITIAL_HUNGER,
      happiness: INITIAL_HAPPINESS,
      cleanliness: INITIAL_CLEANLINESS,
      lastUpdated: Timestamp.now(), // Set initial lastUpdated
      actionStates: {},
    };

    try {
      setIsPetDataLoading(true);
      await addDoc(collection(db, "users", user.uid, "pets"), newPetFirestoreData);
      setIsNamingPet(false);
      setSpeciesForNaming(null);
      setNewPetNameInput("");
      toast({ description: `You've adopted ${newPetFirestoreData.petName}!`});
    } catch (error) {
      console.error("Error creating new pet:", error);
      toast({ title: "Adoption Failed", description: "Could not create your new pet.", variant: "destructive" });
    } 
  };
  
  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (authAction === 'signin') {
      await signInWithEmail(email, password);
    } else {
      if (!username.trim()) {
        toast({ title: "Username Required", description: "Please enter a username for sign up.", variant: "destructive"});
        return;
      }
      await signUpWithEmail(email, password, username.trim());
    }
  };

  const handleAdoptNewPetClick = () => {
    if (userPets.length < MAX_PETS) {
      setShowPetSelectionScreen(true);
      setIsNamingPet(false);
    } else {
      toast({ title: "Max Pets Reached", description: `You already have ${MAX_PETS} pets.`, variant: "default"});
    }
  };

  const handleRequestNotificationPermission = async () => {
    if (notificationsSupported && notificationPermission === 'default') {
      const result = await requestNotificationPermission();
      if (result === 'granted') {
        toast({ title: "Notifications Enabled", description: "You'll now receive reminders for your pet!" });
      } else if (result === 'denied') {
        toast({ title: "Notifications Denied", description: "You can enable notifications in your browser settings.", variant: "default" });
      }
    } else if (notificationPermission === 'granted') {
        toast({ title: "Notifications Already Enabled", description: "You're all set for pet reminders!", variant: "default" });
    } else if (notificationPermission === 'denied') {
        toast({ title: "Notifications Blocked", description: "Please enable notifications in your browser settings to get reminders.", variant: "default" });
    }
  };

  const handleNamingBackClick = () => {
    setIsNamingPet(false);
    setSpeciesForNaming(null);
    setNewPetNameInput(""); 
    setShowPetSelectionScreen(true); 
  };
  
  if (authLoading || (user && isPetDataLoading && userPets.length === 0 && !showPetSelectionScreen && !isNamingPet && activePetId === null )) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 selection:bg-primary/30 relative">
        { user && <AuthAreaComponent user={user} onSignOut={signOut} authLoading={authLoading} /> }
        <Skeleton className="w-full max-w-xs sm:max-w-lg h-[400px] sm:h-[600px] rounded-xl" />
        <p className="mt-4 text-foreground">Loading your mastigotchi...</p>
      </div>
    );
  }
  
  const mainContent = (
    <>
      <Card className="w-full max-w-md sm:max-w-lg shadow-2xl rounded-xl overflow-hidden bg-card relative mt-12 sm:mt-16">
        <CardHeader className="text-center border-b border-border pb-3 pt-4 sm:pb-4 sm:pt-6">
          <CardTitle className="text-3xl sm:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent-foreground">
            mastigotchi
          </CardTitle>
        </CardHeader>

        {!user ? (
          <CardContent className="p-4 sm:p-6 flex flex-col space-y-4 sm:space-y-6">
            <div className="w-full mt-4">
              <form onSubmit={handleAuthSubmit} className="space-y-3 sm:space-y-4">
                <CardTitle className="text-lg sm:text-xl font-bold text-center mb-2">
                  {authAction === 'signin' ? 'Sign In' : 'Create Account'}
                </CardTitle>
                {authAction === 'signup' && (
                   <div>
                      <Label htmlFor="username" className="text-xs sm:text-sm">Username</Label>
                      <Input 
                      id="username" 
                      type="text" 
                      placeholder="Your Username" 
                      value={username} 
                      onChange={(e) => setUsername(e.target.value)} 
                      required 
                      className="mt-1 text-sm sm:text-base"
                      />
                  </div>
                )}
                <div>
                  <Label htmlFor="email" className="text-xs sm:text-sm">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="you@example.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                    className="mt-1 text-sm sm:text-base"
                  />
                </div>
                <div>
                  <Label htmlFor="password" className="text-xs sm:text-sm">Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    className="mt-1 text-sm sm:text-base"
                  />
                </div>
                <Button type="submit" className="w-full text-sm sm:text-base" disabled={authLoading}>
                  {authAction === 'signin' ? (
                    <> <LogInIcon size={16} className="mr-2 sm:size-18" /> Sign In </>
                  ) : (
                    <> <UserPlus size={16} className="mr-2 sm:size-18" /> Create Account </>
                  )}
                </Button>
              </form>
              <Button 
                variant="link" 
                className="w-full mt-2 text-xs sm:text-sm" 
                onClick={() => setAuthAction(authAction === 'signin' ? 'signup' : 'signin')}
              >
                {authAction === 'signin' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
              </Button>
            </div>
          </CardContent>
        ) : showPetSelectionScreen ? (
           <PetSelectionUIComponent 
             petTypes={PET_TYPES}
             onSelectSpecies={handleSelectSpeciesForNaming}
             onCancel={() => {
                if (userPets.length > 0) setShowPetSelectionScreen(false);
                else toast({title: "No Pet Selected", description: "You need to adopt a pet to continue.", variant: "default"});
             }}
             userPetsCount={userPets.length}
             maxPets={MAX_PETS}
           />
        ) : isNamingPet ? (
            <PetNamingUIComponent 
              speciesForNaming={speciesForNaming}
              newPetNameInput={newPetNameInput}
              onNewPetNameInputChange={setNewPetNameInput}
              onSubmit={handleNamePetSubmit}
              onBackClick={handleNamingBackClick}
              isPetDataLoading={isPetDataLoading}
            />
        ) : !currentActivePet || !currentPetDefinition ? ( 
          <CardContent className="p-4 sm:p-6 text-center min-h-[300px] sm:min-h-[400px] flex flex-col justify-center items-center">
            {isPetDataLoading ? (
              <>
                <Skeleton className="w-36 h-36 sm:w-48 sm:h-48 rounded-lg mx-auto mb-4" />
                <Skeleton className="w-3/4 h-6 sm:h-8 mx-auto mb-2" />
                <Skeleton className="w-1/2 h-4 sm:h-6 mx-auto" />
                <p className="mt-4 text-muted-foreground text-xs sm:text-sm">Loading your Pal...</p>
              </>
            ) : (
               <>
                 <PetDisplay
                    petName="No Pal Yet"
                    imageUrl={petImage || PET_TYPES[0].images.default.url} 
                    altText="No pet selected"
                    imageHint={petImageHint || PET_TYPES[0].images.default.hint}
                    className="max-w-[200px] sm:max-w-xs md:max-w-sm" 
                 />
                 <p className="mt-4 text-muted-foreground text-xs sm:text-sm">{petMessage || "Adopt your first mastigotchi to get started!"}</p>
                 <Button onClick={handleAdoptNewPetClick} className="mt-4 text-sm sm:text-base">Adopt First Pal</Button>
               </>
            )}
          </CardContent>
        ): (
          <>
            <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              <PetDisplay
                petName={currentPetDisplayName}
                imageUrl={petImage}
                altText={`Image of ${currentPetDisplayName}`}
                imageHint={petImageHint}
              />

              <div className="space-y-2 sm:space-y-3 pt-2 sm:pt-4">
                <StatusIndicator label="Hunger" value={currentActivePet.hunger} icon={<Apple className="w-4 h-4 sm:w-5 sm:h-5" />} />
                <StatusIndicator label="Happiness" value={currentActivePet.happiness} icon={<Smile className="w-4 h-4 sm:w-5 sm:h-5" />} />
                <StatusIndicator label="Cleanliness" value={currentActivePet.cleanliness} icon={<Droplets className="w-4 h-4 sm:w-5 sm:h-5" />} />
              </div>

              <Card className="bg-card/50 shadow-inner">
                <CardHeader className="pb-2 pt-2 sm:pt-3 px-3 sm:px-4">
                    <CardDescription className="flex items-center text-xs sm:text-sm text-muted-foreground">
                        <span className="mr-2 text-lg sm:text-xl shrink-0">💬</span>
                        {currentPetDisplayName} says:
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-3 sm:px-4 pb-2 sm:pb-3">
                  {(isLoadingAi && petMessage.startsWith("Thinking")) || (isPetDataLoading && !petMessage) ? (
                    <Skeleton className="h-4 sm:h-5 w-3/4 " /> 
                  ) : (
                    <p className="text-foreground text-xs sm:text-sm text-center italic min-h-[2em] sm:min-h-[2.5em] flex items-center justify-center">
                      {petMessage}
                    </p>
                  )}
                </CardContent>
              </Card>
            </CardContent>
            <CardFooter className="p-0 border-t border-border">
              <InteractionButtons
                onFeed={handleFeed}
                onPlay={handlePlay}
                onClean={handleClean}
                isLoading={isLoadingAi || !currentActivePet || isPetDataLoading}
                className="rounded-none rounded-b-xl"
              />
            </CardFooter>
          </>
        )}
      </Card>
      
      {user && currentActivePet && !showPetSelectionScreen && !isNamingPet && (
        <>
          <div className="flex flex-col sm:flex-row items-center gap-2 mt-4">
            <Button variant="outline" onClick={callPetNeedsAI} disabled={isLoadingAi || Date.now() - lastAiCallTimestamp < AI_COOLDOWN || isPetDataLoading} className="w-full sm:w-auto text-xs sm:text-sm">
              {isLoadingAi ? "Consulting Wisdom..." : `What does ${currentPetDisplayName} need?`}
            </Button>
            {notificationsSupported && notificationPermission === 'default' && (
                 <Button variant="outline" onClick={handleRequestNotificationPermission} className="w-full sm:w-auto text-xs sm:text-sm">
                    <BellRing size={14} className="mr-1 sm:mr-2 sm:size-16" /> Enable Reminders
                </Button>
            )}
           </div>
          <UserActionsDisplay 
            actions={USER_ACTIONS} 
            onActionInteract={handleUserActionInteract}
            getActionState={getActionStateForPet}
            petName={currentPetDisplayName}
          />
        </>
      )}

      {user && userPets.length > 0 && userPets.length < MAX_PETS && !showPetSelectionScreen && !isNamingPet && !isPetDataLoading && (
         <Button variant="secondary" onClick={handleAdoptNewPetClick} className="mt-4 shadow-md text-xs sm:text-sm">
            <PawPrint size={16} className="mr-2 sm:size-18" /> Adopt Another Pal
          </Button>
      )}
      {user && !isPetDataLoading && userPets.length > 0 && 
        <PetSwitcherUIComponent 
            userPets={userPets}
            activePetId={activePetId}
            onSwitchPet={setActivePetId}
        />
      }

      <AlertDialog open={showPopup} onOpenChange={setShowPopup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{currentPetDisplayName} feels something!</AlertDialogTitle>
            <AlertDialogDescription>
              {popupMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowPopup(false)}>Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  return (
    <div className={`min-h-screen flex flex-col items-center justify-start pt-8 sm:pt-12 bg-background p-2 sm:p-4 selection:bg-primary/30 relative ${user && currentActivePet && !showPetSelectionScreen && !isNamingPet ? 'bg-cover bg-center bg-no-repeat' : ''}`}
         style={user && currentActivePet && !showPetSelectionScreen && !isNamingPet ? { backgroundImage: "url('/background.jpg')" } : {}}>
      <AuthAreaComponent user={user} onSignOut={signOut} authLoading={authLoading} />
      {mainContent}
    </div>
  );
}

    

    