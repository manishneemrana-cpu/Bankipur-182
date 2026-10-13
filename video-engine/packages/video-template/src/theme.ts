import { staticFile } from "remotion";

export const FONT_HEADING = `"Playfair Display", "Noto Sans Devanagari", Georgia, serif`;
export const FONT_BODY = `"Inter", "Noto Sans Devanagari", "Helvetica Neue", Arial, sans-serif`;

/** @font-face rules for the bundled fonts (all SIL OFL). Injected once by the composition. */
export const fontCss = () => `
@font-face{font-family:"Playfair Display";src:url(${staticFile("fonts/PlayfairDisplay.ttf")});font-weight:400 900;}
@font-face{font-family:"Inter";src:url(${staticFile("fonts/Inter.ttf")});font-weight:100 900;}
@font-face{font-family:"Noto Sans Devanagari";src:url(${staticFile("fonts/NotoSansDevanagari.ttf")});font-weight:100 900;}
`;

export const CTA_TEXT = {
  en: "Book a site visit",
  hi: "साइट विज़िट बुक करें",
  hinglish: "Site visit book karein",
} as const;
export const CALL_LABEL = { en: "Call", hi: "कॉल करें", hinglish: "Call karein" } as const;

/** Mix a hex color with black (amt<0) or white (amt>0). */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `rgb(${r},${g},${b})`;
}
