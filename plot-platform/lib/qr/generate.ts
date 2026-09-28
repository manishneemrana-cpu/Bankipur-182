import "server-only";

import QRCode from "qrcode";

/** SVG markup for a QR code encoding `url` (§13: per-project and per-plot QR). */
export async function qrCodeSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", margin: 1, width: 320 });
}
