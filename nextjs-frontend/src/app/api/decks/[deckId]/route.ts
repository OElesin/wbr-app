import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client'; // Import Prisma for types

interface RouteParams {
  params: {
    deckId: string;
  };
}

// GET /api/decks/[deckId] - Fetch a single deck by ID
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  const { deckId } = params;

  if (!session || !session.user?.id) {
    return NextResponse.json({ message: 'Unauthorized: User ID not found in session.' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Atomically check for existence and ownership
    const deck = await prisma.wBRDeck.findFirst({
      where: {
        id: deckId,
        ownerId: userId,
      },
    });

    if (!deck) {
      // Deck doesn't exist or user doesn't own it.
      // For security, it's often better to return 404 in both cases to avoid revealing existence.
      return NextResponse.json({ message: 'Deck not found or access denied.' }, { status: 404 });
    }
    return NextResponse.json(deck, { status: 200 });
  } catch (error) {
    console.error(`Failed to fetch deck ${deckId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ message: 'Error fetching deck', error: errorMessage }, { status: 500 });
  }
}

// PUT /api/decks/[deckId] - Update an existing deck
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  const { deckId } = params;

  if (!session || !session.user?.id) {
    return NextResponse.json({ message: 'Unauthorized: User ID not found in session.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, metrics } = body;
    const userId = session.user.id;

    if (!title || typeof title !== 'string' || title.trim() === '') {
        return NextResponse.json({ message: 'Title is required and must be a non-empty string.' }, { status: 400 });
    }
    if (!metrics || !Array.isArray(metrics)) {
        return NextResponse.json({ message: 'Metrics are required and must be an array.' }, { status: 400 });
    }

    // Atomically update if user is owner
    const updatedDeck = await prisma.wBRDeck.updateMany({
      where: {
        id: deckId,
        ownerId: userId,
      },
      data: {
        title: title.trim(),
        metrics: metrics as Prisma.JsonArray,
        updatedAt: new Date(),
      },
    });

    if (updatedDeck.count === 0) {
      // This means either the deck didn't exist or the user wasn't the owner.
      return NextResponse.json({ message: 'Deck not found or you do not have permission to update it.' }, { status: 404 });
    }

    // Fetch the updated deck to return it (updateMany doesn't return the record)
    const resultDeck = await prisma.wBRDeck.findUnique({ where: { id: deckId }});
    return NextResponse.json(resultDeck, { status: 200 });

  } catch (error) {
    console.error(`Failed to update deck ${deckId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ message: `Database error: ${error.message}`, code: error.code }, { status: 409 });
    }
    return NextResponse.json({ message: 'Error updating deck', error: errorMessage }, { status: 500 });
  }
}

// DELETE /api/decks/[deckId] - Delete a deck
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  const { deckId } = params;

  if (!session || !session.user?.id) {
    return NextResponse.json({ message: 'Unauthorized: User ID not found in session.' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Atomically delete if user is owner
    const deleteResult = await prisma.wBRDeck.deleteMany({
      where: {
        id: deckId,
        ownerId: userId,
      },
    });

    if (deleteResult.count === 0) {
      // This means either the deck didn't exist or the user wasn't the owner.
      return NextResponse.json({ message: 'Deck not found or you do not have permission to delete it.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Deck deleted successfully' }, { status: 200 }); // Or 204 No Content
  } catch (error) {
    console.error(`Failed to delete deck ${deckId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
       if (error.code === 'P2025') { // Record to delete not found by where clause
         return NextResponse.json({ message: 'Deck not found or you do not have permission to delete it.' }, { status: 404 });
      }
      return NextResponse.json({ message: `Database error: ${error.message}`, code: error.code }, { status: 409 });
    }
    return NextResponse.json({ message: 'Error deleting deck', error: errorMessage }, { status: 500 });
  }
}
