'use client';

import { signIn, getProviders, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

type Provider = {
  id: string;
  name: string;
  type: string;
  signinUrl: string;
  callbackUrl: string;
};

type Providers = Record<string, Provider>;

export default function SignInPage() {
  const { data: session, status } = useSession();
  const [providers, setProviders] = useState<Providers | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); // For credentials sign-in loading state

  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'; // Default to dashboard

  useEffect(() => {
    if (status === 'authenticated') {
      router.push(callbackUrl); // If already authenticated, redirect
    }
  }, [status, router, callbackUrl]);

  useEffect(() => {
    const fetchProviders = async () => {
      const res = await getProviders();
      setProviders(res);
    };
    fetchProviders();
  }, []);

  // Display error from NextAuth if any (e.g., incorrect credentials)
  useEffect(() => {
    const authError = searchParams.get('error');
    if (authError) {
      switch (authError) {
        case "CredentialsSignin":
          setError("Invalid email or password. Please try again.");
          break;
        case "OAuthAccountNotLinked":
            setError("This email is already linked with another account (e.g. Google). Try signing in with that method.");
            break;
        default:
          setError("An error occurred during sign in. Please try again.");
      }
    }
  }, [searchParams]);


  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn('credentials', {
      redirect: false, // We handle redirect or error manually
      email,
      password,
      callbackUrl: callbackUrl,
    });
    setLoading(false);

    if (result?.error) {
      console.error("Sign in error:", result.error);
      // Error messages are now handled by the useEffect above based on URL query param
      // but we can set a generic one if needed, or specific based on result.error if not using query param for it
      if (result.error === "CredentialsSignin") {
          setError("Invalid email or password. Please try again.");
      } else {
          setError(result.error || "Sign in failed. Please check your credentials.");
      }
    } else if (result?.ok && result?.url) {
      // Successful sign in, NextAuth usually handles redirect if redirect:true
      // Since redirect:false, we push to the callbackUrl
      router.push(callbackUrl);
    } else if (result?.ok && !result.url) {
        // This case might happen if callbackUrl is the current page
        router.push(callbackUrl);
    }
  };

  if (status === 'loading' || !providers) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  // If user is already authenticated, they shouldn't see this page (redirected by useEffect)
  // but as a fallback:
  if (session) {
     router.push(callbackUrl); // Should have been caught by useEffect
     return <div className="flex justify-center items-center min-h-screen">Redirecting...</div>;
  }


  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-slate-800">Sign In</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form onSubmit={handleCredentialsSignIn} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {loading ? 'Signing in...' : 'Sign in with Email'}
            </button>
          </div>
        </form>

        {(providers?.google || Object.values(providers).some(p => p.type === 'oauth')) && (
            <div className="my-6">
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">Or continue with</span>
                </div>
            </div>
            </div>
        )}

        {Object.values(providers).map((provider) => {
          if (provider.type === "oauth") {
            return (
              <div key={provider.name} className="mt-4">
                <button
                  onClick={() => signIn(provider.id, { callbackUrl })}
                  disabled={loading}
                  className="w-full flex items-center justify-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:bg-slate-100"
                >
                  {provider.id === 'google' && (
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56,12.25C22.56,11.47,22.49,10.72,22.35,10H12V14.5H18.28C18.03,16.07,17.31,17.39,16.22,18.21V21H20.1C21.79,19.31,22.56,16.95,22.56,13.75C22.56,13.25,22.56,12.75,22.56,12.25Z" fill="#4285F4"/><path d="M12,24C15.24,24,17.95,22.92,20.1,21L16.22,18.21C15.09,19.04,13.67,19.5,12,19.5C8.89,19.5,6.23,17.39,5.21,14.79H1.23V17.79C3.12,21.53,7.22,24,12,24Z" fill="#34A853"/><path d="M5.21,14.79C5,14.27,4.89,13.65,4.89,12C4.89,10.35,5,9.73,5.21,9.21V6.21H1.23C0.45,7.85,0,9.85,0,12C0,14.15,0.45,16.15,1.23,17.79L5.21,14.79Z" fill="#FBBC05"/><path d="M12,4.5C13.84,4.5,15.37,5.21,16.57,6.35L20.23,2.66C18.06,0.97,15.33,0,12,0C7.22,0,3.12,2.47,1.23,6.21L5.21,9.21C6.23,6.61,8.89,4.5,12,4.5Z" fill="#EA4335"/></svg>
                  )}
                  Sign in with {provider.name}
                </button>
              </div>
            );
          }
          return null;
        })}
        <p className="mt-8 text-center text-sm text-slate-600">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="font-medium text-blue-600 hover:text-blue-500">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
