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
import { doc, setDoc, onSnapshot, Timestamp, collection, addDoc, query, limit } from "firebase/firestore";
import { PET_TYPES, type PetType } from "@/config/pets";
import { useBrowserNotifications } from "@/hooks/useBrowserNotifications";

const INITIAL_HUNGER = 60;
const INITIAL_HAPPINESS = 60;
const INITIAL_CLEANLINESS = 50;
const MAX_PETS = 2;

const STAT_DECREASE_INTERVAL = 1800000; // 30 minutes (30 * 60 * 1000)
const STAT_DECREASE_AMOUNT = 1.5; // 1.5% decrease
const AI_COOLDOWN = 30000; // 30 seconds

const NOTIFICATION_CHECK_INTERVAL = 1800000; // Check every 30 minutes
const NOTIFICATION_PROBABILITY = 0.3; // 30% chance to send a notification per check if conditions met

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
    let finalImageSet = images.default; // Rule 6: Default fallback
    let finalMessage = `${currentActivePet.petName} is doing okay.`; // Default message

    const { hunger, happiness, cleanliness } = currentActivePet;

    // Rule 5: Priority for all stats below 50%
    if (hunger < 50 && happiness < 50 && cleanliness < 50) {
        if (cleanliness <= happiness && cleanliness <= hunger) {
            finalImageSet = images.dirty;
            finalMessage = `${currentActivePet.petName} feels really yucky, is sad, and hungry! Cleanliness is the biggest issue right now.`;
        } else if (happiness <= hunger) { // happiness is the lowest (or tied with hunger, and cleanliness is not the lowest)
            finalImageSet = images.sad;
            finalMessage = `${currentActivePet.petName} is very sad and also hungry. The sadness is hitting hard.`;
        } else { // hunger is the lowest
            finalImageSet = images.hungry;
            finalMessage = `${currentActivePet.petName} is extremely hungry! Also sad and needs a bath. That tummy is rumbling loudest.`;
        }
    } else {
        // Apply rules 1-4 if Rule 5 condition is false (using else if for cascading priority)
        if (cleanliness < 50) { // Rule 1
            finalImageSet = images.dirty;
            finalMessage = `${currentActivePet.petName} feels a bit yucky...`;
        } else if (happiness < 50) { // Rule 2 (implicitly cleanliness >= 50)
            finalImageSet = images.sad;
            finalMessage = `${currentActivePet.petName} is feeling down...`;
        } else if (hunger < 50) { // Rule 3 (implicitly cleanliness >= 50 and happiness >= 50)
            finalImageSet = images.hungry;
            finalMessage = `${currentActivePet.petName} is so hungry...`;
        } else if (happiness > 60) { // Rule 4 (implicitly all stats >= 50 and happiness > 60)
            finalImageSet = images.content;
            finalMessage = `${currentActivePet.petName} is feeling pretty content!`;
            // Enhanced "great" message from previous logic
            if (hunger > 80 && cleanliness > 80) { 
                 finalMessage = `${currentActivePet.petName} is feeling great! Thanks to you!`;
            }
        }
        // Rule 6 (default fallback) is handled because finalImageSet was initialized with images.default
        // and finalMessage with "doing okay". If none of the conditions (1-5) are met, these defaults will be used.
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
    if (authLoading) return;

    if (user && user.uid) {
      setIsPetDataLoading(true);
      const petsColRef = collection(db, "users", user.uid, "pets");
      const q = query(petsColRef, limit(MAX_PETS));

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const pets: PetData[] = [];
        querySnapshot.forEach((docSnap) => {
          pets.push({ id: docSnap.id, ...docSnap.data() } as PetData);
        });
        setUserPets(pets);

        if (pets.length > 0) {
          if (!activePetId || !pets.find(p => p.id === activePetId)) {
            setActivePetId(pets[0].id); 
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
    } else {
      setUserPets([]);
      setActivePetId(null);
      setShowPetSelectionScreen(false);
      setIsNamingPet(false);
      setIsPetDataLoading(false);
    }
  }, [user, authLoading, toast, activePetId]);

  useEffect(() => {
    updatePetVisualsAndMessage();
  }, [currentActivePet, currentPetDefinition, updatePetVisualsAndMessage]);

  useEffect(() => {
    if (!user || !currentActivePet || showPetSelectionScreen || isNamingPet) return;

    const intervalId = setInterval(() => {
      setUserPets(prevPets => 
        prevPets.map(p => {
          if (p.id !== activePetId) return p;

          const newHunger = Math.max(0, p.hunger - STAT_DECREASE_AMOUNT);
          const newCleanliness = Math.max(0, p.cleanliness - STAT_DECREASE_AMOUNT);
          
          let newHappiness = p.happiness;
          if (newHunger < 40 || newCleanliness < 40) {
            newHappiness = Math.max(0, p.happiness - STAT_DECREASE_AMOUNT);
          } else if (p.happiness > 0) { 
            newHappiness = Math.max(0, p.happiness - (STAT_DECREASE_AMOUNT / 2)); // Slower decrease if other stats are okay
          }
          
          const updatedPet = {
            ...p,
            hunger: newHunger,
            cleanliness: newCleanliness,
            happiness: newHappiness,
          };
          
          saveSinglePetData(p.id, { 
            hunger: updatedPet.hunger, 
            cleanliness: updatedPet.cleanliness, 
            happiness: updatedPet.happiness 
          });
          return updatedPet;
        })
      );
    }, STAT_DECREASE_INTERVAL);
    return () => clearInterval(intervalId);
  }, [user, currentActivePet, saveSinglePetData, showPetSelectionScreen, isNamingPet, activePetId]);
  
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
          // Filter out states that are not for today before setting
          Object.keys(parsedStates).forEach(key => {
            if (parsedStates[key].lastNotifiedDate === todayStr) {
              loadedStates[key] = parsedStates[key];
            }
          });
        }
      } catch (e) {
        console.error("Error accessing localStorage for notifiedActionStates:", e);
      }
      
      // Only update if there's a meaningful change from the current ref value
      if (JSON.stringify(loadedStates) !== JSON.stringify(notifiedActionStatesRef.current)) {
         setNotifiedActionStates(loadedStates);
      }

      // Cleanup: Remove old keys for other days/pets to prevent localStorage bloat
      try {
          if (typeof window !== 'undefined') {
              const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
              const yesterdayStorageKey = `notifiedActionStates_${user.uid}_${activePetId}_${yesterdayStr}`;
              localStorage.removeItem(yesterdayStorageKey);

              // Optional: More aggressive cleanup for very old keys if needed
              // For instance, loop through localStorage keys and remove ones matching a pattern but older than X days
          }
      } catch (e) {
          console.error("Error cleaning up old notifiedActionStates from localStorage:", e);
      }
    };
    loadNotifiedStates();
  // Dependencies: user and activePetId to reload/reset states when they change.
  // notifiedActionStatesRef.current is intentionally omitted to prevent loops,
  // relying on the comparison within the function to avoid unnecessary sets.
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

        // Use a functional update for setNotifiedActionStates to ensure we have the latest state
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
            
            const sent = sendNotification(notificationTitle, { body: notificationBody, icon: petImage });
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

    const { canPerform, countToday: currentCountToday } = getActionStateForPet(actionId);

    if (!canPerform) {
      toast({ description: "You've done this enough for today!", variant: "default" });
      return;
    }

    const newHappiness = Math.min(100, Math.max(0, currentActivePet.happiness + option.happinessChange));
    
    const todayStr = new Date().toISOString().split('T')[0];
    const newActionStates = {
      ...(currentActivePet.actionStates || {}),
      [actionId]: {
        countToday: (currentActivePet.actionStates?.[actionId]?.lastPerformedDate === todayStr ? currentCountToday : 0) + 1,
        lastPerformedDate: todayStr,
      },
    };

    setUserPets(prevPets =>
      prevPets.map(p =>
        p.id === activePetId ? { ...p, happiness: newHappiness, actionStates: newActionStates } : p
      )
    );
    saveSinglePetData(currentActivePet.id, { happiness: newHappiness, actionStates: newActionStates });

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
      lastUpdated: Timestamp.now(),
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
    } finally {
        // setIsPetDataLoading will be set to false by the onSnapshot listener
        // when the new pet is detected and list is updated.
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
            {/* Removed PetDisplay from here as per request */}
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
                setShowPetSelectionScreen(false);
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


    