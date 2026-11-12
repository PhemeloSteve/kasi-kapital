/**
 * The same variable names the app itself uses, so one set serves both the app and the tests.
 * `npm run e2e` fills them from the local Supabase stack.
 */
export type E2eEnv = {
  supabaseUrl: string;
  anonKey: string;
  serviceKey: string;
  baseUrl: string;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Start the local stack with "npx supabase start" and run the tests with ` +
        `"npm run e2e" (it reads the keys from "supabase status").`,
    );
  }
  return value;
}

export function e2eEnv(): E2eEnv {
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");

  // These tests create users and write data with the service key. Never let them near a real project.
  const host = new URL(supabaseUrl).hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host === "host.docker.internal";
  if (!local && process.env.E2E_ALLOW_REMOTE !== "1") {
    throw new Error(
      `Refusing to run end-to-end tests against ${host}. They create test accounts and data, so use ` +
        `the local Supabase stack (npx supabase start).`,
    );
  }

  return {
    supabaseUrl,
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    baseUrl: process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? 3000}`,
  };
}
