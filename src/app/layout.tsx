
import type {Metadata} from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Gamja_Flower as GamjaFlowerFont } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const gamjaFlower = GamjaFlowerFont({
  subsets: ['latin'],
  weight: ['400'], // Gamja Flower typically only has 400 weight
  variable: '--font-gamja-flower',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Pawtchi Pal',
  description: 'Your cute and cuddly virtual pet companion!',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${gamjaFlower.variable} antialiased`}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
