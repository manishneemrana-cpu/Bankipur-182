import "server-only";
import { getEnv } from "@/server/env";

/**
 * Provider-agnostic payment interface. Razorpay is the brief's named
 * provider, but nothing in `billing.ts` or the UI depends on its SDK
 * directly — only on this interface — so a real implementation can be
 * dropped in later without touching call sites. Mirrors the AI/calling
 * provider pattern (src/server/ai/provider.ts, src/server/calling/provider.ts).
 */
export interface CreateOrderInput {
  organizationId: string;
  amount: number;
  currency: string;
  receipt: string;
}

export interface PaymentOrder {
  orderId: string;
  amount: number;
  currency: string;
  status: "CREATED" | "PAID" | "FAILED";
}

export interface PaymentProvider {
  createOrder(input: CreateOrderInput): Promise<PaymentOrder>;
  verifyPaymentSignature(input: { orderId: string; paymentId: string; signature: string }): Promise<boolean>;
}

/**
 * Default provider until Razorpay is actually configured. Every method
 * throws rather than fabricating a successful payment — a fake "PAID"
 * order would be far worse than a clear "not configured" error, especially
 * for anything touching money.
 */
export class NotConfiguredPaymentProvider implements PaymentProvider {
  async createOrder(_input: CreateOrderInput): Promise<PaymentOrder> {
    throw new Error("No payment provider is configured yet (Phase 9 defines the interface only)");
  }
  async verifyPaymentSignature(_input: { orderId: string; paymentId: string; signature: string }): Promise<boolean> {
    throw new Error("No payment provider is configured yet (Phase 9 defines the interface only)");
  }
}

/**
 * Mock provider for MOCK_PAYMENTS=true: simulates a successful order/payment
 * flow deterministically, without ever calling Razorpay. Used so the billing
 * UI and invoice flow can be exercised end-to-end in dev/CI, same as
 * MOCK_META for the Meta client.
 */
export class MockPaymentProvider implements PaymentProvider {
  async createOrder(input: CreateOrderInput): Promise<PaymentOrder> {
    return {
      orderId: `mock_order_${input.receipt}`,
      amount: input.amount,
      currency: input.currency,
      status: "CREATED",
    };
  }
  async verifyPaymentSignature(_input: { orderId: string; paymentId: string; signature: string }): Promise<boolean> {
    return true;
  }
}

let activeProvider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (activeProvider) return activeProvider;
  activeProvider = getEnv().MOCK_PAYMENTS ? new MockPaymentProvider() : new NotConfiguredPaymentProvider();
  return activeProvider;
}

/** Test-only: reset the cached provider after mutating env/mocks. */
export function resetPaymentProviderForTests(): void {
  activeProvider = null;
}
