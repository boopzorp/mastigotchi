
"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import Image from "next/image";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PetDisplay } from "@/components/pet-display";
import { StatusIndicator } from "@/components/status-indicator";
import { InteractionButtons } from "@/components/interaction-buttons";
import { petNeedsAssessment, PetNeedsAssessmentInput } from "@/ai/flows/pet-needs-assessment";
import { Apple, Smile, Droplets, Info, LogOut, UserCircle, UserPlus, LogInIcon, PawPrint, SwitchCamera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot, Timestamp, collection, addDoc, deleteDoc, query, limit, getDocs } from "firebase/firestore";
import { PET_TYPES, type PetType } from "@/config/pets";

const INITIAL_HUNGER = 70;
const INITIAL_HAPPINESS = 80;
const INITIAL_CLEANLINESS = 75;
const MAX_PETS = 2;

const STAT_DECREASE_INTERVAL = 5000; // 5 seconds
const AI_COOLDOWN = 30000; // 30 seconds before AI can be called again

// Structure for data stored in Firestore (without the client-side 'id')
interface FirestorePetData {
  petName: string;
  selectedPetTypeId: string;
  hunger: number;
  happiness: number;
  cleanliness: number;
  lastUpdated: Timestamp;
}

// Structure used in the component's state, including the Firestore document ID
interface PetData extends FirestorePetData {
  id: string;
}

export default function PocketPalPage() {
  const { user, loading: authLoading, signInWithEmail, signUpWithEmail, signOut } = useAuth();
  const { toast } = useToast();

  const [userPets, setUserPets] = useState<PetData[]>([]);
  const [activePetId, setActivePetId] = useState<string | null>(null);
  
  const [petImage, setPetImage] = useState(PET_TYPES[0].images.default.url);
  const [petImageHint, setPetImageHint] = useState(PET_TYPES[0].images.default.hint);
  const [petMessage, setPetMessage] = useState("Welcome to Pocket Pal!");
  
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
  const [username, setUsername] = useState(''); // For sign-up

  const currentActivePet = userPets.find(p => p.id === activePetId);
  const currentPetDefinition = currentActivePet ? PET_TYPES.find(pt => pt.id === currentActivePet.selectedPetTypeId) : null;
  const currentPetDisplayName = currentActivePet?.petName || "Your Pal";

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
            setActivePetId(pets[0].id); // Default to first pet or if active pet was deleted
          }
          setShowPetSelectionScreen(false);
          setIsNamingPet(false); 
        } else {
          setActivePetId(null);
          setShowPetSelectionScreen(true); // No pets, show selection
        }
        setIsPetDataLoading(false);
      }, (error) => {
        console.error("Error fetching pets data:", error);
        toast({ title: "Error", description: "Could not load your pets.", variant: "destructive" });
        setUserPets([]);
        setActivePetId(null);
        setShowPetSelectionScreen(true);
        setIsPetDataLoading(false);
      });
      return () => unsubscribe();
    } else {
      // User logged out or not logged in
      setUserPets([]);
      setActivePetId(null);
      setPetImage(PET_TYPES[0].images.default.url);
      setPetImageHint(PET_TYPES[0].images.default.hint);
      setPetMessage("Welcome to Pocket Pal! Sign in or create an account.");
      setShowPetSelectionScreen(false);
      setIsNamingPet(false);
      setIsPetDataLoading(false);
    }
  }, [user, authLoading, toast]);


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
    if (!currentActivePet || !currentPetDefinition) {
      if (!user) {
         setPetImage(PET_TYPES[0].images.default.url);
         setPetImageHint(PET_TYPES[0].images.default.hint);
         setPetMessage("Sign in or create an account to get a Pocket Pal!");
      } else if (showPetSelectionScreen) {
         setPetImage(PET_TYPES[0].images.default.url);
         setPetImageHint(PET_TYPES[0].images.default.hint);
         setPetMessage("Choose your first Pocket Pal!");
      } else if (isNamingPet && speciesForNaming) {
        setPetImage(speciesForNaming.images.default.url);
        setPetImageHint(speciesForNaming.images.default.hint);
        setPetMessage(`What will you name your new ${speciesForNaming.name}?`);
      }
      return;
    }
    
    const images = currentPetDefinition.images;
    let currentImageSet = images.default;
    let message = `${currentActivePet.petName} is doing okay!`;

    const { hunger, happiness, cleanliness } = currentActivePet;
    if (hunger < 30) {
      currentImageSet = images.hungry;
      message = `${currentActivePet.petName} is so hungry...`;
    } else if (cleanliness < 30) {
      currentImageSet = images.dirty;
      message = `${currentActivePet.petName} feels a bit yucky...`;
    } else if (happiness < 30) {
      currentImageSet = images.sad;
      message = `${currentActivePet.petName} is feeling down...`;
    } else if (happiness > 90 && hunger > 80 && cleanliness > 80) {
      currentImageSet = images.content;
      message = `${currentActivePet.petName} is feeling great! Thanks to you!`;
    } else {
      currentImageSet = images.happy; 
    }
    
    setPetImage(currentImageSet.url);
    setPetImageHint(currentImageSet.hint);

    if (!isLoadingAi) {
        setPetMessage(message);
    }
  }, [currentActivePet, currentPetDefinition, isLoadingAi, user, showPetSelectionScreen, isNamingPet, speciesForNaming]);

  useEffect(() => {
    updatePetVisualsAndMessage();
  }, [currentActivePet, currentPetDefinition, updatePetVisualsAndMessage]);

  useEffect(() => {
    if (!user || !currentActivePet || showPetSelectionScreen || isNamingPet) return;

    const intervalId = setInterval(() => {
      setUserPets(prevPets => 
        prevPets.map(p => {
          if (p.id !== activePetId) return p;

          const newHunger = Math.max(0, p.hunger - Math.floor(Math.random() * 3 + 1));
          const newCleanliness = Math.max(0, p.cleanliness - Math.floor(Math.random() * 2 + 1));
          let newHappiness = p.happiness;
          if (newHunger < 40) newHappiness -= 1;
          if (newCleanliness < 40) newHappiness -=1;
          if (newHappiness === p.happiness && p.happiness > 0) newHappiness -=1;
          
          const updatedPet = {
            ...p,
            hunger: newHunger,
            cleanliness: newCleanliness,
            happiness: Math.max(0, newHappiness),
          };
          // Firestore update is done here to avoid rapid writes if state updates frequently
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
  
  useEffect(() => {
    if (!user || !currentActivePet || isLoadingAi || showPetSelectionScreen || isNamingPet) return;
    if ((currentActivePet.hunger < 25 || currentActivePet.happiness < 25 || currentActivePet.cleanliness < 25) && (Date.now() - lastAiCallTimestamp > AI_COOLDOWN)) {
      callPetNeedsAI();
    }
  }, [currentActivePet, isLoadingAi, lastAiCallTimestamp, callPetNeedsAI, showPetSelectionScreen, isNamingPet]);

  const handleInteraction = (statUpdater: (prevPet: PetData) => Partial<PetData>, message: string, toastMessage: string) => {
    if (!currentActivePet || !user || showPetSelectionScreen || isNamingPet) return;
    
    setUserPets(prevPets => 
      prevPets.map(p => {
        if (p.id !== activePetId) return p;
        const changes = statUpdater(p);
        const updatedPet = {
          ...p,
          ...changes,
          hunger: Math.min(100, Math.max(0, changes.hunger ?? p.hunger)),
          happiness: Math.min(100, Math.max(0, changes.happiness ?? p.happiness)),
          cleanliness: Math.min(100, Math.max(0, changes.cleanliness ?? p.cleanliness)),
        };
        saveSinglePetData(p.id, {
          hunger: updatedPet.hunger,
          happiness: updatedPet.happiness,
          cleanliness: updatedPet.cleanliness,
        });
        return updatedPet;
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

  const handleSelectSpeciesForNaming = (petDefinition: PetType) => {
    if (!user || userPets.length >= MAX_PETS) {
      toast({ title: "Oops!", description: `You can only have up to ${MAX_PETS} pets.`, variant: "destructive" });
      return;
    }
    setSpeciesForNaming(petDefinition);
    setIsNamingPet(true);
    setShowPetSelectionScreen(false);
    setNewPetNameInput(petDefinition.defaultName); // Pre-fill with default name
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
    };

    try {
      const petDocRef = await addDoc(collection(db, "users", user.uid, "pets"), newPetFirestoreData);
      // The onSnapshot listener will update userPets and handle activePetId if needed.
      // We can optimistically set the new pet as active.
      setActivePetId(petDocRef.id);
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
    // Clear form fields after submission attempt is handled by AuthContext or here if needed
    // setEmail(''); setPassword(''); setUsername(''); // Keep if auth context doesn't clear them
  };

  const handleAdoptNewPetClick = () => {
    if (userPets.length < MAX_PETS) {
      setShowPetSelectionScreen(true);
    } else {
      toast({ title: "Max Pets Reached", description: `You already have ${MAX_PETS} pets.`, variant: "default"});
    }
  };

  const AuthArea = () => (
    <div className="absolute top-4 right-4 z-10">
      {user && (
        <div className="flex items-center gap-2">
           {user.photoURL ? 
             <Image src={user.photoURL} alt="User avatar" width={32} height={32} className="rounded-full" /> :
             <UserCircle size={32} />
           }
           <span className="text-sm text-foreground hidden sm:inline">{user.displayName || user.email}</span>
          <Button variant="outline" size="sm" onClick={signOut} disabled={authLoading}>
            <LogOut size={16} className="mr-1 sm:mr-2"/> Sign Out
          </Button>
        </div>
      )}
    </div>
  );

  const PetSelectionUI = () => (
    <Card className="w-full max-w-md shadow-2xl rounded-xl overflow-hidden bg-card mt-8">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Choose Your Pocket Pal!</CardTitle>
        <CardDescription className="text-center">Select a species for your new companion.</CardDescription>
      </CardHeader>
      <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PET_TYPES.map((petDef) => (
          <Button 
            key={petDef.id} 
            onClick={() => handleSelectSpeciesForNaming(petDef)} 
            className="w-full justify-start py-6 text-lg h-auto flex-col items-center sm:flex-row sm:items-center sm:text-left" 
            variant="outline"
            disabled={userPets.length >= MAX_PETS}
          >
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
       <CardFooter>
        <Button variant="ghost" onClick={() => { setShowPetSelectionScreen(false); if(userPets.length === 0 && user) signOut(); /* force re-auth if stuck */}} className="w-full">
            Cancel
        </Button>
      </CardFooter>
    </Card>
  );

  const PetNamingUI = () => (
    <Card className="w-full max-w-md shadow-2xl rounded-xl overflow-hidden bg-card mt-8">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Name Your New Pal!</CardTitle>
        {speciesForNaming && <CardDescription className="text-center">You've chosen a {speciesForNaming.name}. What will you call it?</CardDescription>}
      </CardHeader>
      <form onSubmit={handleNamePetSubmit}>
        <CardContent className="p-6 space-y-4">
            {speciesForNaming && (
                 <Image 
                    src={speciesForNaming.images.default.url} 
                    alt={speciesForNaming.name} 
                    width={100} 
                    height={100} 
                    className="mx-auto rounded-md mb-4"
                    data-ai-hint={speciesForNaming.images.default.hint}
                />
            )}
          <div>
            <Label htmlFor="petName">Pet's Name</Label>
            <Input 
              id="petName" 
              type="text" 
              placeholder="e.g., Sparky" 
              value={newPetNameInput} 
              onChange={(e) => setNewPetNameInput(e.target.value)} 
              required 
              className="mt-1"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between p-4">
          <Button variant="ghost" type="button" onClick={() => { setIsNamingPet(false); setSpeciesForNaming(null); setShowPetSelectionScreen(true); /* Go back to species selection */ }}>Back</Button>
          <Button type="submit">Adopt {newPetNameInput || "Pal"}!</Button>
        </CardFooter>
      </form>
    </Card>
  );

  const PetSwitcherUI = () => (
    userPets.length > 1 && (
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {userPets.map(pet => (
          <Button 
            key={pet.id} 
            variant={pet.id === activePetId ? "default" : "outline"}
            onClick={() => setActivePetId(pet.id)}
            size="sm"
            className="shadow-md"
          >
            <PawPrint size={16} className="mr-2"/>
            {pet.petName}
          </Button>
        ))}
      </div>
    )
  );

  if (authLoading || (user && isPetDataLoading && !showPetSelectionScreen && !isNamingPet && userPets.length === 0)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 selection:bg-primary/30">
        { user && <AuthArea /> }
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
          <CardContent className="p-6 space-y-6">
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <CardTitle className="text-2xl font-bold text-center mb-4">
                {authAction === 'signin' ? 'Sign In' : 'Create Account'}
              </CardTitle>
              {authAction === 'signup' && (
                 <div>
                    <Label htmlFor="username">Username</Label>
                    <Input 
                    id="username" 
                    type="text" 
                    placeholder="Your Username" 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                    required 
                    className="mt-1"
                    />
                </div>
              )}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="you@example.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  className="mt-1"
                />
              </div>
              <Button type="submit" className="w-full" disabled={authLoading}>
                {authAction === 'signin' ? (
                  <> <LogInIcon size={18} className="mr-2" /> Sign In </>
                ) : (
                  <> <UserPlus size={18} className="mr-2" /> Create Account </>
                )}
              </Button>
            </form>
            <Button 
              variant="link" 
              className="w-full" 
              onClick={() => setAuthAction(authAction === 'signin' ? 'signup' : 'signin')}
            >
              {authAction === 'signin' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </Button>
            <PetDisplay
              petName={PET_TYPES[0].defaultName}
              imageUrl={petImage}
              altText={`Image of default pet`}
              imageHint={petImageHint}
            />
            <p className="text-lg text-foreground my-4 text-center">{petMessage}</p>
          </CardContent>
        ) : showPetSelectionScreen ? (
           <PetSelectionUI />
        ) : isNamingPet ? (
            <PetNamingUI />
        ) : !currentActivePet || !currentPetDefinition ? ( 
          <CardContent className="p-6 text-center min-h-[400px] flex flex-col justify-center items-center">
            <Skeleton className="w-48 h-48 rounded-full mx-auto mb-4" />
            <Skeleton className="w-3/4 h-8 mx-auto mb-2" />
            <Skeleton className="w-1/2 h-6 mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading your Pal...</p>
             {userPets.length === 0 && !isPetDataLoading && (
                <Button onClick={handleAdoptNewPetClick} className="mt-4">Adopt First Pal</Button>
             )}
          </CardContent>
        ): (
          <>
            <CardContent className="p-6 space-y-6">
              <PetDisplay
                petName={currentPetDisplayName}
                imageUrl={petImage}
                altText={`Image of ${currentPetDisplayName}`}
                imageHint={petImageHint}
              />

              <div className="space-y-3 pt-4">
                <StatusIndicator label="Hunger" value={currentActivePet.hunger} icon={<Apple className="w-5 h-5" />} />
                <StatusIndicator label="Happiness" value={currentActivePet.happiness} icon={<Smile className="w-5 h-5" />} />
                <StatusIndicator label="Cleanliness" value={currentActivePet.cleanliness} icon={<Droplets className="w-5 h-5" />} />
              </div>

              <Card className="bg-card/50 shadow-inner">
                <CardHeader className="pb-2 pt-3 px-4">
                    <CardDescription className="flex items-center text-sm text-muted-foreground">
                        <Info size={16} className="mr-2 shrink-0"/>
                        {currentPetDisplayName} says:
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
                isLoading={isLoadingAi || !currentActivePet}
                className="rounded-none rounded-b-xl"
              />
            </CardFooter>
          </>
        )}
      </Card>
      
      {user && currentActivePet && !showPetSelectionScreen && !isNamingPet && (
        <Button variant="outline" onClick={callPetNeedsAI} disabled={isLoadingAi || Date.now() - lastAiCallTimestamp < AI_COOLDOWN} className="mt-4">
          {isLoadingAi ? "Consulting Wisdom..." : `What does ${currentPetDisplayName} need?`}
        </Button>
      )}

      {user && userPets.length > 0 && userPets.length < MAX_PETS && !showPetSelectionScreen && !isNamingPet && (
         <Button variant="secondary" onClick={handleAdoptNewPetClick} className="mt-4 shadow-md">
            <PawPrint size={18} className="mr-2" /> Adopt Another Pal
          </Button>
      )}
      {user && <PetSwitcherUI />}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 selection:bg-primary/30 relative">
      {mainContent}
    </div>
  );
}
