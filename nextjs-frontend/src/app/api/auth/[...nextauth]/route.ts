import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "@/lib/prisma";
import bcrypt from 'bcryptjs'; // Corrected import

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "jsmith@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, _req) { // Changed req to _req
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user) {
          console.log("No user found with email:", credentials.email);
          throw new Error("No user found with this email.");
        }

        // Ensure user.password exists. It might not if they signed up with OAuth.
        if (!user.password) { // Assuming 'password' field on User model for hashed password
            console.log("User signed up with OAuth, no password set for credentials login.");
            throw new Error("This account was created using a social login. Try signing in with Google.");
        }

        const isValidPassword = await bcrypt.compare(credentials.password, user.password);

        if (!isValidPassword) {
          console.log("Invalid password for user:", credentials.email);
          throw new Error("Incorrect password.");
        }

        console.log("User authorized:", user.email);
        // Return user object that will be encoded in the JWT/session
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          // Do NOT return the password hash
        };
      }
    })
  ],
  pages: {
    signIn: '/auth/signin',
    // signOut: '/auth/signout',
    // error: '/auth/error', // Error code passed in query string as ?error=
    // verifyRequest: '/auth/verify-request',
    // newUser: '/auth/new-user'
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
         session.user.id = user.id;
      }
      return session;
    }
  },
  // Enable debug messages in development
  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
