import "server-only";

import { SitesNSignWriteDisabledError, type SitesNSignConnector } from "./connector";
import type {
  ExternalAnalyticsSnapshot,
  ExternalBroker,
  ExternalBuilder,
  ExternalFollowup,
  ExternalLead,
  ExternalProperty,
  ExternalSiteVisit,
} from "./types";

// Static synthetic fixtures - intentionally independent of this app's own
// operational tables (src/lib/data/dashboard.ts), since this connector
// stands in for a pull from the separate, external SitesNSign platform.
const MOCK_PROPERTIES: ExternalProperty[] = [
  { id: "ext-p1", title: "Frazer Road 2BHK", city: "Patna", priceInr: 4800000, status: "active", verificationTier: "verified" },
  { id: "ext-p2", title: "Exhibition Road Retail Unit", city: "Patna", priceInr: 9500000, status: "active", verificationTier: "basic" },
  { id: "ext-p3", title: "Digha Ghat Riverview Plot", city: "Patna", priceInr: 5100000, status: "pending", verificationTier: "unverified" },
];

const MOCK_LEADS: ExternalLead[] = [
  { id: "ext-l1", name: "Sanjay Kumar", status: "hot", source: "SitesNSign Website" },
  { id: "ext-l2", name: "Poonam Devi", status: "warm", source: "SitesNSign Website" },
];

const MOCK_BROKERS: ExternalBroker[] = [
  { id: "ext-b1", name: "Rajesh Prasad", isActive: true },
];

const MOCK_BUILDERS: ExternalBuilder[] = [
  { id: "ext-bu1", name: "Patna Infra Developers", projectsCount: 5 },
];

const MOCK_FOLLOWUPS: ExternalFollowup[] = [
  { id: "ext-f1", leadId: "ext-l1", dueAt: new Date().toISOString(), status: "pending" },
];

const MOCK_SITE_VISITS: ExternalSiteVisit[] = [
  {
    id: "ext-sv1",
    leadId: "ext-l2",
    propertyId: "ext-p1",
    scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
    status: "scheduled",
  },
];

export class MockSitesNSignConnector implements SitesNSignConnector {
  readonly name = "mock";

  async getProperties() {
    return MOCK_PROPERTIES;
  }

  async getProperty(id: string) {
    return MOCK_PROPERTIES.find((p) => p.id === id) ?? null;
  }

  async getLeads() {
    return MOCK_LEADS;
  }

  async getLead(id: string) {
    return MOCK_LEADS.find((l) => l.id === id) ?? null;
  }

  async getBrokers() {
    return MOCK_BROKERS;
  }

  async getBuilders() {
    return MOCK_BUILDERS;
  }

  async getFollowups() {
    return MOCK_FOLLOWUPS;
  }

  async getSiteVisits() {
    return MOCK_SITE_VISITS;
  }

  async getAnalytics(): Promise<ExternalAnalyticsSnapshot> {
    return {
      totalProperties: MOCK_PROPERTIES.length,
      totalLeads: MOCK_LEADS.length,
      conversionRatePercent: 12.5,
      asOf: new Date().toISOString(),
    };
  }

  async updateProperty(): Promise<never> {
    throw new SitesNSignWriteDisabledError("updateProperty");
  }

  async updateLeadStatus(): Promise<never> {
    throw new SitesNSignWriteDisabledError("updateLeadStatus");
  }
}
