'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, FormEvent } from 'react';

interface Team {
  id: string;
  name: string;
  memberCount: number; // Example property
  isOwner?: boolean; // Example property
}

interface Invitation {
  id: string;
  email: string;
  teamName: string;
  status: 'pending' | 'accepted';
}

export default function TeamsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [teams, setTeams] = useState<Team[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedTeamForInvite, setSelectedTeamForInvite] = useState<string>(''); // To select which team to invite to
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/teams');
    }
  }, [authStatus, router]);

  // Fetch user's teams and invitations (dummy data for now)
  useEffect(() => {
    if (authStatus === 'authenticated') {
      setIsLoading(true);
      // Simulate API calls
      Promise.all([
        // fetch('/api/teams'), // API to get teams user is part of
        // fetch('/api/teams/invitations') // API to get pending invitations for user or by user
      ]).then(async ([/*teamsRes, invitationsRes*/]) => {
        // const teamsData = await teamsRes.json();
        // const invitationsData = await invitationsRes.json();
        // setTeams(teamsData.teams || []);
        // setInvitations(invitationsData.invitations || []);

        // Dummy data:
        setTeams([
          { id: 'team1', name: 'My Product Team', memberCount: 3, isOwner: true },
          { id: 'team2', name: 'Sales Squad', memberCount: 5 },
        ]);
        setInvitations([
          { id: 'inv1', email: 'pending@example.com', teamName: 'My Product Team', status: 'pending' },
        ]);

      }).catch(err => {
        console.error("Failed to load team data:", err);
        setError("Could not load team information.");
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, [authStatus]);

  const handleInviteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !selectedTeamForInvite) {
      setError("Please enter an email and select a team to invite to.");
      return;
    }
    setError(null);
    console.log(`Inviting ${inviteEmail} to team ID ${selectedTeamForInvite}`);

    // TODO: Actual API call to /api/teams/invite
    // try {
    //   const response = await fetch('/api/teams/invite', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ email: inviteEmail, teamId: selectedTeamForInvite })
    //   });
    //   if (!response.ok) throw new Error(await response.text());
    //   const newInvitation = await response.json();
    //   setInvitations(prev => [...prev, newInvitation]);
    //   setInviteEmail('');
    //   alert('Invitation sent!');
    // } catch (err) {
    //   setError((err as Error).message || "Failed to send invitation.");
    // }
    alert(`(Stub) Invitation sent to ${inviteEmail} for team ID ${selectedTeamForInvite}. Backend not implemented.`);
    setInvitations(prev => [...prev, {id: Date.now().toString(), email: inviteEmail, teamName: teams.find(t=>t.id === selectedTeamForInvite)?.name || 'Unknown Team', status: 'pending'}]);
    setInviteEmail('');
  };

  if (authStatus === 'loading' || isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading team data...</div>;
  }

  if (!session) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen">
        <p className="mb-4">Please sign in to manage your teams.</p>
        <Link href="/auth/signin" className="text-blue-500 hover:underline">Sign In</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Team Management</h1>

      {error && <p className="text-red-500 bg-red-100 p-3 rounded mb-4">{error}</p>}

      {/* Section to Create a New Team - Placeholder */}
      <div className="mb-8 p-6 bg-white rounded-lg shadow">
        <h2 className="text-2xl font-semibold text-slate-700 mb-4">Create New Team</h2>
        <p className="text-slate-600 mb-3">(Team creation functionality will be implemented later.)</p>
        <button disabled className="btn-primary opacity-50 cursor-not-allowed">Create Team</button>
      </div>

      {/* Section to Invite Users */}
      {teams.filter(team => team.isOwner).length > 0 && (
        <div className="mb-8 p-6 bg-white rounded-lg shadow">
            <h2 className="text-2xl font-semibold text-slate-700 mb-4">Invite User to Team</h2>
            <form onSubmit={handleInviteSubmit} className="space-y-4">
            <div>
                <label htmlFor="teamSelect" className="block text-sm font-medium text-slate-700">Select Team:</label>
                <select
                    id="teamSelect"
                    value={selectedTeamForInvite}
                    onChange={(e) => setSelectedTeamForInvite(e.target.value)}
                    className="mt-1" // Tailwind will style this from globals.css
                    required
                >
                <option value="" disabled>-- Select a team --</option>
                {teams.filter(team => team.isOwner).map(team => ( // Only allow inviting to teams owned by user
                    <option key={team.id} value={team.id}>{team.name}</option>
                ))}
                </select>
            </div>
            <div>
                <label htmlFor="inviteEmail" className="block text-sm font-medium text-slate-700">Email to Invite:</label>
                <input
                type="email"
                id="inviteEmail"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                required
                className="mt-1" // Tailwind will style this from globals.css
                />
            </div>
            <button type="submit" className="btn-primary">
                Send Invitation (Stub)
            </button>
            </form>
        </div>
      )}

      {/* Display User's Teams */}
      <div className="mb-8 p-6 bg-white rounded-lg shadow">
        <h2 className="text-2xl font-semibold text-slate-700 mb-4">Your Teams</h2>
        {teams.length > 0 ? (
          <ul className="space-y-3">
            {teams.map(team => (
              <li key={team.id} className="p-3 border rounded-md">
                <span className="font-semibold">{team.name}</span> ({team.memberCount} members)
                {team.isOwner && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-2">Owner</span>}
                {/* Placeholder for 'Manage Team' link */}
                <Link href={`/teams/${team.id}/manage`} className="text-sm text-blue-500 hover:underline ml-4">(Manage - Not Implemented)</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-600">You are not part of any teams yet, or no teams found.</p>
        )}
      </div>

      {/* Display Pending Invitations */}
      <div className="p-6 bg-white rounded-lg shadow">
        <h2 className="text-2xl font-semibold text-slate-700 mb-4">Pending Invitations</h2>
        {invitations.filter(inv => inv.status === 'pending').length > 0 ? (
          <ul className="space-y-3">
            {invitations.filter(inv => inv.status === 'pending').map(inv => (
              <li key={inv.id} className="p-3 border rounded-md flex justify-between items-center">
                <span>Invitation to join <strong>{inv.teamName}</strong> for {inv.email}</span>
                {/* Placeholder for Accept/Decline buttons */}
                <div className="space-x-2">
                    <button className="btn-secondary text-xs opacity-50 cursor-not-allowed" disabled>Accept (NI)</button>
                    <button className="btn-danger text-xs opacity-50 cursor-not-allowed" disabled>Decline (NI)</button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-600">No pending invitations.</p>
        )}
      </div>

    </div>
  );
}
