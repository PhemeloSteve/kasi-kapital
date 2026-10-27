import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAuthGateway } from "@/infrastructure/supabase/auth-gateway";
import { createDocumentStore } from "@/infrastructure/supabase/document-store";

/**
 * Opens a private document. A fresh 60-second link is made on every click, and only for people the
 * database lets see that document (its owner and administrators). Nothing is ever cached or shared.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const noStore = { "Cache-Control": "no-store" };

  const user = await createAuthGateway().getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url), { headers: noStore });

  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) return new NextResponse("Not found", { status: 404, headers: noStore });

  const result = await createDocumentStore().createViewUrl(parsed.data);
  if (!result.ok) return new NextResponse("Not found", { status: 404, headers: noStore });

  return NextResponse.redirect(result.value.url, { status: 302, headers: noStore });
}
