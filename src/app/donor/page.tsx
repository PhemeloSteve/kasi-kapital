import { DiscoveryScreen } from "@/components/DiscoveryScreen";
import { requireUser } from "@/app/_lib/guard";

export const metadata = { title: "Support a business | Kasi Kapital" };

export default async function DonorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(["donor"]);
  return (
    <DiscoveryScreen
      title="Support a local business"
      roleLabel="Donor account"
      name={user.fullName}
      intro="Find a verified local business whose goal matters to you. Donations ask for nothing in return."
      params={await searchParams}
    />
  );
}
