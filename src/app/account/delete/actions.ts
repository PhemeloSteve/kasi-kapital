"use server";

import { redirect } from "next/navigation";
import { deleteAccount } from "@/application/account";
import { requireUser } from "@/app/_lib/guard";
import { createAccountEraser } from "@/infrastructure/supabase/account-eraser";

export async function deleteAccountAction(formData: FormData): Promise<void> {
  const user = await requireUser(["business", "investor", "donor"]);
  const confirmation = formData.get("confirmation");

  const result = await deleteAccount(
    { eraser: createAccountEraser() },
    {
      userId: user.userId,
      role: user.role,
      confirmation: typeof confirmation === "string" ? confirmation : "",
    },
  );
  redirect(result.ok ? "/" : `/account/delete?error=${result.error}`);
}
