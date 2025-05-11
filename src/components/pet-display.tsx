"use client";

import Image from "next/image";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
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
    <Card className={cn("w-full max-w-[200px] sm:max-w-xs md:max-w-sm shadow-lg mx-auto overflow-hidden", className)}>
      <CardContent className="flex flex-col items-center justify-center p-6 sm:p-8 md:p-10">
        <div className="relative w-36 h-36 sm:w-48 sm:h-48 md:w-60 md:h-60 rounded-lg overflow-hidden shadow-md">
          {imageUrl && (
            <Image
              key={imageUrl} 
              src={imageUrl}
              alt={altText}
              fill
              sizes="(max-width: 640px) 144px, (max-width: 768px) 192px, 240px"
              priority
              className="object-cover transition-all duration-500 ease-in-out transform group-hover:scale-105 animate-fadeIn"
              data-ai-hint={imageHint}
              unoptimized={imageUrl.startsWith('https://picsum.photos')} 
            />
          )}
        </div>
        <CardTitle className="text-l sm:text-xl md:text-3xl font-medium text-foreground mt-3 sm:mt-4 text-center">
          {petName}
        </CardTitle>
      </CardContent>
    </Card>
  );
}
