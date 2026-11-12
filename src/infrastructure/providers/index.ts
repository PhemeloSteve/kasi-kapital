import type { PaymentGateway } from "@/application/ports";
import { isMockPaymentAllowed, isServiceKeyConfigured, parsePaymentEnv } from "@/config/env";
import { mockPayments } from "./mock";

export function isMockPayments(): boolean {
  return parsePaymentEnv().PAYMENT_PROVIDER === "mock";
}

/**
 * True when payments are switched off on purpose: the demo provider is selected but this is a production
 * server that has not opted in with ALLOW_MOCK_PAYMENTS=true. Callers show "payments are off" instead of
 * running anything.
 */
export function paymentsBlocked(): boolean {
  return isMockPayments() && !isMockPaymentAllowed();
}

/**
 * The payment provider for this deployment. Only the demo (mock) provider exists today; a real one
 * (for example a licensed escrow or payments partner) plugs in here without touching business rules.
 * The demo provider refuses to run in production unless ALLOW_MOCK_PAYMENTS=true.
 */
export function getPaymentGateway(): PaymentGateway {
  const mode = parsePaymentEnv().PAYMENT_PROVIDER;
  if (mode === "mock") {
    if (!isMockPaymentAllowed()) {
      throw new Error(
        "The demo payment provider is disabled in production. Set ALLOW_MOCK_PAYMENTS=true only on a demo site.",
      );
    }
    return mockPayments;
  }
  throw new Error(`PAYMENT_PROVIDER "${mode}" is not implemented yet. Use "mock" for the demo.`);
}

/** The demo checkout needs the server to be able to confirm payments, which needs the service key. */
export function paymentsReady(): boolean {
  return isMockPayments() && isMockPaymentAllowed() && isServiceKeyConfigured();
}
