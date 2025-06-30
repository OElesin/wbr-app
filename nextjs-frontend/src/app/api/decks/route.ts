import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client'; // Import Prisma for types

// GET /api/decks - Fetch all decks for the authenticated user
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  // session.user.id should now be available due to PrismaAdapter and session callback
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: 'Unauthorized. Session or user ID missing.' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const decks = await prisma.wBRDeck.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(decks, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch decks:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ message: 'Error fetching decks', error: errorMessage }, { status: 500 });
  }
}

// POST /api/decks - Create a new deck
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: 'Unauthorized. Session or user ID missing.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, metrics } = body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json({ message: 'Title is required and must be a non-empty string.' }, { status: 400 });
    }
    if (!metrics || !Array.isArray(metrics)) { // Could add more detailed validation for metrics structure
      return NextResponse.json({ message: 'Metrics are required and must be an array.' }, { status: 400 });
    }
    // Add more specific validation for metrics content if necessary

    const userId = session.user.id;

    const newDeck = await prisma.wBRDeck.create({
      data: {
        title: title.trim(),
        metrics: metrics as Prisma.JsonArray, // Ensure metrics conform to expected JSON structure
        ownerId: userId,
        // teamId can be added later if applicable
      },
    });

    return NextResponse.json(newDeck, { status: 201 });
  } catch (error) {
    console.error("Failed to create deck:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Example: Handle known Prisma errors (e.g., unique constraint violation P2002)
      return NextResponse.json({ message: `Database error: ${error.message}`, code: error.code }, { status: 409 });
    }
    return NextResponse.json({ message: 'Error creating deck', error: errorMessage }, { status: 500 });
  }
}
