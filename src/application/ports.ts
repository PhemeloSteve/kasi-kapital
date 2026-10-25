// Ports: what the application needs from the outside world. Infrastructure implements them.
import type { Result } from "@/domain/result";
import type { SignupRole, UserRole } from "@/domain/roles";
import type { VerificationStatus } from "@/domain/types";

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
  createCheckout(input: {
    contributionId: string;
    amountCents: number;
  }): Promise<{ checkoutUrl: string; reference: string }>;
  releaseMilestone(input: {
    contributionId: string;
    amountCents: number;
  }): Promise<{ released: boolean }>;
}

export interface ContributionStore {
  getContributor(userId: string): Promise<{ kycStatus: VerificationStatus } | null>;
  getGoal(goalId: string): Promise<{ isOpen: boolean; businessVerified: boolean } | null>;
  saveContribution(input: {
    goalId: string;
    contributorId: string;
    amountCents: number;
    kind: "donation" | "presale";
  }): Promise<{ id: string }>;
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
