// Swappable provider interfaces. Mock implementations are used for the hackathon demo;
// replace with live (or sandbox) providers without touching the rest of the app.

export type KycResult = { status: "verified" | "pending" | "rejected"; reference: string };

export interface KycProvider {
  verifyIdentity(input: { userId: string; idDocumentPath: string; selfiePath: string }): Promise<KycResult>;
}

export interface OpenBankingProvider {
  verifyAccountOwnership(input: { userId: string; accountHolder: string }): Promise<{ verified: boolean; reference: string }>;
}

export interface PaymentProvider {
  createCheckout(input: { contributionId: string; amountCents: number }): Promise<{ checkoutUrl: string; reference: string }>;
  releaseMilestone(input: { contributionId: string; amountCents: number }): Promise<{ released: boolean }>;
}
