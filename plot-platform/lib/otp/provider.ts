import "server-only";

/**
 * OTP verification adapter interface (§10 Phase build list: "OTP
 * verification toggle for forms to cut junk leads"). No SMS/OTP provider
 * (e.g. an SMS gateway) is configured in this environment, so this stays
 * an interface with no implementation rather than a fake "OTP sent"
 * message — lead forms accept submissions unverified, same as every
 * earlier phase. Wiring a real provider here, plus a per-project
 * `otp_required` toggle, is the natural next step once credentials exist.
 */
export interface OtpProvider {
  sendCode(phone: string): Promise<{ ok: true } | { ok: false; error: string }>;
  verifyCode(
    phone: string,
    code: string,
  ): Promise<{ ok: true } | { ok: false; error: string }>;
}

export function getOtpProvider(): OtpProvider | null {
  return null;
}
