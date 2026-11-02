import { DiscoveryScreen } from "@/components/DiscoveryScreen";
import { requireUser } from "@/app/_lib/guard";

export const metadata = { title: "Discover businesses | Kasi Kapital" };

export default async function InvestorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(["investor"]);
  return <DiscoveryScreen role="investor" name={user.fullName} params={await searchParams} />;
}
