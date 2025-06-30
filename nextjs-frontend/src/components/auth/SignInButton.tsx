'use client';

import { signIn, useSession } from 'next-auth/react';
import Link from 'next/link'; // Recommended for internal navigation

export default function SignInButton() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <button className="px-4 py-2 font-semibold text-white bg-gray-400 rounded-md cursor-wait" disabled>Loading...</button>;
  }

  // If session exists, user is signed in.
  // You might want to show a sign out button or user info instead.
  // For this component, we'll assume its primary purpose is to initiate sign-in.
  // Or, it could change its behavior based on session status.
  if (session) {
    // Example: Show user's email and a link to a hypothetical profile page
    return (
      <div className="flex items-center space-x-4">
        <span className="text-sm text-gray-700">Signed in as {session.user?.email || session.user?.name}</span>
        {/* Optionally, add a SignOutButton here or navigate to a page with it */}
      </div>
    );
  }

  // If no session, show sign-in button
  return (
    <button
      onClick={() => signIn()} // Redirects to the sign-in page configured in NextAuth options
      className="px-4 py-2 font-semibold text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-opacity-50"
    >
      Sign In
    </button>
  );
}
