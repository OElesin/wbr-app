'use client'; // Required for useSession hook

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import SignInButton from '@/components/auth/SignInButton';
import SignOutButton from '@/components/auth/SignOutButton'; // Added for completeness, though SignInButton handles both states

export default function Home() {
  const { data: session, status } = useSession();

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-128px)] py-2"> {/* Adjusted min-height for header/footer */}
      <main className="flex flex-col items-center justify-center w-full flex-1 px-4 sm:px-20 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold mb-8 text-slate-800">
          Welcome to the WBR App
        </h1>

        {status === 'loading' && (
          <p className="text-lg text-slate-600">Loading session...</p>
        )}

        {status === 'authenticated' && session && (
          <>
            <p className="text-xl mb-4 text-slate-700">
              Signed in as <span className="font-semibold text-blue-600">{session.user?.name || session.user?.email}</span>
            </p>
            <p className="mb-6 text-slate-600 max-w-md">
              You can now access your WBR decks or create new ones.
            </p>
            <div className="space-x-0 sm:space-x-4 flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0">
              <Link href="/dashboard" className="px-6 py-3 text-lg font-semibold text-white bg-blue-500 rounded-md hover:bg-blue-600 transition-colors w-full sm:w-auto">
                  Go to Dashboard (Not Implemented)
              </Link>
              {/* SignOutButton is already in the header, but can be here too if desired */}
              {/* <SignOutButton /> */}
            </div>
          </>
        )}

        {status === 'unauthenticated' && (
          <>
            <p className="text-lg mb-6 text-slate-700 max-w-md">
              Please sign in to manage your Weekly Business Reviews.
            </p>
            {/* SignInButton internally checks session and might show user info if already signed in */}
            {/* We rely on the header's SignOutButton if already signed in */}
            <Link href="/auth/signin" className="px-6 py-3 text-lg font-semibold text-white bg-green-500 rounded-md hover:bg-green-600 transition-colors">
                Sign In / Sign Up
            </Link>
          </>
        )}

        <div className="mt-12 p-6 border border-slate-200 rounded-lg shadow-lg w-full max-w-2xl bg-white">
          <h2 className="text-2xl font-semibold mb-4 text-slate-700">About This App</h2>
          <p className="text-slate-600">
            This platform helps you automate and analyze your Weekly Business Reviews by integrating with your existing data sources like Google Sheets and Airtable, providing actionable insights to drive your business forward.
          </p>
        </div>

      </main>
    </div>
  );
}
