import type { ILLMProvider } from "@/lib/llm";
import type { ProductInput } from "@/types/project";

/** Agent 1 — Brand Strategist: understands the brand and product before any creative work starts. */
export class BrandStrategistAgent {
  constructor(private llm: ILLMProvider) {}

  public async analyze(input: ProductInput): Promise<Record<string, unknown>> {
    const prompt = `Analyze this brand and product for an advertising campaign.
Brand: ${input.brandName}
Product: ${input.productName}
Description: ${input.description}
Industry: ${input.industry}
Key Benefits: ${input.keyBenefits.join(", ")}
Price/Offer: ${input.priceOffer ?? "not provided"}

Summarize brand identity signals only from the information given. Do not invent certifications, awards, statistics, or claims not present in the input (never fabricate product specifications or medical/financial claims).
Return JSON: { "brandName": string, "productName": string, "positioning": string, "differentiators": string[], "toneSignals": string[] }`;

    return this.llm.generateJSON<Record<string, unknown>>({ prompt, temperature: 0.4 });
  }
}
