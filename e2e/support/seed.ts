import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { e2eEnv } from "./env";
import { stepAt, totpCode } from "./totp";

export const PASSWORD = "E2e-Passw0rd-Strong!";
const AUTH_DIR = path.join(__dirname, "..", ".auth");
const SEED_FILE = path.join(AUTH_DIR, "seed.json");
const STEP_FILE = path.join(AUTH_DIR, "admin-totp-step.txt");

export type Seed = {
  runId: string;
  admin: { id: string; email: string; totpSecret: string };
  founder: { id: string; email: string };
  supporter: { id: string; email: string };
  business: { id: string; name: string };
  goal: { title: string; milestone1: string; milestone2: string };
};

export function serviceClient(): SupabaseClient {
  const env = e2eEnv();
  return createClient(env.supabaseUrl, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function anonClient(): SupabaseClient {
  const env = e2eEnv();
  return createClient(env.supabaseUrl, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** A client signed in as one of the seeded people, the way their browser would be (no admin keys). */
export async function clientFor(email: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Could not sign in ${email}: ${error.message}`);
  return client;
}

async function createUser(
  admin: SupabaseClient,
  input: { email: string; fullName: string; role: "investor" | "business" },
): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role: input.role, full_name: input.fullName, popia_consent: true },
  });
  if (error || !data.user) throw new Error(`createUser ${input.email}: ${error?.message}`);
  return data.user.id;
}

function must<T>(
  result: { data: T; error: { message: string } | null },
  what: string,
): NonNullable<T> {
  if (result.error || result.data === null || result.data === undefined) {
    throw new Error(`${what}: ${result.error?.message ?? "no data returned"}`);
  }
  return result.data;
}

async function ensureBuckets(admin: SupabaseClient) {
  for (const name of ["business-documents", "identity-documents"]) {
    const { error } = await admin.storage.createBucket(name, { public: false });
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(`createBucket ${name}: ${error.message}`);
    }
  }
}

/** Gives the administrator a verified authenticator, the way they would in the app. */
async function enrolAdminAuthenticator(email: string): Promise<string> {
  const client = await clientFor(email);
  const enrol = must(
    await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "e2e" }),
    "mfa enrol",
  );
  const secret = enrol.totp.secret;
  const challenge = must(await client.auth.mfa.challenge({ factorId: enrol.id }), "mfa challenge");
  const now = Date.now();
  const verified = await client.auth.mfa.verify({
    factorId: enrol.id,
    challengeId: challenge.id,
    code: totpCode(secret, now),
  });
  if (verified.error) throw new Error(`mfa verify: ${verified.error.message}`);
  writeFileSync(STEP_FILE, String(stepAt(now)));
  return secret;
}

/** Creates fresh people and a business for this run. Names carry a run id, so reruns never collide. */
export async function seedRun(): Promise<Seed> {
  const admin = serviceClient();
  const runId = Date.now().toString(36);
  mkdirSync(AUTH_DIR, { recursive: true });
  await ensureBuckets(admin);

  const adminEmail = `e2e-admin-${runId}@example.test`;
  const founderEmail = `e2e-founder-${runId}@example.test`;
  const supporterEmail = `e2e-supporter-${runId}@example.test`;

  const adminId = await createUser(admin, {
    email: adminEmail,
    fullName: "E2E Admin",
    role: "investor",
  });
  const founderId = await createUser(admin, {
    email: founderEmail,
    fullName: "E2E Founder",
    role: "business",
  });
  const supporterId = await createUser(admin, {
    email: supporterEmail,
    fullName: "E2E Supporter",
    role: "investor",
  });

  // No signed-in user here (service key), so the database lets these protected columns change.
  must(
    await admin
      .from("profiles")
      .update({ role: "admin", admin_level: "super_admin" })
      .eq("id", adminId)
      .select("id")
      .single(),
    "promote admin",
  );
  must(
    await admin
      .from("profiles")
      .update({ kyc_status: "verified" })
      .eq("id", supporterId)
      .select("id")
      .single(),
    "verify supporter identity",
  );

  const businessName = `E2E Bakery ${runId}`;
  const business = must(
    await admin
      .from("businesses")
      .insert({
        owner_id: founderId,
        name: businessName,
        category: "bakery",
        description: "Fresh bread for the neighbourhood.",
        suburb: "Soweto",
      })
      .select("id")
      .single(),
    "create business",
  );

  const totpSecret = await enrolAdminAuthenticator(adminEmail);

  const seed: Seed = {
    runId,
    admin: { id: adminId, email: adminEmail, totpSecret },
    founder: { id: founderId, email: founderEmail },
    supporter: { id: supporterId, email: supporterEmail },
    business: { id: business.id as string, name: businessName },
    goal: {
      title: `New oven ${runId}`,
      milestone1: `Buy the oven ${runId}`,
      milestone2: `Buy flour ${runId}`,
    },
  };
  writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2));
  return seed;
}

export function loadSeed(): Seed {
  return JSON.parse(readFileSync(SEED_FILE, "utf8")) as Seed;
}

/** The last 30-second window an administrator code was used in (a code is only good once). */
export function lastAdminStep(): number {
  try {
    return Number(readFileSync(STEP_FILE, "utf8"));
  } catch {
    return 0;
  }
}

export function recordAdminStep(step: number): void {
  writeFileSync(STEP_FILE, String(step));
}
