import "server-only";
import { getMetaConfig } from "./config";
import { isMockModeEnabled } from "@/server/mock/meta";
import { MetaApiError, normalizeGraphError } from "./errors";

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

export interface SendMessageResult {
  metaMessageId: string;
  /** Present only in mock mode, so callers/tests can tell mock data from a real Meta response. */
  mock?: true;
}

export interface SendTextMessageInput {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  body: string;
  idempotencyKey: string;
}

export interface SendTemplateMessageInput {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  templateName: string;
  languageCode: string;
  components?: unknown[];
  idempotencyKey: string;
}

export interface SendMediaMessageInput {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  mediaType: "image" | "document" | "video" | "audio";
  mediaId: string;
  caption?: string;
  idempotencyKey: string;
}

function mockMessageId(idempotencyKey: string): SendMessageResult {
  return { metaMessageId: `mock.${idempotencyKey}`, mock: true };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new MetaApiError("TIMEOUT", `Meta API request timed out after ${timeoutMs}ms`, { cause: err });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POSTs to the Graph API with timeout + retry-with-backoff on rate limits and
 * transient 5xx errors, and normalized errors on failure. The
 * `/{phone_number_id}/messages` endpoint shape used here (messaging_product,
 * to, type, and a type-named object) has been stable since the Cloud API's
 * 2022 launch and is consistent across every current source checked in
 * docs/meta-current-state.md — unlike the Graph API version number or
 * pricing, this is not something Phase 3 is guessing at.
 */
async function postToGraph(
  path: string,
  accessToken: string,
  body: unknown,
  idempotencyKey: string
): Promise<{ id: string }> {
  const config = getMetaConfig();
  const url = `${config.baseUrl}/${path}`;

  let lastError: MetaApiError | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = (await response.json()) as { messages?: Array<{ id: string }> };
        const id = data.messages?.[0]?.id;
        if (!id) {
          throw new MetaApiError("UNKNOWN", "Meta API response did not include a message id");
        }
        return { id };
      }

      const payload = await response.json().catch(() => undefined);
      const error = normalizeGraphError(response.status, payload);
      lastError = error;

      if (error.code !== "RATE_LIMITED" || attempt === MAX_RETRIES) {
        throw error;
      }
    } catch (err) {
      if (err instanceof MetaApiError) {
        lastError = err;
        if (err.code !== "RATE_LIMITED" && err.code !== "TIMEOUT") throw err;
        if (attempt === MAX_RETRIES) throw err;
      } else {
        throw err;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, BASE_BACKOFF_MS * 2 ** attempt));
  }
  // Unreachable in practice — the loop always returns or throws — but keeps TypeScript satisfied.
  throw lastError ?? new MetaApiError("UNKNOWN", "Meta API request failed for an unknown reason");
}

export async function sendTextMessage(input: SendTextMessageInput): Promise<SendMessageResult> {
  if (isMockModeEnabled()) return mockMessageId(input.idempotencyKey);
  const { id } = await postToGraph(
    `${input.phoneNumberId}/messages`,
    input.accessToken,
    { messaging_product: "whatsapp", to: input.to, type: "text", text: { body: input.body } },
    input.idempotencyKey
  );
  return { metaMessageId: id };
}

export async function sendTemplateMessage(input: SendTemplateMessageInput): Promise<SendMessageResult> {
  if (isMockModeEnabled()) return mockMessageId(input.idempotencyKey);
  const { id } = await postToGraph(
    `${input.phoneNumberId}/messages`,
    input.accessToken,
    {
      messaging_product: "whatsapp",
      to: input.to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        components: input.components ?? [],
      },
    },
    input.idempotencyKey
  );
  return { metaMessageId: id };
}

export async function sendMediaMessage(input: SendMediaMessageInput): Promise<SendMessageResult> {
  if (isMockModeEnabled()) return mockMessageId(input.idempotencyKey);
  const { id } = await postToGraph(
    `${input.phoneNumberId}/messages`,
    input.accessToken,
    {
      messaging_product: "whatsapp",
      to: input.to,
      type: input.mediaType,
      [input.mediaType]: { id: input.mediaId, ...(input.caption ? { caption: input.caption } : {}) },
    },
    input.idempotencyKey
  );
  return { metaMessageId: id };
}
