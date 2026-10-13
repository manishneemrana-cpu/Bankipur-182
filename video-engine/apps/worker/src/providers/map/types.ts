export interface MapScene {
  lat: number;
  lng: number;
  /** Headline on the pin (project name) and the line under it (address). */
  label: string;
  subLabel: string;
  accent: string;
  durationSec: number;
  fps: number;
  /** Square capture size in px. Square so both 9:16 and 16:9 can center-crop it without scaling. */
  size: number;
}

/**
 * Map adapter. A provider supplies only the *basemap backend*; the camera path, animated route line,
 * pulsing pin and label are a shared overlay (page.ts), so every provider looks consistent and a new
 * one is ~one file. Selectable via MAP_PROVIDER or the Settings dropdown.
 *
 * The backend JS must define `window.__backend = { supportsPitch: boolean, init(scene): Promise<void>,
 * setCamera({lng,lat,zoom,pitch,bearing}): void, project(lng,lat): [x,y], waitIdle(): Promise<void> }`
 * where project() returns pixel coordinates in the size×size capture viewport.
 */
export interface MapProvider {
  readonly id: string;
  /** HTML injected into <head> (SDK script/style tags). */
  headHtml(): string;
  /** JS source defining window.__backend. */
  backendJs(scene: MapScene): string;
  /** Throws PaidApiNotImplemented if a live (billable) basemap is requested but not implemented yet. */
  assertReady(): void;
}
