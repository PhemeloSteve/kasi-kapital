import { seedRun } from "./support/seed";

export default async function globalSetup() {
  const seed = await seedRun();
  console.log(`[e2e] seeded run ${seed.runId}: ${seed.business.name}`);
}
