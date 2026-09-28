/**
 * EMI calculator (§9.10). Always "indicative" — never a bank quote. Standard
 * reducing-balance formula: EMI = P·r·(1+r)^n / ((1+r)^n - 1).
 */
export interface EmiInput {
  principal: number;
  annualRatePercent: number;
  tenureYears: number;
}

export interface EmiResult {
  monthlyEmi: number;
  totalPayment: number;
  totalInterest: number;
}

export function calculateEmi({
  principal,
  annualRatePercent,
  tenureYears,
}: EmiInput): EmiResult {
  const months = tenureYears * 12;
  if (principal <= 0 || months <= 0) {
    return { monthlyEmi: 0, totalPayment: 0, totalInterest: 0 };
  }
  const monthlyRate = annualRatePercent / 12 / 100;
  const monthlyEmi =
    monthlyRate === 0
      ? principal / months
      : (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
        (Math.pow(1 + monthlyRate, months) - 1);
  const totalPayment = monthlyEmi * months;
  return {
    monthlyEmi,
    totalPayment,
    totalInterest: totalPayment - principal,
  };
}

/** Sum of plot price + configurable charges as percentages of price (§9.10). */
export function totalCostEstimate(
  priceTotal: number,
  charges: {
    plcTotal?: number;
    developmentPercent?: number;
    registrationPercent?: number;
  },
): number {
  const dev = priceTotal * ((charges.developmentPercent ?? 0) / 100);
  const reg = priceTotal * ((charges.registrationPercent ?? 0) / 100);
  return priceTotal + (charges.plcTotal ?? 0) + dev + reg;
}
