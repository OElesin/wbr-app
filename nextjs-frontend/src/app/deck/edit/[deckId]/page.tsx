'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Metric {
  id: string;
  name: string;
  value: string;
  category: 'Input' | 'Output' | 'North Star' | '';
}

// For Prisma's JSON metrics, they won't have a client-side 'id' field by default
interface MetricData {
    name: string;
    value: string;
    category: 'Input' | 'Output' | 'North Star' | '';
}

interface WBRDeckFromAPI {
    id: string;
    title: string;
    metrics: MetricData[]; // Metrics from DB/API
    updatedAt: string;
    ownerId: string;
}


const MAX_METRICS = 12;

export default function EditDeckPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const deckId = params.deckId as string;

  const [deckTitle, setDeckTitle] = useState('');
  const [metrics, setMetrics] = useState<Metric[]>([]); // Metrics for UI state, with client 'id'
  const [isLoadingData, setIsLoadingData] = useState(true); // For loading initial deck data
  const [isSubmitting, setIsSubmitting] = useState(false); // For form submission
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push(`/auth/signin?callbackUrl=/deck/edit/${deckId}`);
    }
  }, [authStatus, router, deckId]);

  useEffect(() => {
    if (deckId && authStatus === 'authenticated') {
      setIsLoadingData(true);
      setError(null);
      fetch(`/api/decks/${deckId}`)
        .then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: "Failed to fetch deck data" }));
            throw new Error(errorData.message || `Error: ${res.status}`);
          }
          return res.json();
        })
        .then((data: WBRDeckFromAPI) => {
          setDeckTitle(data.title);
          // Convert API metrics to UI metrics with client-side IDs
          setMetrics(data.metrics.map((m, index) => ({ ...m, id: `metric-${index}-${Date.now()}` })));
        })
        .catch(err => {
          console.error("Failed to fetch deck data:", err);
          setError((err as Error).message || 'Failed to load deck data.');
        })
        .finally(() => setIsLoadingData(false));
    }
  }, [deckId, authStatus]);


  const addMetric = () => {
    if (metrics.length < MAX_METRICS) {
      setMetrics([...metrics, { id: `new-${Date.now().toString()}`, name: '', value: '', category: '' }]);
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

    setIsSubmitting(true);
    const deckDataToSubmit = {
      title: deckTitle.trim(),
      metrics: metrics.map(({ id, ...rest }) => rest), // Remove client 'id' before sending
    };

    try {
        const response = await fetch(`/api/decks/${deckId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify(deckDataToSubmit),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: "Failed to update deck." }));
            throw new Error(errorData.message || `Error: ${response.status}`);
        }
        alert('Deck updated successfully!');
        router.push('/dashboard');
    } catch (err) {
        console.error('Failed to update deck:', err);
        setError((err as Error).message || "Could not update deck. Please try again.");
    } finally {
        setIsSubmitting(false);
    }
  };

  if (authStatus === 'loading' || isLoadingData) {
    return <div className="flex justify-center items-center min-h-[calc(100vh-128px)]">Loading deck data...</div>;
  }

  if (!session) { // Should be caught by useEffect redirect
    return (
     <div className="flex flex-col justify-center items-center min-h-screen">
       <p className="mb-4">You must be signed in to edit a deck.</p>
       <Link href="/auth/signin" className="text-blue-500 hover:underline">
         Sign In
       </Link>
     </div>
   );
 }

  if (error && !isLoadingData) { // Show error only if not loading initial data
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-red-500 text-xl bg-red-100 p-4 rounded-md">{error}</p>
        <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
          &larr; Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!deckTitle && !isLoadingData) { // If no title after loading, implies deck not found or error handled above
    return (
        <div className="container mx-auto px-4 py-8 text-center">
            <p className="text-slate-700 text-xl">Deck not found or you don&apos;t have access.</p>
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
            &larr; Back to Dashboard
            </Link>
        </div>
    );
  }


  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 transition-colors">&larr; Back to Dashboard</Link>
      </div>
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Edit WBR Deck</h1>

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
            disabled={isSubmitting}
            className="btn-primary px-6 py-2 font-semibold disabled:opacity-70"
          >
            {isSubmitting ? 'Updating...' : 'Update Deck'}
          </button>
        </div>
      </form>
    </div>
  );
}
