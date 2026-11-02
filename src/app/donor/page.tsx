import { DiscoveryScreen } from "@/components/DiscoveryScreen";
import { requireUser } from "@/app/_lib/guard";

export const metadata = { title: "Support a business | Kasi Kapital" };

export default async function DonorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(["donor"]);
  return <DiscoveryScreen role="donor" name={user.fullName} params={await searchParams} />;
}
