
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
    <Card className={cn("w-full max-w-xs sm:max-w-sm shadow-lg mx-auto", className)}>
      <CardHeader className="items-center pb-2">
        <CardTitle className="text-3xl font-medium text-foreground">{petName}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="relative w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 rounded-full overflow-hidden shadow-md border-4 border-primary/50">
          {imageUrl && (
            <Image
              key={imageUrl} // Key helps Next.js detect image change for transitions/re-renders
              src={imageUrl}
              alt={altText}
              width={300}
              height={300}
              priority
              className="object-cover w-full h-full transition-all duration-500 ease-in-out transform group-hover:scale-105 animate-fadeIn"
              data-ai-hint={imageHint}
              unoptimized={imageUrl.startsWith('https://picsum.photos')} // Useful for development with rapidly changing seeded images
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Add fadeIn animation to tailwind.config.ts or globals.css if not already present
// tailwind.config.ts should have:
// keyframes: {
//   fadeIn: {
//     '0%': { opacity: '0', transform: 'scale(0.95)' },
//     '100%': { opacity: '1', transform: 'scale(1)' },
//   },
// },
// animation: {
//   fadeIn: 'fadeIn 0.5s ease-in-out',
// }
// It is already present.
