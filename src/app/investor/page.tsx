import { DiscoveryScreen } from "@/components/DiscoveryScreen";
import { requireUser } from "@/app/_lib/guard";

export const metadata = { title: "Discover businesses | Kasi Kapital" };

export default async function InvestorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(["investor"]);
  return (
    <DiscoveryScreen
      title="Discover businesses"
      roleLabel="Investor account"
      name={user.fullName}
      intro="Every business here has had its identity and trading checked by our team. Search, filter, or look near you."
      params={await searchParams}
    />
  );
}
