import "server-only";

import type {
  ExternalAnalyticsSnapshot,
  ExternalBroker,
  ExternalBuilder,
  ExternalFollowup,
  ExternalLead,
  ExternalProperty,
  ExternalSiteVisit,
} from "./types";

export class SitesNSignWriteDisabledError extends Error {
  constructor(method: string) {
    super(
      `SitesNSignConnector.${method} is disabled. Write access to production SitesNSign requires explicit configuration and OWNER/ADMIN approval - see NON-NEGOTIABLE SAFETY RULES. Never enabled by default.`,
    );
  }
}

export class SitesNSignNotConfiguredError extends Error {
  constructor() {
    super(
      "No official SitesNSign API has been confirmed or documented yet. This connector stays interface-only - it will not scrape or access the production site through undocumented means.",
    );
  }
}

/**
 * Read-only-by-default connector to the SitesNSign production platform.
 * Write methods exist on the interface (per the master spec) but every
 * implementation throws SitesNSignWriteDisabledError until a real,
 * approved write path is explicitly configured - this file does not
 * gate that decision, it structurally cannot be bypassed by a caller.
 */
export interface SitesNSignConnector {
  readonly name: string;

  getProperties(): Promise<ExternalProperty[]>;
  getProperty(id: string): Promise<ExternalProperty | null>;
  getLeads(): Promise<ExternalLead[]>;
  getLead(id: string): Promise<ExternalLead | null>;
  getBrokers(): Promise<ExternalBroker[]>;
  getBuilders(): Promise<ExternalBuilder[]>;
  getFollowups(): Promise<ExternalFollowup[]>;
  getSiteVisits(): Promise<ExternalSiteVisit[]>;
  getAnalytics(): Promise<ExternalAnalyticsSnapshot>;

  // Write methods - always disabled. Present on the interface only so a
  // future, explicitly-approved implementation has a contract to satisfy.
  updateProperty(id: string, patch: Partial<ExternalProperty>): Promise<never>;
  updateLeadStatus(id: string, status: string): Promise<never>;
}
