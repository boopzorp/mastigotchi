"use client";

import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PetDisplayProps {
  petName: string;
  imageUrl: string;
  altText: string;
  imageHint: string;
  className?: string;
}

export function PetDisplay({ petName, imageUrl, altText, imageHint, className }: PetDisplayProps) {
  return (
    <Card className={cn("w-full max-w-sm shadow-lg", className)}>
      <CardHeader className="items-center pb-2">
        <CardTitle className="text-3xl font-medium text-foreground">{petName}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center p-6">
        <div className="relative w-64 h-64 md:w-72 md:h-72 rounded-full overflow-hidden shadow-md border-4 border-primary/50">
          <Image
            key={imageUrl} // Add key to re-trigger animation on image change
            src={imageUrl}
            alt={altText}
            width={300}
            height={300}
            priority
            className="object-cover w-full h-full transition-transform duration-500 ease-in-out transform hover:scale-105 animate-fadeIn"
            data-ai-hint={imageHint}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Add fadeIn animation to tailwind.config.ts or globals.css if not already present
// For simplicity, here's a basic CSS animation you might add to globals.css if needed:
/*
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.animate-fadeIn {
  animation: fadeIn 0.5s ease-in-out;
}
*/
// This is typically handled by tailwindcss-animate, check tailwind.config.ts for `animate-in fade-in-0` or similar.
// ShadCN already provides `animate-in` and `fade-in-0` which can be used.
// The example above uses a simple custom one for demonstration.
// Using animate-in from tailwindcss-animate:
// className="object-cover w-full h-full data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
// This requires a trigger, so direct animation class is simpler here.
// Let's assume tailwind.config.ts and globals.css are set up for basic animations.
