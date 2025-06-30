import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { email: inviteeEmail, teamId } = await request.json();
    const inviterId = session.user.id;

    if (!inviteeEmail || !teamId) {
      return NextResponse.json({ message: 'Email and Team ID are required.' }, { status: 400 });
    }

    // 1. Verify the inviter is an owner/admin of the team (or has permission to invite)
    const teamMembership = await prisma.teamMembership.findUnique({
      where: {
        userId_teamId: { // This assumes your @@unique constraint is named this way or similar
          userId: inviterId,
          teamId: teamId,
        },
      },
      include: {
        team: true, // To get team name for the invitation record
      }
    });

    // For MVP, let's assume 'owner' role is required to invite. This can be expanded.
    if (!teamMembership || teamMembership.role !== 'owner') {
      return NextResponse.json({ message: 'Forbidden: You do not have permission to invite members to this team.' }, { status: 403 });
    }

    // 2. Check if the invitee is already a member of the team
    const existingMembership = await prisma.teamMembership.findFirst({
        where: {
            teamId: teamId,
            user: { email: inviteeEmail } // Check by user's email
        }
    });
    if (existingMembership) {
        return NextResponse.json({ message: 'User is already a member of this team.' }, { status: 409 });
    }

    // 3. Check if an active invitation already exists for this email to this team
    //    (This step would require an Invitation model - skipping for pure stub, but important for real app)
    //    Example:
    //    const existingInvitation = await prisma.teamInvitation.findFirst({
    //        where: { email: inviteeEmail, teamId: teamId, status: 'pending' }
    //    });
    //    if (existingInvitation) {
    //        return NextResponse.json({ message: 'An invitation for this email to this team is already pending.' }, { status: 409 });
    //    }


    // 4. (Stub Implementation) Log the invitation.
    // In a real app: Create an `TeamInvitation` record in the database.
    // This record would store the invitee's email, teamId, inviterId, a unique token, status ('pending'), and expiry.
    // Then, send an email to `inviteeEmail` with a link containing the token.

    console.log(`STUB: User ${inviterId} invited ${inviteeEmail} to team ${teamId} (${teamMembership.team.name}).`);
    // Example of creating a dummy invitation object to return if we had an Invitation model
    const dummyInvitation = {
        id: `dummy_inv_${Date.now()}`,
        email: inviteeEmail,
        teamId: teamId,
        teamName: teamMembership.team.name, // Got from included team data
        status: 'pending',
        // inviterId: inviterId,
        // createdAt: new Date().toISOString(),
    };

    // For now, just return a success message.
    // When an Invitation model is added, this would return the created invitation.
    return NextResponse.json({
        message: 'Invitation logged (stub). In a real app, an email would be sent and an invitation record created.',
        invitation: dummyInvitation // Return a representation of the (stubbed) invitation
    }, { status: 201 });

  } catch (error) {
    console.error('Failed to process invitation:', error);
    return NextResponse.json({ message: 'Error processing invitation.', error: (error as Error).message }, { status: 500 });
  }
}
