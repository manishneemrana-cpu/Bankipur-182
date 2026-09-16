import "server-only";

import { SitesNSignNotConfiguredError, type SitesNSignConnector } from "./connector";

/**
 * Placeholder for a real SitesNSign API connection. No official,
 * documented SitesNSign API has been confirmed to exist. Every method
 * throws unconditionally rather than guess at an endpoint shape or fall
 * back to scraping - per the master spec, that is never acceptable.
 *
 * If/when SitesNSign publishes (or an OWNER/ADMIN provides) an official
 * API, this class gets a real implementation reading
 * SITESNSIGN_API_URL / SITESNSIGN_API_KEY from the environment. Until
 * then it exists only so the connector factory has something to select
 * when those env vars appear, without ever silently doing nothing.
 */
export class LiveSitesNSignConnector implements SitesNSignConnector {
  readonly name = "live";

  private fail(): never {
    throw new SitesNSignNotConfiguredError();
  }

  getProperties = () => this.fail();
  getProperty = () => this.fail();
  getLeads = () => this.fail();
  getLead = () => this.fail();
  getBrokers = () => this.fail();
  getBuilders = () => this.fail();
  getFollowups = () => this.fail();
  getSiteVisits = () => this.fail();
  getAnalytics = () => this.fail();
  updateProperty = () => this.fail();
  updateLeadStatus = () => this.fail();
}
