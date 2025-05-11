"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import Image from "next/image";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PetDisplay } from "@/components/pet-display";
import { StatusIndicator } from "@/components/status-indicator";
import { InteractionButtons } from "@/components/interaction-buttons";
import { petNeedsAssessment, PetNeedsAssessmentInput } from "@/ai/flows/pet-needs-assessment";
import { Apple, Smile, Droplets, Info, LogIn, LogOut, UserCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot, Timestamp } from "firebase/firestore";
import { PET_TYPES, type PetType, type PetImages } from "@/config/pets";

const INITIAL_HUNGER = 70;
const INITIAL_HAPPINESS = 80;
const INITIAL_CLEANLINESS = 75;

const STAT_DECREASE_INTERVAL = 5000; // 5 seconds
const AI_CHECK_INTERVAL = 20000; // 20 seconds
const AI_COOLDOWN = 30000; // 30 seconds before AI can be called again

interface PetData {
  petName: string;
  selectedPetTypeId: string;
  hunger: number;
  happiness: number;
  cleanliness: number;
  lastUpdated: Timestamp;
}

export default function PocketPalPage() {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const { toast } = useToast();

  const [petData, setPetData] = useState<PetData | null>(null);
  const [selectedPetDefinition, setSelectedPetDefinition] = useState<PetType | null>(PET_TYPES[0]);
  
  const [petImage, setPetImage] = useState(PET_TYPES[0].images.default.url);
  const [petImageHint, setPetImageHint] = useState(PET_TYPES[0].images.default.hint);
  const [petMessage, setPetMessage] = useState("Welcome to Pocket Pal!");
  
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [lastAiCallTimestamp, setLastAiCallTimestamp] = useState(0);
  const [isPetDataLoading, setIsPetDataLoading] = useState(true);
  const [showPetSelection, setShowPetSelection] = useState(false);

  const currentPetName = petData?.petName || selectedPetDefinition?.defaultName || "Your Pal";

  // Load pet data from Firestore or initialize for new user/no user
  useEffect(() => {
    if (authLoading) {
      // Authentication is still in progress, main skeleton will be shown.
      // We might want to ensure isPetDataLoading is true here if we expect data.
      // However, the main skeleton condition `authLoading || (...)` handles this.
      // setIsPetDataLoading(true); // Could be set here, but might be redundant.
      return;
    }

    if (user && user.uid) {
      // User is authenticated and UID is available. Attempt to load pet data.
      setIsPetDataLoading(true);
      const petDocRef = doc(db, "users", user.uid, "pet", "data");
      const unsubscribe = onSnapshot(petDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as PetData;
          setPetData(data);
          const petDef = PET_TYPES.find(p => p.id === data.selectedPetTypeId) || PET_TYPES[0];
          setSelectedPetDefinition(petDef);
          setShowPetSelection(false);
        } else {
          // No pet data exists for this user, prompt for selection.
          setPetData(null);
          setSelectedPetDefinition(PET_TYPES[0]); // Reset to default before selection
          setShowPetSelection(true);
        }
        setIsPetDataLoading(false); // Finished attempting to load data
      }, (error) => {
        console.error("Error fetching pet data:", error);
        toast({ title: "Error", description: "Could not load pet data.", variant: "destructive" });
        setPetData(null);
        setSelectedPetDefinition(PET_TYPES[0]); // Reset to default
        setShowPetSelection(true); // Fallback to pet selection on error
        setIsPetDataLoading(false); // Finished attempting to load data (with error)
      });
      return () => unsubscribe();
    } else {
      // No user, user without UID, or auth has finished loading but no user.
      // Reset to initial state for a non-authenticated user.
      setPetData(null);
      setSelectedPetDefinition(PET_TYPES[0]);
      setPetImage(PET_TYPES[0].images.default.url);
      setPetImageHint(PET_TYPES[0].images.default.hint);
      setPetMessage("Welcome to Pocket Pal! Sign in to meet your friend.");
      setShowPetSelection(false); // No user, so no pet selection screen based on data.
      setIsPetDataLoading(false); // Not loading pet data.
    }
  }, [user, authLoading, toast]);


  const savePetData = useCallback(async (currentData: Omit<PetData, 'lastUpdated'>) => {
    if (user && user.uid && currentData) {
      const petDocRef = doc(db, "users", user.uid, "pet", "data");
      try {
        await setDoc(petDocRef, { ...currentData, lastUpdated: Timestamp.now() }, { merge: true });
      } catch (error) {
        console.error("Error saving pet data:", error);
        toast({ title: "Error", description: "Could not save pet progress.", variant: "destructive" });
      }
    }
  }, [user, toast]);

  // Update pet visuals and message based on current petData
  const updatePetVisualsAndMessage = useCallback(() => {
    if (!selectedPetDefinition) return; // Ensure selectedPetDefinition is available

    const images = selectedPetDefinition.images;
    let currentImageSet = images.default;
    let message = "I'm doing okay!";

    if (petData) {
        const { hunger, happiness, cleanliness } = petData;
        if (hunger < 30) {
        currentImageSet = images.hungry;
        message = "I'm so hungry...";
        } else if (cleanliness < 30) {
        currentImageSet = images.dirty;
        message = "I feel a bit yucky...";
        } else if (happiness < 30) {
        currentImageSet = images.sad;
        message = "I'm feeling down...";
        } else if (happiness > 90 && hunger > 80 && cleanliness > 80) {
        currentImageSet = images.content;
        message = "I'm feeling great! Thanks to you!";
        } else {
        currentImageSet = images.happy; 
        }
    } else {
        // Default message if no petData (e.g. new user before selection)
        message = `Hi! I'm ${selectedPetDefinition.defaultName}. Choose me or another Pal!`;
        if(!user) message = "Sign in to get a Pocket Pal!";
    }
    
    setPetImage(currentImageSet.url);
    setPetImageHint(currentImageSet.hint);

    if (!isLoadingAi) { // Don't override AI messages
        setPetMessage(message);
    }

  }, [petData, selectedPetDefinition, isLoadingAi, user]);

  useEffect(() => {
    updatePetVisualsAndMessage();
  }, [petData, selectedPetDefinition, updatePetVisualsAndMessage, user]); // Added user to deps for initial message

  // Stat decrease interval
  useEffect(() => {
    if (!user || !petData || showPetSelection) return;

    const intervalId = setInterval(() => {
      setPetData((prevData) => {
        if (!prevData) return null;
        const newHunger = Math.max(0, prevData.hunger - Math.floor(Math.random() * 3 + 1));
        const newCleanliness = Math.max(0, prevData.cleanliness - Math.floor(Math.random() * 2 + 1));
        let newHappiness = prevData.happiness;
        if (newHunger < 40) newHappiness -= 1;
        if (newCleanliness < 40) newHappiness -=1;
        if (newHappiness === prevData.happiness && prevData.happiness > 0) newHappiness -=1;
        
        const updatedData = {
          ...prevData,
          hunger: newHunger,
          cleanliness: newCleanliness,
          happiness: Math.max(0, newHappiness),
        };
        savePetData(updatedData);
        return updatedData;
      });
    }, STAT_DECREASE_INTERVAL);
    return () => clearInterval(intervalId);
  }, [user, petData, savePetData, showPetSelection]);

  const callPetNeedsAI = useCallback(async () => {
    if (!petData || isLoadingAi || Date.now() - lastAiCallTimestamp < AI_COOLDOWN) {
      return;
    }

    setIsLoadingAi(true);
    setLastAiCallTimestamp(Date.now());
    
    try {
      const assessmentInput: PetNeedsAssessmentInput = { 
        hunger: petData.hunger, 
        happiness: petData.happiness, 
        cleanliness: petData.cleanliness 
      };
      setPetMessage("Thinking about what I need..."); 
      const result = await petNeedsAssessment(assessmentInput);
      setPetMessage(result.needs);
      toast({
        title: `${currentPetName} Says:`,
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
  }, [petData, isLoadingAi, lastAiCallTimestamp, toast, currentPetName]);
  
  // Auto AI call on critical stats
  useEffect(() => {
    if (!user || !petData || isLoadingAi || showPetSelection) return;
    if ((petData.hunger < 25 || petData.happiness < 25 || petData.cleanliness < 25) && (Date.now() - lastAiCallTimestamp > AI_COOLDOWN)) {
      callPetNeedsAI();
    }
  }, [petData, isLoadingAi, lastAiCallTimestamp, callPetNeedsAI, showPetSelection]);

  const handleInteraction = (statUpdater: (prevData: PetData) => Partial<PetData>, message: string, toastMessage: string) => {
    if (!petData || !user || showPetSelection) return;
    setPetData(prevData => {
      if (!prevData) return null;
      const changes = statUpdater(prevData);
      const updatedData = {
        ...prevData,
        ...changes,
        hunger: Math.min(100, Math.max(0, changes.hunger ?? prevData.hunger)),
        happiness: Math.min(100, Math.max(0, changes.happiness ?? prevData.happiness)),
        cleanliness: Math.min(100, Math.max(0, changes.cleanliness ?? prevData.cleanliness)),
      };
      savePetData(updatedData);
      return updatedData;
    });
    setPetMessage(message);
    toast({ description: toastMessage.replace("{PET_NAME}", currentPetName) });
  };

  const handleFeed = () => handleInteraction(
    (p) => ({
      hunger: p.hunger + 25 + Math.floor(Math.random() * 10),
      happiness: p.happiness + 5 + Math.floor(Math.random() * 5),
    }),
    "Yummy! That hit the spot!",
    `You fed ${currentPetName}!`
  );

  const handlePlay = () => handleInteraction(
    (p) => ({
      happiness: p.happiness + 30 + Math.floor(Math.random() * 10),
      hunger: p.hunger - 5 - Math.floor(Math.random() * 5),
    }),
    "Whee! That was fun!",
    `You played with ${currentPetName}!`
  );

  const handleClean = () => handleInteraction(
    (p) => ({
      cleanliness: p.cleanliness + 40 + Math.floor(Math.random() * 10),
      happiness: p.happiness + 10 + Math.floor(Math.random() * 5),
    }),
    "So fresh and so clean!",
    `You cleaned ${currentPetName}!`
  );

  const handleSelectPet = async (petDefinition: PetType) => {
    if (!user) return;
    const newPetData: PetData = {
      petName: petDefinition.defaultName,
      selectedPetTypeId: petDefinition.id,
      hunger: INITIAL_HUNGER,
      happiness: INITIAL_HAPPINESS,
      cleanliness: INITIAL_CLEANLINESS,
      lastUpdated: Timestamp.now(),
    };
    setSelectedPetDefinition(petDefinition); // Update definition first for immediate visual consistency
    setPetData(newPetData); 
    await savePetData(newPetData); 
    setShowPetSelection(false);
    setPetMessage(`Hi! I'm ${newPetData.petName}, your new Pal!`); // Set message after data is set
    toast({ description: `You've chosen ${petDefinition.name}!`});
  };
  
  const AuthArea = () => (
    <div className="absolute top-4 right-4 z-10">
      {user ? (
        <div className="flex items-center gap-2">
           {user.photoURL && <Image src={user.photoURL} alt="User avatar" width={32} height={32} className="rounded-full" />}
           {!user.photoURL && <UserCircle size={32} />}
          <span className="text-sm text-foreground hidden sm:inline">{user.displayName || user.email}</span>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut size={16} className="mr-1 sm:mr-2"/> Sign Out
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={signInWithGoogle} disabled={authLoading}>
          <LogIn size={16} className="mr-2"/> Sign In with Google
        </Button>
      )}
    </div>
  );

  const PetSelectionUI = () => (
    <Card className="w-full max-w-md shadow-2xl rounded-xl overflow-hidden bg-card mt-8">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Choose Your Pocket Pal!</CardTitle>
        <CardDescription className="text-center">Select a companion to start your journey.</CardDescription>
      </CardHeader>
      <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PET_TYPES.map((petDef) => (
          <Button key={petDef.id} onClick={() => handleSelectPet(petDef)} className="w-full justify-start py-6 text-lg h-auto flex-col items-center sm:flex-row sm:items-center sm:text-left" variant="outline">
            <Image 
              src={petDef.images.default.url} 
              alt={petDef.name} 
              width={40} 
              height={40} 
              className="mb-2 sm:mb-0 sm:mr-4 rounded-md"
              data-ai-hint={petDef.images.default.hint}
            />
            <span className="text-center sm:text-left">{petDef.name}</span>
          </Button>
        ))}
      </CardContent>
    </Card>
  );

  // This is the primary loading state for the entire page after auth attempt.
  if (authLoading || (user && isPetDataLoading && !showPetSelection)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 selection:bg-primary/30">
        <AuthArea />
        <Skeleton className="w-full max-w-lg h-[600px] rounded-xl" />
        <p className="mt-4 text-foreground">Loading your Pocket Pal...</p>
      </div>
    );
  }
  
  const mainContent = (
    <>
       <Card className="w-full max-w-lg shadow-2xl rounded-xl overflow-hidden bg-card relative">
        <CardHeader className="text-center border-b border-border pb-4 pt-6">
          <CardTitle className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent-foreground">
            Pocket Pal
          </CardTitle>
           <AuthArea />
        </CardHeader>

        {!user ? (
          <CardContent className="p-6 text-center min-h-[400px] flex flex-col justify-center items-center">
            <PetDisplay
                petName={selectedPetDefinition?.defaultName || "Your Future Pal"}
                imageUrl={selectedPetDefinition?.images.default.url || petImage}
                altText={`Image of ${selectedPetDefinition?.defaultName || "default pet"}`}
                imageHint={selectedPetDefinition?.images.default.hint || petImageHint}
              />
            <p className="text-lg text-foreground my-4">{petMessage}</p>
            <Button onClick={signInWithGoogle} size="lg" disabled={authLoading}>
              <LogIn size={20} className="mr-2"/> Sign In with Google
            </Button>
          </CardContent>
        ) : showPetSelection ? (
           <PetSelectionUI />
        ) : !petData || !selectedPetDefinition ? ( // Should be brief if data loading works
          <CardContent className="p-6 text-center min-h-[400px] flex flex-col justify-center items-center">
             <Skeleton className="w-48 h-48 rounded-full mx-auto mb-4" />
             <Skeleton className="w-3/4 h-8 mx-auto mb-2" />
             <Skeleton className="w-1/2 h-6 mx-auto" />
             <p className="mt-4 text-muted-foreground">Preparing your Pal...</p>
          </CardContent>
        ): (
          <>
            <CardContent className="p-6 space-y-6">
              <PetDisplay
                petName={currentPetName}
                imageUrl={petImage}
                altText={`Image of ${currentPetName}`}
                imageHint={petImageHint}
              />

              <div className="space-y-3 pt-4">
                <StatusIndicator label="Hunger" value={petData.hunger} icon={<Apple className="w-5 h-5" />} />
                <StatusIndicator label="Happiness" value={petData.happiness} icon={<Smile className="w-5 h-5" />} />
                <StatusIndicator label="Cleanliness" value={petData.cleanliness} icon={<Droplets className="w-5 h-5" />} />
              </div>

              <Card className="bg-card/50 shadow-inner">
                <CardHeader className="pb-2 pt-3 px-4">
                    <CardDescription className="flex items-center text-sm text-muted-foreground">
                        <Info size={16} className="mr-2 shrink-0"/>
                        {currentPetName} says:
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  {(isLoadingAi && petMessage.startsWith("Thinking")) || (isPetDataLoading && !petMessage) ? (
                    <Skeleton className="h-5 w-3/4 " /> 
                  ) : (
                    <p className="text-foreground text-center italic min-h-[2.5em] flex items-center justify-center">
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
                isLoading={isLoadingAi || !petData}
                className="rounded-none rounded-b-xl"
              />
            </CardFooter>
          </>
        )}
      </Card>
      {user && petData && !showPetSelection && (
        <Button variant="outline" onClick={callPetNeedsAI} disabled={isLoadingAi || Date.now() - lastAiCallTimestamp < AI_COOLDOWN} className="mt-4">
          {isLoadingAi ? "Consulting Wisdom..." : `What does ${currentPetName} need?`}
        </Button>
      )}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 selection:bg-primary/30 relative">
      {mainContent}
    </div>
  );
}

