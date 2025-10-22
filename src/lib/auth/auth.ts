import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { multiSession } from "better-auth/plugins";
import { db } from "@/drizzle/db";
import {
  AdminRole,
  ac,
  OwnerRole,
  UserRole,
  ROLE_ADMIN,
  ROLE_OWNER,
  ROLE_USER,
} from "./permission";
import { admin } from "better-auth/plugins";
import { createAuthMiddleware } from "better-auth/api";
import { clearAdminStatusAction } from "@/server/actions";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-out") {
        await clearAdminStatusAction();
      }
    }),
  },
  plugins: [
    multiSession(),

    admin({
      ac,
      roles: {
        [ROLE_ADMIN]: AdminRole,
        [ROLE_OWNER]: OwnerRole,
        [ROLE_USER]: UserRole,
      },
      defaultRole: ROLE_USER,
      bannedUserMessage: "You are banned from the platform.",
    }),
  ],
  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: process.env.OAUTH_GOOGLE_CLIENT_ID,
      clientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET,
    },
  },
});
