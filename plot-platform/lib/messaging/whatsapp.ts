/**
 * WhatsApp click-to-chat share text, built entirely from DB values (§13).
 * Never invents a fact that isn't in the payload.
 */
export function plotShareText(params: {
  plotNumber: string;
  projectName: string;
  areaValue: number | null;
  areaUnit: string | null;
  facing: string;
  roadWidthFt: number | null;
  deepLink: string;
}): string {
  const {
    plotNumber,
    projectName,
    areaValue,
    areaUnit,
    facing,
    roadWidthFt,
    deepLink,
  } = params;
  const parts = [`Hi, I'm interested in Plot ${plotNumber} at ${projectName}.`];
  const facts: string[] = [];
  if (areaValue) facts.push(`Area: ${areaValue} ${areaUnit}`);
  if (facing && facing !== "UNKNOWN") facts.push(`Facing: ${facing}`);
  if (roadWidthFt) facts.push(`Road: ${roadWidthFt} ft`);
  if (facts.length) parts.push(facts.join(" | "));
  parts.push(`View: ${deepLink}`);
  return parts.join(" ");
}

export function whatsAppUrl(phone: string | undefined, text: string): string {
  const digits = phone ? phone.replace(/\D/g, "") : "";
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}
