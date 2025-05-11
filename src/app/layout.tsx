
import type {Metadata} from 'next';
import { DotGothic16 } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext';

// Configure DotGothic16 for global use
const dotGothic16 = DotGothic16({
  weight: '400', // DotGothic16 generally only supports 400 weight
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dot-gothic-16', // Define a CSS variable
});


export const metadata: Metadata = {
  title: 'mastigotchi', // This title is for the browser tab
  description: 'Your cute and cuddly virtual pet companion!',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Apply the DotGothic16 font variable to the body */}
      {/* Tailwind will pick this up if `sans` is configured to use this variable */}
      {/* Alternatively, globals.css will apply it directly to the body */}
      <body className={`${dotGothic16.variable} antialiased`}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}

