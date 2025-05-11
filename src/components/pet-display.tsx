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
    <Card className={cn("w-full max-w-[200px] sm:max-w-xs md:max-w-sm shadow-lg mx-auto", className)}>
      <CardHeader className="items-center pb-1 sm:pb-2 pt-2 sm:pt-4">
        <CardTitle className="text-xl sm:text-2xl md:text-3xl font-medium text-foreground">{petName}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center p-2 sm:p-4 md:p-6">
        <div className="relative w-36 h-36 sm:w-48 sm:h-48 md:w-64 md:h-64 rounded-full overflow-hidden shadow-md border-2 sm:border-4 border-primary/50">
          {imageUrl && (
            <Image
              key={imageUrl} 
              src={imageUrl}
              alt={altText}
              width={300}
              height={300}
              priority
              className="object-cover w-full h-full transition-all duration-500 ease-in-out transform group-hover:scale-105 animate-fadeIn"
              data-ai-hint={imageHint}
              unoptimized={imageUrl.startsWith('https://picsum.photos')} 
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
