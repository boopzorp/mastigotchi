
"use client";

import type { User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth } from '@/lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      toast({
        title: "Signed In",
        description: "Welcome back!",
      });
      // onAuthStateChanged will handle setLoading(false) on success via setUser
    } catch (error: any) {
      console.error("Error signing in with email:", error);
      toast({
        title: "Sign-In Error",
        description: error.message || "Could not sign in. Please check your credentials.",
        variant: "destructive",
      });
      setLoading(false); 
    }
  };

  const signUpWithEmail = async (email: string, pass: string, displayName: string) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      if (userCredential.user) {
        await updateProfile(userCredential.user, { displayName });
        // Manually update user state here if onAuthStateChanged doesn't fire fast enough
        // or if immediate access to displayName is needed post-signup.
        // However, onAuthStateChanged should pick up the new user including profile updates.
      }
      toast({
        title: "Account Created",
        description: "Welcome! Your account has been successfully created.",
      });
       // onAuthStateChanged will handle setLoading(false) on success via setUser
    } catch (error: any) {
      console.error("Error signing up with email:", error);
      toast({
        title: "Sign-Up Error",
        description: error.message || "Could not create account. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
      // onAuthStateChanged will handle setting user to null and setLoading(false)
    } catch (error: any) {
      console.error("Error signing out:", error);
      toast({
        title: "Sign-Out Error",
        description: error.message || "Could not sign out. Please try again.",
        variant: "destructive",
      });
      setLoading(false); 
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
