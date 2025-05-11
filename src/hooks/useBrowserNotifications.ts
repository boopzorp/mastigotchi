"use client";

import { type importType } from "fs";
import { useState, useEffect, useCallback } from 'react';

interface BrowserNotificationState {
  permission: NotificationPermission;
  isSupported: boolean;
}

export function useBrowserNotifications() {
  const [state, setState] = useState<BrowserNotificationState>({
    permission: 'default',
    isSupported: false,
  });

  useEffect(() => {
    // Ensure this effect only runs on the client
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setState({ permission: Notification.permission, isSupported: true });
    } else if (typeof window !== 'undefined') {
      setState({ permission: 'denied', isSupported: false });
    }
    // If window is undefined (server-side), initial state remains.
    // It will be updated once hydrated on the client.
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    if (Notification.permission !== 'default') return Notification.permission;

    const perm = await Notification.requestPermission();
    setState(prevState => ({ ...prevState, permission: perm }));
    return perm;
  }, []); // Removed state.isSupported from dependencies as it's checked inside

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (typeof window !== 'undefined' && 
        'Notification' in window && 
        Notification.permission === 'granted') {
      try {
        // Ensure service worker is ready before sending notification if applicable for more complex scenarios
        // For simple notifications, direct instantiation is fine.
        new Notification(title, options);
        return true;
      } catch (error) {
        console.error("Error sending notification:", error);
        return false;
      }
    }
    return false;
  }, []); // Removed state dependencies, directly checks Notification.permission

  return {
    permission: state.permission, // Return current permission state
    isSupported: state.isSupported, // Return support state
    requestPermission,
    sendNotification,
  };
}
