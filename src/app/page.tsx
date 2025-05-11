"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PetDisplay } from "@/components/pet-display";
import { StatusIndicator } from "@/components/status-indicator";
import { InteractionButtons } from "@/components/interaction-buttons";
import { petNeedsAssessment, PetNeedsAssessmentInput } from "@/ai/flows/pet-needs-assessment";
import { Apple, Smile, Droplets, AlertTriangle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const PET_NAME = "Sparky";
const INITIAL_HUNGER = 70;
const INITIAL_HAPPINESS = 80;
const INITIAL_CLEANLINESS = 75;

const STAT_DECREASE_INTERVAL = 5000; // 5 seconds
const AI_CHECK_INTERVAL = 20000; // 20 seconds
const AI_COOLDOWN = 30000; // 30 seconds before AI can be called again by stat drop

// URLs for pet images - using picsum.photos with distinct seeds for variety
const PET_IMAGES = {
  happy: { url: "https://picsum.photos/seed/palhappy/300/300", hint: "cute happy animal" },
  hungry: { url: "https://picsum.photos/seed/palhungry/300/300", hint: "cute hungry animal" },
  sad: { url: "https://picsum.photos/seed/palsad/300/300", hint: "cute sad animal" },
  dirty: { url: "https://picsum.photos/seed/paldirty/300/300", hint: "cute dirty animal" },
  content: { url: "https://picsum.photos/seed/palcontent/300/300", hint: "cute content animal" },
};

export default function PocketPalPage() {
  const [hunger, setHunger] = useState(INITIAL_HUNGER);
  const [happiness, setHappiness] = useState(INITIAL_HAPPINESS);
  const [cleanliness, setCleanliness] = useState(INITIAL_CLEANLINESS);
  
  const [petImage, setPetImage] = useState(PET_IMAGES.happy.url);
  const [petImageHint, setPetImageHint] = useState(PET_IMAGES.happy.hint);
  const [petMessage, setPetMessage] = useState("Hello! I'm happy to see you!");
  
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [lastAiCallTimestamp, setLastAiCallTimestamp] = useState(0);

  const { toast } = useToast();

  const updatePetVisualsAndMessage = useCallback(() => {
    let currentImage = PET_IMAGES.happy;
    if (hunger < 30) currentImage = PET_IMAGES.hungry;
    else if (cleanliness < 30) currentImage = PET_IMAGES.dirty;
    else if (happiness < 30) currentImage = PET_IMAGES.sad;
    else if (happiness > 90 && hunger > 80 && cleanliness > 80) currentImage = PET_IMAGES.content;
    
    setPetImage(currentImage.url);
    setPetImageHint(currentImage.hint);

    // Simple default messages based on primary low stat
    if (hunger < 30) setPetMessage("I'm so hungry...");
    else if (cleanliness < 30) setPetMessage("I feel a bit yucky...");
    else if (happiness < 30) setPetMessage("I'm feeling down...");
    else if (happiness > 90 && hunger > 80 && cleanliness > 80) setPetMessage("I'm feeling great! Thanks to you!");
    else setPetMessage("I'm doing okay!");

  }, [hunger, happiness, cleanliness]);

  useEffect(() => {
    updatePetVisualsAndMessage();
  }, [hunger, happiness, cleanliness, updatePetVisualsAndMessage]);


  useEffect(() => {
    const intervalId = setInterval(() => {
      setHunger((h) => Math.max(0, h - Math.floor(Math.random() * 3 + 1))); // Decrease by 1-3
      setCleanliness((c) => Math.max(0, c - Math.floor(Math.random() * 2 + 1))); // Decrease by 1-2
      setHappiness((h) => {
        let newHappiness = h;
        if (hunger < 40) newHappiness -= 1;
        if (cleanliness < 40) newHappiness -=1;
        if (newHappiness === h) newHappiness -=1; // general small decrease
        return Math.max(0, newHappiness);
      });
    }, STAT_DECREASE_INTERVAL);
    return () => clearInterval(intervalId);
  }, [hunger, cleanliness]); // Added hunger/cleanliness to deps for happiness calculation logic

  const callPetNeedsAI = useCallback(async () => {
    if (isLoadingAi || Date.now() - lastAiCallTimestamp < AI_COOLDOWN) {
      // console.log("AI call skipped due to loading state or cooldown.");
      return;
    }

    setIsLoadingAi(true);
    setLastAiCallTimestamp(Date.now());
    // setPetMessage("Thinking about what I need...");

    try {
      const assessmentInput: PetNeedsAssessmentInput = { hunger, happiness, cleanliness };
      const result = await petNeedsAssessment(assessmentInput);
      setPetMessage(result.needs);
      toast({
        title: "Pocket Pal Says:",
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
  }, [hunger, happiness, cleanliness, isLoadingAi, lastAiCallTimestamp, toast]);
  
  useEffect(() => {
    // Automatically call AI if a stat is critically low and cooldown has passed
    if (!isLoadingAi && (hunger < 25 || happiness < 25 || cleanliness < 25) && (Date.now() - lastAiCallTimestamp > AI_COOLDOWN)) {
      callPetNeedsAI();
    }
  }, [hunger, happiness, cleanliness, isLoadingAi, lastAiCallTimestamp, callPetNeedsAI]);


  const handleFeed = () => {
    setHunger((h) => Math.min(100, h + 25 + Math.floor(Math.random() * 10)));
    setHappiness((h) => Math.min(100, h + 5 + Math.floor(Math.random() * 5)));
    setPetMessage("Yummy! That hit the spot!");
    toast({ description: "You fed ${PET_NAME}!" });
  };

  const handlePlay = () => {
    setHappiness((h) => Math.min(100, h + 30 + Math.floor(Math.random() * 10)));
    setHunger((h) => Math.max(0, h - 5 - Math.floor(Math.random() * 5)));
    setPetMessage("Whee! That was fun!");
    toast({ description: "You played with ${PET_NAME}!" });
  };

  const handleClean = () => {
    setCleanliness((c) => Math.min(100, c + 40 + Math.floor(Math.random() * 10)));
    setHappiness((h) => Math.min(100, h + 10 + Math.floor(Math.random() * 5)));
    setPetMessage("So fresh and so clean!");
    toast({ description: "You cleaned ${PET_NAME}!" });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 selection:bg-primary/30">
      <Card className="w-full max-w-lg shadow-2xl rounded-xl overflow-hidden bg-card">
        <CardHeader className="text-center border-b border-border pb-4 pt-6">
          <CardTitle className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent-foreground">
            Pocket Pal
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <PetDisplay
            petName={PET_NAME}
            imageUrl={petImage}
            altText={`Image of ${PET_NAME}`}
            imageHint={petImageHint}
          />

          <div className="space-y-3 pt-4">
            <StatusIndicator label="Hunger" value={hunger} icon={<Apple className="w-5 h-5" />} />
            <StatusIndicator label="Happiness" value={happiness} icon={<Smile className="w-5 h-5" />} />
            <StatusIndicator label="Cleanliness" value={cleanliness} icon={<Droplets className="w-5 h-5" />} />
          </div>

          <Card className="bg-card/50 shadow-inner">
            <CardHeader className="pb-2 pt-3 px-4">
                <CardDescription className="flex items-center text-sm text-muted-foreground">
                    <Info size={16} className="mr-2 shrink-0"/>
                    {PET_NAME} says:
                </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {isLoadingAi && !petMessage.startsWith("Thinking") ? (
                 <Skeleton className="h-5 w-3/4" />
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
            isLoading={isLoadingAi}
            className="rounded-none rounded-b-xl"
          />
        </CardFooter>
      </Card>
      <Button variant="outline" onClick={callPetNeedsAI} disabled={isLoadingAi || Date.now() - lastAiCallTimestamp < AI_COOLDOWN} className="mt-4">
        {isLoadingAi ? "Consulting Wisdom..." : "What does Sparky need?"}
      </Button>
    </div>
  );
}
