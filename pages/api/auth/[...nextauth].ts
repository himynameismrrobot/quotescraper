import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import prisma from "@/lib/prisma";

const adapter = PrismaAdapter(prisma);

export const authOptions: NextAuthOptions = {
  adapter,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      console.log("🔵 Session callback - Before:", { 
        sessionUser: session.user, 
        dbUser: user,
        userId: user.id 
      });

      if (session.user) {
        session.user.id = user.id;
        session.user.username = user.username as string | null;
      }

      console.log("🔵 Session callback - After:", { 
        sessionUser: session.user,
        hasUserId: !!session.user?.id
      });

      return session;
    },
    async signIn({ user, account }) {
      console.log("🟢 SignIn callback started:", { user, account });
      try {
        if (account?.provider === "google") {
          let dbUser = await prisma.user.findUnique({
            where: { email: user.email! },
            include: { accounts: true },
          });

          console.log("🟡 Database user lookup result:", dbUser);

          if (!dbUser) {
            dbUser = await prisma.user.create({
              data: {
                email: user.email!,
                name: user.name,
                image: user.image,
                accounts: {
                  create: {
                    type: account.type,
                    provider: account.provider,
                    providerAccountId: account.providerAccountId,
                    access_token: account.access_token,
                    token_type: account.token_type,
                    scope: account.scope,
                  },
                },
              },
            });
            console.log("🟣 Created new user:", dbUser);
          }

          // Create session
          const session = await prisma.session.create({
            data: {
              sessionToken: account.access_token!,
              userId: dbUser.id,
              expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            },
          });
          console.log("🎫 Created new session:", {
            sessionId: session.id,
            userId: session.userId,
            expires: session.expires,
            token: session.sessionToken.substring(0, 10) + '...'
          });

          return true; // Always return true to allow sign in
        }
        return true;
      } catch (error) {
        console.error("🔴 Error in signIn callback:", error);
        return false;
      }
    },
    async redirect({ url, baseUrl }) {
      console.log("⚪ Redirect callback:", { url, baseUrl });
      
      // Check if user needs onboarding
      const session = await prisma.session.findFirst({
        where: {
          user: {
            username: null,
          },
        },
        include: {
          user: true,
        },
      });

      // If user needs onboarding, send them there
      if (session?.user && !session.user.username) {
        console.log("🟠 Redirecting to onboarding");
        return `${baseUrl}/onboarding`;
      }

      // If URL is signin or base URL, and user has completed onboarding, send to newsfeed
      if (url.includes('/auth/signin') || url === baseUrl || url === `${baseUrl}/`) {
        console.log("🟤 Redirecting to newsfeed");
        return `${baseUrl}/newsfeed`; // Changed from / to /newsfeed
      }

      // Otherwise, allow the URL if it's from our base URL
      if (url.startsWith(baseUrl)) {
        return url;
      }
      
      // Default to newsfeed
      return `${baseUrl}/newsfeed`; // Changed from / to /newsfeed
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};

export default NextAuth(authOptions);