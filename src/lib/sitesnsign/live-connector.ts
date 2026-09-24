import "server-only";

import { SitesNSignNotConfiguredError, SitesNSignWriteDisabledError, type SitesNSignConnector } from "./connector";
import type {
  ExternalAnalyticsSnapshot,
  ExternalBroker,
  ExternalBuilder,
  ExternalFollowup,
  ExternalLead,
  ExternalProperty,
  ExternalSiteVisit,
} from "./types";

/**
 * Real implementation against the SitesNSign Public API
 * (https://api.sitesnsign.com/api/docs, OpenAPI 3.0, PublicApi group).
 *
 * Confirmed from the live Swagger doc:
 *   - base URL: SITESNSIGN_API_URL (e.g. https://api.sitesnsign.com/api)
 *   - auth: header `x-api-key: <SITESNSIGN_API_KEY>`
 *   - GET /v1/ping -> 200, no params (the only endpoint actually verified)
 *
 * Every other path below is INFERRED from the DTO names visible in the
 * spec's Schemas list (CreateListingDto, CreateLeadDto, UpdateBrokerProfileDto,
 * CreateProjectDto/CreateUnitDto/CreatePlotDto, CreateSiteVisitDto) and NestJS's
 * standard REST convention (resource DTO "Foo" -> controller tag "Foo" ->
 * route "/v1/foos"). They are marked INFERRED in the comments and will very
 * likely need a path correction once tested against the real API - that is
 * expected and fine, this is not scraping or guessing blindly: every path
 * traces to a real DTO name from the real spec, and every failure surfaces
 * the real HTTP status/body rather than silently returning fake data.
 */

type FetchInit = { method?: string; body?: unknown };

export class LiveSitesNSignConnector implements SitesNSignConnector {
  readonly name = "live";

  private baseUrl = process.env.SITESNSIGN_API_URL;
  private apiKey = process.env.SITESNSIGN_API_KEY;

  private async request<T>(path: string, init: FetchInit = {}): Promise<T> {
    const { baseUrl, apiKey } = this;
    if (!baseUrl || !apiKey) {
      throw new SitesNSignNotConfiguredError();
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `SitesNSign API ${init.method ?? "GET"} ${path} failed: ${response.status} ${response.statusText}${body ? ` - ${body.slice(0, 500)}` : ""}`,
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  /** The one endpoint verified directly against the live Swagger doc. */
  async ping(): Promise<{ ok: true }> {
    await this.request("/v1/ping");
    return { ok: true };
  }

  // --- INFERRED from CreateListingDto / "Listing" naming -------------------
  async getProperties(): Promise<ExternalProperty[]> {
    return this.request<ExternalProperty[]>("/v1/listings");
  }

  async getProperty(id: string): Promise<ExternalProperty | null> {
    try {
      return await this.request<ExternalProperty>(`/v1/listings/${id}`);
    } catch (err) {
      if (err instanceof Error && err.message.includes(" 404 ")) return null;
      throw err;
    }
  }

  // --- INFERRED from CreateLeadDto / UpdateLeadDto --------------------------
  async getLeads(): Promise<ExternalLead[]> {
    return this.request<ExternalLead[]>("/v1/leads");
  }

  async getLead(id: string): Promise<ExternalLead | null> {
    try {
      return await this.request<ExternalLead>(`/v1/leads/${id}`);
    } catch (err) {
      if (err instanceof Error && err.message.includes(" 404 ")) return null;
      throw err;
    }
  }

  // --- INFERRED from UpdateBrokerProfileDto ---------------------------------
  async getBrokers(): Promise<ExternalBroker[]> {
    return this.request<ExternalBroker[]>("/v1/broker-profiles");
  }

  // --- INFERRED from CreateProjectDto (builder projects) --------------------
  async getBuilders(): Promise<ExternalBuilder[]> {
    return this.request<ExternalBuilder[]>("/v1/projects");
  }

  // --- NOT INFERRABLE - no matching DTO seen in the spec's schema list ------
  async getFollowups(): Promise<ExternalFollowup[]> {
    throw new Error(
      "getFollowups: no confirmed SitesNSign endpoint for follow-ups yet - no matching DTO/tag seen in the Swagger schema list. Needs verification against the real docs before this can be implemented.",
    );
  }

  // --- INFERRED from CreateSiteVisitDto -------------------------------------
  async getSiteVisits(): Promise<ExternalSiteVisit[]> {
    return this.request<ExternalSiteVisit[]>("/v1/site-visits");
  }

  // --- NOT INFERRABLE - no matching Analytics DTO/tag seen -----------------
  async getAnalytics(): Promise<ExternalAnalyticsSnapshot> {
    throw new Error(
      "getAnalytics: no confirmed SitesNSign endpoint for analytics yet - no matching DTO/tag seen in the Swagger schema list. Needs verification against the real docs before this can be implemented.",
    );
  }

  async updateProperty(): Promise<never> {
    throw new SitesNSignWriteDisabledError("updateProperty");
  }

  async updateLeadStatus(): Promise<never> {
    throw new SitesNSignWriteDisabledError("updateLeadStatus");
  }
}
