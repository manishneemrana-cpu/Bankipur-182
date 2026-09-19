export interface IndustryFramework {
  key: string;
  industry: string;
  hookFrameworks: string[];
  preferredCreativeFrameworks: string[];
  pacingMultiplier: number; // <1 slower/cinematic, >1 faster cuts
  requiredDisclaimers: string[];
  visualEmphasis: string;
  defaultCTA: string;
  defaultTone: string;
}
