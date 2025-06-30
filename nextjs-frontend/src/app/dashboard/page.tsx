'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react'; // Added useState

// Define WBRDeck type based on Prisma schema (or expected API response)
interface WBRDeck {
  id: string;
  title: string;
  updatedAt: string; // Assuming it comes as ISO string
  // Add other fields if needed, like 'metrics' if you want to show a preview
}

export default function DashboardPage() {
  const { data: session, status: authStatus } = useSession(); // Renamed status to authStatus
  const router = useRouter();
  const [wbrDecks, setWbrDecks] = useState<WBRDeck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/dashboard');
    }
  }, [authStatus, router]);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      setIsLoading(true);
      setError(null);
      fetch('/api/decks')
        .then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: "Failed to fetch decks" }));
            throw new Error(errorData.message || `Error: ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          setWbrDecks(data);
        })
        .catch((err) => {
          console.error("Failed to fetch WBR decks:", err);
          setError(err.message || "Could not load your WBR decks.");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [authStatus]);

  const handleDeleteDeck = async (deckId: string) => {
    if (!confirm('Are you sure you want to delete this deck? This action cannot be undone.')) {
      return;
    }
    try {
      const response = await fetch(`/api/decks/${deckId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to delete deck" }));
        throw new Error(errorData.message || `Error: ${response.status}`);
      }
      // Remove deleted deck from state
      setWbrDecks(prevDecks => prevDecks.filter(deck => deck.id !== deckId));
      alert('Deck deleted successfully.');
    } catch (err) {
      console.error("Failed to delete deck:", err);
      setError((err as Error).message || "Could not delete the deck.");
      alert(`Error deleting deck: ${(err as Error).message}`);
    }
  };


  if (authStatus === 'loading' || (authStatus === 'authenticated' && isLoading)) {
    return <div className="flex justify-center items-center min-h-[calc(100vh-128px)]">Loading dashboard...</div>;
  }

  if (!session) {
    // This case should ideally be handled by the useEffect redirect,
    // but as a fallback:
    return (
      <div className="flex flex-col justify-center items-center min-h-screen">
        <p className="mb-4">You must be signed in to view the dashboard.</p>
        <Link href="/auth/signin" className="text-blue-500 hover:underline">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Your WBR Decks</h1>
        <Link href="/deck/create" className="btn-primary px-6 py-2 font-semibold">
          Create New Deck
        </Link>
      </div>

      {error && <p className="text-red-500 bg-red-100 p-3 rounded mb-4">{error}</p>}

      {wbrDecks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wbrDecks.map((deck) => (
            <div key={deck.id} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-700 mb-2">{deck.title}</h2>
                <p className="text-sm text-slate-500 mb-4">
                  Last Modified: {new Date(deck.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex space-x-3 mt-auto pt-4 border-t border-slate-100">
                <Link href={`/deck/edit/${deck.id}`} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                  Edit
                </Link>
                <button
                  onClick={() => handleDeleteDeck(deck.id)}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !isLoading && !error && ( // Only show "no decks" if not loading and no error
          <div className="text-center py-12 bg-white p-8 rounded-lg shadow">
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            <h3 className="mt-2 text-xl font-medium text-slate-900">No WBR decks</h3>
            <p className="mt-1 text-slate-500">Get started by creating a new deck.</p>
            <div className="mt-6">
              <Link href="/deck/create" className="btn-primary">
                Create New Deck
              </Link>
            </div>
          </div>
        )
      )}
    </div>
  );
}
