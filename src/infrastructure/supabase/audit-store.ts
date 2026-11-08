import { z } from "zod";
import { AUDIT_PAGE_SIZE } from "@/domain/audit";
import type { AuditEntry, AuditStore } from "@/application/ports";
import { createClient } from "./server";

const row = z.object({
  id: z.coerce.string(),
  created_at: z.string(),
  action: z.string(),
  entity: z.string(),
  entity_id: z.string().nullable(),
  details: z.record(z.string(), z.unknown()).nullable(),
  profiles: z.object({ full_name: z.string().nullable() }).nullable(),
});

/** Supabase implementation of the AuditStore port. The database only lets super administrators read the log. */
export function createAuditStore(): AuditStore {
  return {
    async list({ action, entity, page }) {
      const supabase = await createClient();
      const from = (page - 1) * AUDIT_PAGE_SIZE;

      let query = supabase
        .from("audit_log")
        .select("id, created_at, action, entity, entity_id, details, profiles(full_name)");
      if (action) query = query.eq("action", action);
      if (entity) query = query.eq("entity", entity);

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        // one extra row tells us whether there is a next page
        .range(from, from + AUDIT_PAGE_SIZE);
      if (error) console.error("[audit] list failed", { code: error.code });

      const items = (data ?? []).flatMap((raw): AuditEntry[] => {
        const r = row.safeParse(raw);
        if (!r.success) return [];
        return [
          {
            id: r.data.id,
            createdAt: r.data.created_at,
            action: r.data.action,
            entity: r.data.entity,
            entityId: r.data.entity_id ?? "",
            actorName: r.data.profiles?.full_name ?? null,
            details: r.data.details ?? {},
          },
        ];
      });
      return { items: items.slice(0, AUDIT_PAGE_SIZE), hasMore: items.length > AUDIT_PAGE_SIZE };
    },
  };
}
