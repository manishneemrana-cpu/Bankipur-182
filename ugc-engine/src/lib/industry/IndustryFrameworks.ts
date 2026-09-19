import type { IndustryFramework } from "@/types/industry";

/**
 * Extensible industry registry (spec section 17/49): the core pipeline never
 * hard-codes a specific vertical. Add a new industry by registering one
 * object here (or via the industry_templates DB table for a per-org
 * override) — no changes to agents, prompt engine, or the worker required.
 */
const REGISTRY = new Map<string, IndustryFramework>();

function register(f: IndustryFramework) {
  REGISTRY.set(f.key, f);
}

register({
  key: "ecommerce",
  industry: "E-commerce / Consumer Products",
  hookFrameworks: ["Problem-Solution", "Unboxing", "Before/After", "Direct Response"],
  preferredCreativeFrameworks: ["Problem-Solution", "Testimonial", "Unboxing", "Direct Response"],
  pacingMultiplier: 1.1,
  requiredDisclaimers: [],
  visualEmphasis: "Product-in-hand shots, clear packaging reveal, lifestyle context",
  defaultCTA: "Shop Now",
  defaultTone: "Friendly, direct, benefit-led",
});

register({
  key: "real_estate",
  industry: "Real Estate",
  hookFrameworks: ["Price Reveal", "Property Walkthrough", "Location Secret"],
  preferredCreativeFrameworks: ["Lifestyle", "Direct Response", "Comparison"],
  pacingMultiplier: 0.85,
  requiredDisclaimers: ["Subject to availability and contract terms"],
  visualEmphasis: "High architectural lighting, spacious interior reveals, amenity highlights",
  defaultCTA: "Book Private Tour",
  defaultTone: "Aspirational, confident, informative",
});

register({
  key: "saas",
  industry: "SaaS / Software",
  hookFrameworks: ["Workflow Frustration", "Time-Saved Calculation", "Feature Demo"],
  preferredCreativeFrameworks: ["Problem-Solution", "Expert Explanation", "Comparison"],
  pacingMultiplier: 1.2,
  requiredDisclaimers: ["UI simulated for demonstration purposes"],
  visualEmphasis: "Screen recordings, clean modern desks, productivity reactions",
  defaultCTA: "Start Free Trial",
  defaultTone: "Confident, efficient, no-nonsense",
});

register({
  key: "beauty",
  industry: "Beauty & Skincare",
  hookFrameworks: ["Texture Zoom", "Routine Integration", "Before/After Experience"],
  preferredCreativeFrameworks: ["Before-After", "Day-in-the-Life", "Review"],
  pacingMultiplier: 1.0,
  requiredDisclaimers: ["Individual results may vary"],
  visualEmphasis: "Close-up macro skin texture, clear application shots, natural bathroom daylight",
  defaultCTA: "Get Yours Today",
  defaultTone: "Warm, personal, glow-focused",
});

register({
  key: "fashion",
  industry: "Fashion & Apparel",
  hookFrameworks: ["Try-On Reveal", "Fit Confidence", "Styling Hack"],
  preferredCreativeFrameworks: ["Lifestyle", "Day-in-the-Life", "Review"],
  pacingMultiplier: 1.15,
  requiredDisclaimers: ["Fit may vary by body type"],
  visualEmphasis: "Try-on movement, fabric texture, styling versatility",
  defaultCTA: "Shop the Look",
  defaultTone: "Confident, trend-aware, expressive",
});

register({
  key: "food_beverage",
  industry: "Food & Beverage",
  hookFrameworks: ["ASMR Taste Reaction", "Preparation Reveal", "Unboxing Crunch"],
  preferredCreativeFrameworks: ["Unboxing", "Day-in-the-Life", "Review"],
  pacingMultiplier: 1.3,
  requiredDisclaimers: [],
  visualEmphasis: "Sizzling sound effects, close-ups of ingredients, genuine first-bite reaction",
  defaultCTA: "Order Now",
  defaultTone: "Energetic, sensory, craveable",
});

register({
  key: "healthcare",
  industry: "Healthcare & Wellness",
  hookFrameworks: ["Symptom Recognition", "Expert Reassurance", "Routine Improvement"],
  preferredCreativeFrameworks: ["Expert Explanation", "Educational", "Testimonial"],
  pacingMultiplier: 0.9,
  requiredDisclaimers: [
    "Not a substitute for professional medical advice",
    "Consult a healthcare provider before use",
  ],
  visualEmphasis: "Calm, clinical-clean environments, credible expert framing",
  defaultCTA: "Learn More",
  defaultTone: "Reassuring, credible, careful",
});

register({
  key: "education",
  industry: "Education",
  hookFrameworks: ["Knowledge Gap", "Insight Reveal", "Outcome Proof"],
  preferredCreativeFrameworks: ["Educational", "Expert Explanation", "Testimonial"],
  pacingMultiplier: 0.95,
  requiredDisclaimers: [],
  visualEmphasis: "Teaching moments, whiteboard/screen inserts, student outcome shots",
  defaultCTA: "Enroll Today",
  defaultTone: "Encouraging, clear, credible",
});

register({
  key: "finance",
  industry: "Finance",
  hookFrameworks: ["Cost Comparison", "Risk Reduction", "Simplicity Promise"],
  preferredCreativeFrameworks: ["Comparison", "Expert Explanation", "FAQ"],
  pacingMultiplier: 0.9,
  requiredDisclaimers: [
    "Terms and conditions apply",
    "Not financial advice — consult a licensed advisor",
  ],
  visualEmphasis: "Clean graphics-friendly framing, trustworthy neutral settings",
  defaultCTA: "Check Eligibility",
  defaultTone: "Trustworthy, precise, calm",
});

register({
  key: "hospitality",
  industry: "Hospitality & Travel",
  hookFrameworks: ["Destination Reveal", "Experience Preview", "Deal Urgency"],
  preferredCreativeFrameworks: ["Lifestyle", "Day-in-the-Life", "Direct Response"],
  pacingMultiplier: 0.9,
  requiredDisclaimers: ["Availability and pricing subject to change"],
  visualEmphasis: "Wide establishing shots, sensory detail, guest-eye-view moments",
  defaultCTA: "Book Your Stay",
  defaultTone: "Inviting, immersive, relaxed",
});

register({
  key: "automotive",
  industry: "Automotive",
  hookFrameworks: ["Feature Reveal", "Test Drive Moment", "Comparison Callout"],
  preferredCreativeFrameworks: ["Comparison", "Lifestyle", "Direct Response"],
  pacingMultiplier: 1.05,
  requiredDisclaimers: ["Features and pricing may vary by trim/region"],
  visualEmphasis: "Exterior lines, interior tech close-ups, driving/lifestyle context",
  defaultCTA: "Book a Test Drive",
  defaultTone: "Confident, dynamic, aspirational",
});

register({
  key: "professional_services",
  industry: "Professional Services",
  hookFrameworks: ["Problem-Solution", "Expert Authority", "Client Outcome"],
  preferredCreativeFrameworks: ["Expert Explanation", "Testimonial", "FAQ"],
  pacingMultiplier: 0.9,
  requiredDisclaimers: ["Results not guaranteed; individual cases vary"],
  visualEmphasis: "Credible office/consultation framing, calm confident delivery",
  defaultCTA: "Book a Consultation",
  defaultTone: "Professional, calm, trustworthy",
});

register({
  key: "local_business",
  industry: "Local Businesses",
  hookFrameworks: ["Neighborhood Familiarity", "Direct Benefit", "Social Proof"],
  preferredCreativeFrameworks: ["Testimonial", "Day-in-the-Life", "Direct Response"],
  pacingMultiplier: 1.05,
  requiredDisclaimers: [],
  visualEmphasis: "Real storefront/location shots, community feel",
  defaultCTA: "Visit Us Today",
  defaultTone: "Warm, familiar, community-oriented",
});

register({
  key: "startup",
  industry: "Startups",
  hookFrameworks: ["Founder Story", "Category Creation", "Bold Claim"],
  preferredCreativeFrameworks: ["Founder Story", "Problem-Solution", "Direct Response"],
  pacingMultiplier: 1.15,
  requiredDisclaimers: [],
  visualEmphasis: "Founder-led delivery, behind-the-scenes authenticity",
  defaultCTA: "Try It Free",
  defaultTone: "Bold, scrappy, mission-driven",
});

register({
  key: "personal_brand",
  industry: "Personal Brands / Creators",
  hookFrameworks: ["Story Hook", "Contrarian", "Question"],
  preferredCreativeFrameworks: ["Emotional Story", "Founder Story", "Lifestyle"],
  pacingMultiplier: 1.1,
  requiredDisclaimers: [],
  visualEmphasis: "Direct-to-camera intimacy, personality-forward framing",
  defaultCTA: "Follow Along",
  defaultTone: "Personal, authentic, opinionated",
});

register({
  key: "general",
  industry: "General / Unclassified",
  hookFrameworks: ["Problem-Solution", "Curiosity", "Direct Benefit"],
  preferredCreativeFrameworks: ["Problem-Solution", "Testimonial", "Direct Response"],
  pacingMultiplier: 1.0,
  requiredDisclaimers: [],
  visualEmphasis: "Authentic UGC handheld look, natural environment",
  defaultCTA: "Learn More",
  defaultTone: "Conversational, energetic, authentic",
});

export function getIndustryFramework(key: string): IndustryFramework {
  return REGISTRY.get(key) ?? (REGISTRY.get("general") as IndustryFramework);
}

export function listIndustryFrameworks(): IndustryFramework[] {
  return Array.from(REGISTRY.values());
}

export function registerIndustryFramework(framework: IndustryFramework): void {
  REGISTRY.set(framework.key, framework);
}
