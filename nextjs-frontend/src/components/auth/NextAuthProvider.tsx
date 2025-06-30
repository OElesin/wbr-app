'use client';

import { SessionProvider } from "next-auth/react";
import React from "react";

interface NextAuthProviderProps {
  children: React.ReactNode;
  // session?: any; // Optional: if you need to pass initial session state, useful for server-side pre-rendering of session
}

export default function NextAuthProvider({ children }: NextAuthProviderProps) {
  // The SessionProvider should be placed as high up as possible in your component tree.
  // In the App Router, this is typically in the root layout.
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
}
