import type { KycProvider, OpenBankingProvider, PaymentGateway } from "@/application/ports";

// MOCK implementations. No real identity checks or money movement happen here.
export const mockKyc: KycProvider = {
  async verifyIdentity({ userId }) {
    return { status: "verified", reference: `mock-kyc-${userId}` };
  },
};

export const mockOpenBanking: OpenBankingProvider = {
  async verifyAccountOwnership({ userId }) {
    return { verified: true, reference: `mock-ob-${userId}` };
  },
};

export const mockPayments: PaymentGateway = {
  async createCheckout({ contributionId }) {
    return {
      checkoutUrl: `/mock-checkout/${contributionId}`,
      reference: `mock-pay-${contributionId}`,
    };
  },
  async releaseMilestone() {
    return { released: true };
  },
};
