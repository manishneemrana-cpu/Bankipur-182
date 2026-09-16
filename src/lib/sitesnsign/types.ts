/**
 * Types for data pulled from the SitesNSign production platform via the
 * connector. Deliberately separate from this app's own operational
 * tables (src/lib/data/dashboard.ts) - the connector mirrors an external
 * system whose real schema is unknown to us; these are working
 * approximations pending an official, documented SitesNSign API.
 */
export type ExternalProperty = {
  id: string;
  title: string;
  city: string;
  priceInr: number;
  status: string;
  verificationTier: string;
};

export type ExternalLead = {
  id: string;
  name: string;
  status: string;
  source: string;
};

export type ExternalBroker = {
  id: string;
  name: string;
  isActive: boolean;
};

export type ExternalBuilder = {
  id: string;
  name: string;
  projectsCount: number;
};

export type ExternalFollowup = {
  id: string;
  leadId: string;
  dueAt: string;
  status: string;
};

export type ExternalSiteVisit = {
  id: string;
  leadId: string;
  propertyId: string;
  scheduledAt: string;
  status: string;
};

export type ExternalAnalyticsSnapshot = {
  totalProperties: number;
  totalLeads: number;
  conversionRatePercent: number;
  asOf: string;
};
