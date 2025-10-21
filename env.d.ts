// Env variables type definitions

namespace NodeJS {
  interface ProcessEnv {
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    NEON_DATABASE_URL: string;
    OAUTH_GOOGLE_CLIENT_SECRET: string;
    OAUTH_GOOGLE_CLIENT_ID: string;
    ABLY_API_KEY: string;
    NEXT_PUBLIC_ABLY_KEY: string;
  }
}
