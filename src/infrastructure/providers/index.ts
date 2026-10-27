import type { PaymentGateway } from "@/application/ports";
import { isServiceKeyConfigured, parsePaymentEnv } from "@/config/env";
import { mockPayments } from "./mock";

export function isMockPayments(): boolean {
  return parsePaymentEnv().PAYMENT_PROVIDER === "mock";
}

/**
 * The payment provider for this deployment. Only the demo (mock) provider exists today; a real one
 * (for example a licensed escrow or payments partner) plugs in here without touching business rules.
 */
export function getPaymentGateway(): PaymentGateway {
  const mode = parsePaymentEnv().PAYMENT_PROVIDER;
  if (mode === "mock") return mockPayments;
  throw new Error(`PAYMENT_PROVIDER "${mode}" is not implemented yet. Use "mock" for the demo.`);
}

/** The demo checkout needs the server to be able to confirm payments, which needs the service key. */
export function paymentsReady(): boolean {
  return isMockPayments() && isServiceKeyConfigured();
}
