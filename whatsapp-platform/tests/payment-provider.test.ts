import { describe, expect, it } from "vitest";
import { MockPaymentProvider, NotConfiguredPaymentProvider } from "@/server/payments/provider";

describe("payment provider", () => {
  it("mock provider simulates a created order deterministically without calling Razorpay", async () => {
    const provider = new MockPaymentProvider();
    const order = await provider.createOrder({
      organizationId: "org-1",
      amount: 999,
      currency: "INR",
      receipt: "invoice-1",
    });
    expect(order.status).toBe("CREATED");
    expect(order.amount).toBe(999);
    expect(await provider.verifyPaymentSignature({ orderId: order.orderId, paymentId: "p1", signature: "s1" })).toBe(
      true
    );
  });

  it("not-configured provider throws rather than fabricating a payment result", async () => {
    const provider = new NotConfiguredPaymentProvider();
    await expect(
      provider.createOrder({ organizationId: "org-1", amount: 999, currency: "INR", receipt: "invoice-1" })
    ).rejects.toThrow(/no payment provider is configured/i);
    await expect(
      provider.verifyPaymentSignature({ orderId: "o1", paymentId: "p1", signature: "s1" })
    ).rejects.toThrow(/no payment provider is configured/i);
  });
});
