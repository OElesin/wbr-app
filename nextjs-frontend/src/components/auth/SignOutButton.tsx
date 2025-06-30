'use client';

import { signOut, useSession } from 'next-auth/react';

export default function SignOutButton() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <button className="px-4 py-2 font-semibold text-white bg-gray-400 rounded-md cursor-wait" disabled>Loading...</button>;
  }

  if (!session) {
    // If there's no session, don't render the sign-out button.
    return null;
  }

  return (
    <button
      onClick={() => signOut({ callbackUrl: '/' })} // Redirect to homepage after sign out
      className="px-4 py-2 font-semibold text-white bg-red-500 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-700 focus:ring-opacity-50"
    >
      Sign Out
    </button>
  );
}
