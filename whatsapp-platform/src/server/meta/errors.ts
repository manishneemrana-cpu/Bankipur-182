/**
 * Normalized Meta/WhatsApp error codes, per the project rule that every Meta
 * call goes through a service with normalized error codes rather than raw
 * Graph API error shapes leaking into the rest of the app. Each is paired
 * with a support-friendly ID so a founder can search a support ticket
 * against a log line without needing to understand Graph API error codes.
 */
export type MetaErrorCode =
  | "META_AUTH_ERROR"
  | "TOKEN_EXPIRED"
  | "PERMISSION_DENIED"
  | "PHONE_ALREADY_REGISTERED"
  | "WABA_NOT_FOUND"
  | "TEMPLATE_REJECTED"
  | "RATE_LIMITED"
  | "WEBHOOK_ERROR"
  | "TIMEOUT"
  | "UNKNOWN";

export class MetaApiError extends Error {
  readonly code: MetaErrorCode;
  readonly supportId: string;
  readonly httpStatus?: number;
  readonly graphErrorCode?: number;
  readonly graphErrorSubcode?: number;

  constructor(
    code: MetaErrorCode,
    message: string,
    options?: { httpStatus?: number; graphErrorCode?: number; graphErrorSubcode?: number; cause?: unknown }
  ) {
    super(message, { cause: options?.cause });
    this.name = "MetaApiError";
    this.code = code;
    this.supportId = `META-${code}-${Date.now().toString(36)}`;
    this.httpStatus = options?.httpStatus;
    this.graphErrorCode = options?.graphErrorCode;
    this.graphErrorSubcode = options?.graphErrorSubcode;
  }
}

interface GraphErrorPayload {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_data?: { details?: string };
  };
}

/**
 * Maps a Graph API error response to a normalized MetaApiError. Graph API
 * error codes below are Meta's well-documented, long-stable numeric codes
 * (190 = invalid/expired token, 200-series = permission errors, 100 = bad
 * parameter used for "resource not found" style errors, 131xxx = WhatsApp
 * messaging-specific errors) — not a Phase-3 invention, but still verify
 * against https://developers.facebook.com/docs/graph-api/guides/error-handling
 * before relying on an exact subcode this document didn't confirm firsthand
 * (see docs/meta-current-state.md on this environment's network restriction).
 */
export function normalizeGraphError(httpStatus: number, payload: GraphErrorPayload | undefined): MetaApiError {
  const error = payload?.error;
  const message = error?.message ?? `Meta API request failed with status ${httpStatus}`;

  if (httpStatus === 401 || error?.code === 190) {
    return new MetaApiError("TOKEN_EXPIRED", message, {
      httpStatus,
      graphErrorCode: error?.code,
      graphErrorSubcode: error?.error_subcode,
    });
  }
  if (httpStatus === 403 || error?.code === 200 || error?.code === 10) {
    return new MetaApiError("PERMISSION_DENIED", message, {
      httpStatus,
      graphErrorCode: error?.code,
      graphErrorSubcode: error?.error_subcode,
    });
  }
  if (httpStatus === 429 || error?.code === 4 || error?.code === 80007 || error?.code === 131056) {
    return new MetaApiError("RATE_LIMITED", message, {
      httpStatus,
      graphErrorCode: error?.code,
      graphErrorSubcode: error?.error_subcode,
    });
  }
  if (error?.code === 132000 || error?.code === 132001 || error?.code === 132005) {
    return new MetaApiError("TEMPLATE_REJECTED", message, {
      httpStatus,
      graphErrorCode: error?.code,
      graphErrorSubcode: error?.error_subcode,
    });
  }
  if (httpStatus === 404 || error?.code === 100) {
    return new MetaApiError("WABA_NOT_FOUND", message, {
      httpStatus,
      graphErrorCode: error?.code,
      graphErrorSubcode: error?.error_subcode,
    });
  }
  if (httpStatus === 400 && /already registered|already exists/i.test(message)) {
    return new MetaApiError("PHONE_ALREADY_REGISTERED", message, { httpStatus, graphErrorCode: error?.code });
  }

  return new MetaApiError("UNKNOWN", message, {
    httpStatus,
    graphErrorCode: error?.code,
    graphErrorSubcode: error?.error_subcode,
  });
}
