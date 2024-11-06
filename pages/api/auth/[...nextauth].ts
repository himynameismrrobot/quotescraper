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
      console.log("🔵 Session callback:", { session, user });
      if (session.user) {
        session.user.id = user.id;
        session.user.username = user.username as string | null;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      console.log("🟢 SignIn callback started:", { user, account, profile });
      try {
        if (account?.provider === "google") {
          let dbUser = await prisma.user.findUnique({
            where: { email: user.email! },
            include: { accounts: true },
          });

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

          // Create session and log it
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
            token: session.sessionToken.substring(0, 10) + '...' // Log partial token for security
          });

          if (!dbUser.username) {
            console.log("🟠 User needs onboarding");
            return `/onboarding?email=${encodeURIComponent(user.email!)}`;
          }
          
          console.log("🟤 User exists and has completed onboarding");
          return true;
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

      if (session?.user && !session.user.username) {
        console.log("🟠 Redirecting to onboarding");
        return `${baseUrl}/onboarding`;
      }

      return url.startsWith(baseUrl) ? url : baseUrl;
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