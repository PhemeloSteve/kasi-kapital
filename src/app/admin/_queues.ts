import { cache } from "react";
import { createDocumentStore } from "@/infrastructure/supabase/document-store";
import { createMilestoneStore } from "@/infrastructure/supabase/milestone-store";

// React's cache() shares one result per request, so the page and its title (generateMetadata) read
// each queue once between them instead of twice. Both run as the signed-in person, so a visitor who
// is not a fully signed-in administrator simply gets empty lists back from the database.
export const getReviewQueue = cache(() => createDocumentStore().listReviewQueue());
export const getProofQueue = cache(() => createMilestoneStore().listProofQueue());
