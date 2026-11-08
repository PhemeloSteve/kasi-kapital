"use server";

import { redirect } from "next/navigation";
import { suspendBusiness, unsuspendBusiness } from "@/application/moderation";
import { requireSuperAdmin } from "@/app/_lib/guard";
import { createBusinessModeration } from "@/infrastructure/supabase/admin-store";

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

export async function suspendBusinessAction(formData: FormData): Promise<void> {
  // The database checks the admin level too; this stops everyone else before anything runs.
  await requireSuperAdmin();

  const result = await suspendBusiness(
    { moderation: createBusinessModeration() },
    { businessId: text(formData, "businessId"), reason: text(formData, "reason") },
  );
  redirect(
    result.ok ? "/admin/businesses?notice=suspended" : `/admin/businesses?error=${result.error}`,
  );
}

export async function unsuspendBusinessAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const result = await unsuspendBusiness(
    { moderation: createBusinessModeration() },
    { businessId: text(formData, "businessId") },
  );
  redirect(
    result.ok ? "/admin/businesses?notice=unsuspended" : `/admin/businesses?error=${result.error}`,
  );
}
