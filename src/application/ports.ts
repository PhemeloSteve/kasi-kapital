// Ports: what the application needs from the outside world. Infrastructure implements them.
import type { Result } from "@/domain/result";
import type { SignupRole, UserRole } from "@/domain/roles";
import type { BusinessCategory } from "@/domain/business-categories";
import type { DocumentStatus, TrustTier } from "@/domain/documents";
import type { MilestoneStatus, VerificationStatus } from "@/domain/types";

export type KycResult = { status: "verified" | "pending" | "rejected"; reference: string };

export interface KycProvider {
  verifyIdentity(input: {
    userId: string;
    idDocumentPath: string;
    selfiePath: string;
  }): Promise<KycResult>;
}

export interface OpenBankingProvider {
  verifyAccountOwnership(input: {
    userId: string;
    accountHolder: string;
  }): Promise<{ verified: boolean; reference: string }>;
}

export interface PaymentGateway {
  /** Starts a payment for a contribution. Returns where to send the supporter to pay. */
  createCheckout(input: {
    contributionId: string;
    amountCents: number;
  }): Promise<{ checkoutUrl: string; reference: string }>;
  /** Pays a released milestone to the founder. `payoutId` doubles as an idempotency key, so a retry never pays twice. */
  payOut(input: {
    payoutId: string;
    amountCents: number;
  }): Promise<Result<{ reference: string }, "failed">>;
}

export type CurrentUser = {
  userId: string;
  role: UserRole;
  fullName: string | null;
  consented: boolean;
};

export interface AuthGateway {
  signUp(input: {
    email: string;
    password: string;
    fullName: string;
    role: SignupRole;
  }): Promise<
    Result<{ hasSession: boolean }, "failed" | "rate_limited" | "weak_password" | "invalid_email">
  >;
  signIn(input: {
    email: string;
    password: string;
  }): Promise<Result<CurrentUser, "invalid_credentials" | "unavailable">>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<CurrentUser | null>;
  acceptConsent(userId: string): Promise<Result<true, "failed">>;
}

export type BusinessData = {
  name: string;
  category: BusinessCategory;
  description: string | null;
  suburb: string;
  /** Already rounded to roughly 1 km before it gets here. */
  location: { lat: number; lng: number } | null;
  youtubeUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
};

export type BusinessRecord = Omit<BusinessData, "location"> & {
  id: string;
  hasLocation: boolean;
  verification: VerificationStatus;
  trustTier: TrustTier;
};

export type GoalData = {
  title: string;
  description: string | null;
  targetCents: number;
  kind: "donation" | "presale";
  milestones: { title: string; amountCents: number }[];
};

export type GoalRecord = {
  id: string;
  title: string;
  description: string | null;
  targetCents: number;
  kind: "donation" | "presale";
  isOpen: boolean;
  milestones: {
    id: string;
    title: string;
    amountCents: number;
    status: MilestoneStatus;
    reviewNote: string | null;
  }[];
};

export interface BusinessStore {
  getMyBusiness(userId: string): Promise<BusinessRecord | null>;
  saveMyBusiness(data: BusinessData): Promise<Result<{ id: string }, "failed">>;
  createGoal(businessId: string, data: GoalData): Promise<Result<{ id: string }, "failed">>;
  listGoals(businessId: string): Promise<GoalRecord[]>;
}

export type DocumentRecord = {
  id: string;
  type: string;
  status: DocumentStatus;
  reviewNote: string | null;
  createdAt: string;
};

export type ReviewQueueItem = {
  documentId: string;
  type: string;
  uploadedAt: string;
  business: {
    id: string;
    name: string;
    category: string;
    suburb: string | null;
    verification: VerificationStatus;
    trustTier: TrustTier;
    ownerName: string | null;
  };
};

export type ReviewOutcome = { businessStatus: VerificationStatus; trustTier: TrustTier };

export interface DocumentStore {
  listMyDocuments(businessId: string): Promise<DocumentRecord[]>;
  upload(input: {
    bucket: string;
    path: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<Result<true, "failed">>;
  createRecord(input: {
    id: string;
    businessId: string;
    type: string;
    path: string;
  }): Promise<Result<true, "limit_reached" | "failed">>;
  removeFile(bucket: string, path: string): Promise<void>;
  /** Only returns documents the signed-in user is allowed to see. */
  getDocument(
    documentId: string,
  ): Promise<{ id: string; type: string; path: string; status: DocumentStatus } | null>;
  deleteRecord(documentId: string): Promise<Result<true, "failed">>;
  submitForReview(
    businessId: string,
  ): Promise<Result<true, "missing_documents" | "not_allowed" | "failed">>;
  listReviewQueue(): Promise<ReviewQueueItem[]>;
  reviewDocument(input: {
    documentId: string;
    approve: boolean;
    note: string | null;
  }): Promise<
    Result<ReviewOutcome, "already_reviewed" | "note_required" | "not_submitted" | "failed">
  >;
  createViewUrl(documentId: string): Promise<Result<{ url: string }, "not_found">>;
}

/** The only business fields supporters ever see. No owner, registration number or documents. */
export type PublicBusiness = {
  id: string;
  name: string;
  category: BusinessCategory;
  description: string | null;
  suburb: string | null;
  trustTier: TrustTier;
  lat: number | null;
  lng: number | null;
  youtubeUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  openGoalCount: number;
  openGoalTargetCents: number;
  distanceKm: number | null;
};

export type DiscoveryFilters = {
  query: string | null;
  category: BusinessCategory | null;
  near: { lat: number; lng: number; radiusKm: number } | null;
  page: number;
};

export interface DiscoveryStore {
  search(filters: DiscoveryFilters): Promise<{ items: PublicBusiness[]; hasMore: boolean }>;
  getBusiness(id: string): Promise<PublicBusiness | null>;
}

// ---------- Funding ----------
export type ContributionStatus = "pending" | "held" | "failed" | "refunded" | "released";

export type ContributionRecord = {
  id: string;
  amountCents: number;
  status: ContributionStatus;
  createdAt: string;
  goalTitle: string | null;
  businessId: string | null;
  businessName: string | null;
};

export type StartContributionError =
  | { code: "not_allowed" | "goal_not_found" | "goal_closed" | "amount_out_of_range" | "failed" }
  | { code: "goal_full" | "limit_reached"; remainingCents: number };

/** What a supporter does, always as themselves. */
export interface ContributionStore {
  start(input: {
    goalId: string;
    amountCents: number;
  }): Promise<Result<{ id: string }, StartContributionError>>;
  getMine(contributionId: string): Promise<ContributionRecord | null>;
  listMine(): Promise<ContributionRecord[]>;
}

export type GoalFunding = {
  goalId: string;
  raisedCents: number;
  paidOutCents: number;
  supporterCount: number;
};
export type MilestonePayout = {
  milestoneId: string;
  amountCents: number;
  status: "pending" | "paid" | "failed";
};

/** Safe totals anyone allowed to see a business may read. */
export interface FundingReads {
  goalFunding(businessId: string): Promise<GoalFunding[]>;
  milestonePayouts(businessId: string): Promise<MilestonePayout[]>;
}

export type PendingPayout = { id: string; amountCents: number };

/**
 * Things only the server may do, because they stand in for the payment provider: confirming a payment,
 * recording a payout, setting identity status. Backed by the service role; never reachable from a browser.
 */
export interface PaymentServer {
  confirmContribution(input: {
    contributionId: string;
    reference: string;
  }): Promise<Result<"held" | "expired" | "not_pending", "not_found" | "failed">>;
  listPendingPayouts(): Promise<PendingPayout[]>;
  markPayoutPaid(payoutId: string, reference: string): Promise<boolean>;
  noteFailure(payoutId: string, reason: string): Promise<void>;
  setKycStatus(userId: string, status: "verified" | "rejected"): Promise<Result<true, "failed">>;
}

export type ProofQueueItem = {
  milestoneId: string;
  milestoneTitle: string;
  amountCents: number;
  proofDocumentId: string | null;
  goalTitle: string | null;
  businessName: string | null;
};

export type PendingPayoutDetail = {
  id: string;
  amountCents: number;
  failureReason: string | null;
  milestoneTitle: string | null;
  businessName: string | null;
};

export interface MilestoneStore {
  submitProof(input: {
    milestoneId: string;
    documentId: string;
  }): Promise<Result<true, "not_allowed" | "invalid_proof" | "failed">>;
  listProofQueue(): Promise<ProofQueueItem[]>;
  review(input: {
    milestoneId: string;
    approve: boolean;
    note: string | null;
  }): Promise<Result<{ payoutCreated: boolean }, "note_required" | "not_waiting" | "failed">>;
  listPendingPayouts(): Promise<PendingPayoutDetail[]>;
}
