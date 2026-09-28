/** Formats a rupee amount Indian-style: ₹12,50,000 (§22). */
export function formatIndianCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}
