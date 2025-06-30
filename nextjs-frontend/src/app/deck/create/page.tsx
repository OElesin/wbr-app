'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Metric {
  id: string;
  name: string;
  value: string;
  category: 'Input' | 'Output' | 'North Star' | '';
}

const MAX_METRICS = 12;

export default function CreateDeckPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [deckTitle, setDeckTitle] = useState('');
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [isLoading, setIsLoading] = useState(false); // For submission loading state
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/deck/create');
    }
  }, [authStatus, router]);

  const addMetric = () => {
    if (metrics.length < MAX_METRICS) {
      setMetrics([...metrics, { id: Date.now().toString(), name: '', value: '', category: '' }]);
    } else {
      alert(`You can add a maximum of ${MAX_METRICS} metrics.`);
    }
  };

  const handleMetricChange = (index: number, field: keyof Omit<Metric, 'id'>, value: string) => {
    const updatedMetrics = metrics.map((metric, i) =>
      i === index ? { ...metric, [field]: value } : metric
    );
    setMetrics(updatedMetrics);
  };

  const removeMetric = (index: number) => {
    setMetrics(metrics.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!deckTitle.trim()) {
      setError('Deck title is required.');
      return;
    }
    if (metrics.some(m => !m.name.trim() || !m.value.trim() || !m.category)) {
      setError('All metric fields (name, value, category) are required for every metric.');
      return;
    }

    setIsLoading(true);
    const deckData = {
      title: deckTitle.trim(),
      metrics: metrics.map(({ id, ...rest }) => rest), // Exclude temporary client-side id
    };

    try {
      const response = await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deckData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to create deck." }));
        throw new Error(errorData.message || `Error: ${response.status}`);
      }

      // const newDeck = await response.json(); // Contains the created deck with its new ID
      alert('Deck created successfully!');
      router.push('/dashboard');
    } catch (err) {
      console.error("Failed to create deck:", err);
      setError((err as Error).message || "Could not save the deck. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (authStatus === 'loading') {
    return <div className="flex justify-center items-center min-h-[calc(100vh-128px)]">Loading...</div>;
  }

  if (!session) {
     return (
      <div className="flex flex-col justify-center items-center min-h-screen">
        <p className="mb-4">You must be signed in to create a deck.</p>
        <Link href="/auth/signin" className="text-blue-500 hover:underline">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 transition-colors">&larr; Back to Dashboard</Link>
      </div>
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Create New WBR Deck</h1>

      {error && <p className="text-red-500 bg-red-100 p-3 rounded mb-4">{error}</p>}

      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-lg shadow-xl">
        <div className="mb-6">
          <label htmlFor="deckTitle" className="block text-sm font-medium text-slate-700 mb-1">
            Deck Title
          </label>
          <input
            type="text"
            id="deckTitle"
            value={deckTitle}
            onChange={(e) => setDeckTitle(e.target.value)}
            className="mt-1" // Styled by globals.css
            placeholder="e.g., Q4 Engineering Metrics"
            required
          />
        </div>

        <h2 className="text-xl font-semibold text-slate-700 mb-4">Metrics ({metrics.length}/{MAX_METRICS})</h2>
        {metrics.map((metric, index) => (
          <div key={metric.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 border border-slate-200 rounded-md bg-slate-50/50">
            <div className="md:col-span-2">
              <label htmlFor={`metricName-${index}`} className="block text-xs font-medium text-slate-600">
                Metric Name
              </label>
              <input
                type="text"
                id={`metricName-${index}`}
                value={metric.name}
                onChange={(e) => handleMetricChange(index, 'name', e.target.value)}
                className="mt-1" // Styled by globals.css
                placeholder="e.g., Active Users"
                required
              />
            </div>
            <div>
              <label htmlFor={`metricValue-${index}`} className="block text-xs font-medium text-slate-600">
                Value / Target
              </label>
              <input
                type="text"
                id={`metricValue-${index}`}
                value={metric.value}
                onChange={(e) => handleMetricChange(index, 'value', e.target.value)}
                className="mt-1" // Styled by globals.css
                placeholder="e.g., 1,200 or 75%"
                required
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor={`metricCategory-${index}`} className="block text-xs font-medium text-slate-600">
                Category
              </label>
              <div className="flex items-center">
                <select
                  id={`metricCategory-${index}`}
                  value={metric.category}
                  onChange={(e) => handleMetricChange(index, 'category', e.target.value as Metric['category'])}
                  className="mt-1 flex-grow" // Styled by globals.css
                  required
                >
                  <option value="" disabled>Select Category</option>
                  <option value="Input">Input Metric</option>
                  <option value="Output">Output Metric</option>
                  <option value="North Star">North Star Metric</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeMetric(index)}
                  className="ml-2 mt-1 px-2 py-1.5 text-red-600 hover:text-red-800 rounded-md hover:bg-red-100 transition-colors"
                  title="Remove Metric"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}

        {metrics.length < MAX_METRICS && (
          <button
            type="button"
            onClick={addMetric}
            className="mb-6 px-4 py-2 text-sm text-blue-600 border border-blue-500 rounded-md hover:bg-blue-50 hover:border-blue-600 transition-colors"
          >
            + Add Metric
          </button>
        )}
        {metrics.length === MAX_METRICS && (
            <p className="text-sm text-slate-500 mb-6">Maximum number of metrics reached.</p>
        )}

        <div className="mt-8 flex justify-end space-x-3">
          <Link href="/dashboard" className="btn-secondary px-6 py-2">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary px-6 py-2 font-semibold disabled:opacity-70"
          >
            {isLoading ? 'Saving...' : 'Save Deck'}
          </button>
        </div>
      </form>
    </div>
  );
}
