import type { UploadError } from "@/application/documents";
import type { ProofError } from "@/application/milestones";

export const uploadMessages: Record<UploadError, string> = {
  invalid_type: "Choose which document you are uploading.",
  no_file: "Choose a file to upload.",
  empty: "That file is empty. Choose a different one.",
  too_large: "That file is too large. The limit is 4 MB. Try a PDF, or a smaller photo.",
  unsupported_type: "We can only accept PDF, JPG or PNG files.",
  no_business: "Create your business profile first.",
  suspended: "This business is suspended. Please contact support.",
  limit_reached: "You have reached the limit of 20 documents. Delete some you no longer need.",
  upload_failed: "We couldn't upload that file. Please try again.",
};

export const pageNotices: Record<string, string> = {
  uploaded: "Document uploaded. Only you and our verification team can open it.",
  deleted: "Document deleted.",
  submitted: "Submitted. Our team will review your documents and you will see the result here.",
};

export const pageErrors: Record<string, string> = {
  missing: "Please upload your ID document and a bank statement before submitting.",
  already_submitted: "Your business has already been submitted for review.",
  delete_failed: "We couldn't delete that document. Approved documents cannot be deleted.",
  failed: "Something went wrong. Please try again in a moment.",
};

export const proofMessages: Record<ProofError, string> = {
  ...uploadMessages,
  invalid_milestone: "That milestone could not be found.",
  not_allowed: "You can't add proof to that milestone right now.",
  invalid_proof: "Attach an invoice or quote from your business as proof.",
  failed: "We couldn't save that proof. Please try again.",
};
