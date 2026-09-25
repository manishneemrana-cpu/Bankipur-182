export type CredentialFieldType = "secret" | "text" | "select";

export interface CredentialField {
  key: string;
  label: string;
  type: CredentialFieldType;
  options?: string[]; // for type: "select"
  placeholder?: string;
  whereToGet: string; // shown under the field in the Settings UI
  required?: boolean;
}

export interface CredentialGroup {
  group: string;
  description: string;
  fields: CredentialField[];
}

/**
 * Everything a user can configure from the Settings dashboard instead of a
 * Vercel env var. Infra-level values (DATABASE_URL, REDIS_URL,
 * WORKER_TICK_SECRET) are deliberately excluded — those wire up the platform
 * itself and are needed before any organization/tenant context exists.
 */
export const CREDENTIAL_CATALOG: CredentialGroup[] = [
  {
    group: "LLM (creative strategy, script, storyboard)",
    description: "Pick one. The first provider below with a key set is used, unless you pick one explicitly.",
    fields: [
      {
        key: "DEFAULT_LLM_PROVIDER",
        label: "Provider to use",
        type: "select",
        options: ["", "gemini", "openrouter", "nvidia", "groq", "together"],
        whereToGet: "Leave blank for auto-detect (first configured key below is used).",
      },
      {
        key: "GEMINI_API_KEY",
        label: "Google Gemini API key",
        type: "secret",
        whereToGet: "Get a free key at aistudio.google.com/apikey. Also the only provider used for video quality-control.",
      },
      {
        key: "GROQ_API_KEY",
        label: "Groq API key",
        type: "secret",
        whereToGet: "Get a free key at console.groq.com/keys — fast inference, generous free tier. Recommended.",
      },
      {
        key: "OPENROUTER_API_KEY",
        label: "OpenRouter API key",
        type: "secret",
        whereToGet: "Get a key at openrouter.ai/keys. Free models: openrouter.ai/models?max_price=0",
      },
      {
        key: "NVIDIA_API_KEY",
        label: "NVIDIA NIM API key",
        type: "secret",
        whereToGet: "Get a key at build.nvidia.com — pick a model, click \"Get API Key\". Also used for image generation below.",
      },
      {
        key: "TOGETHER_API_KEY",
        label: "Together AI API key",
        type: "secret",
        whereToGet: "Get a key at api.together.ai/settings/api-keys — has always-free \"Turbo Free\" models.",
      },
    ],
  },
  {
    group: "Video generation",
    description:
      "\"pollinations-pan\" is free and needs no key — it animates AI-generated still frames with a pan/zoom instead of real " +
      "motion footage. Every other option is a real AI video model, but all are paid/per-second billed.",
    fields: [
      {
        key: "DEFAULT_VIDEO_PROVIDER",
        label: "Provider to use",
        type: "select",
        options: ["pollinations-pan", "google-veo-2", "runway-gen4", "luma-dream-machine", "kling-1.5"],
        whereToGet: "Leave as \"pollinations-pan\" for a free result with no signup, or pick a paid model below.",
      },
      { key: "GOOGLE_VEO_API_KEY", label: "Google Veo API key", type: "secret", whereToGet: "Google AI Studio / Vertex AI console — Veo access." },
      { key: "RUNWAY_API_KEY", label: "Runway API key", type: "secret", whereToGet: "dev.runwayml.com — Developer Portal → API Keys." },
      { key: "LUMA_API_KEY", label: "Luma Dream Machine API key", type: "secret", whereToGet: "lumalabs.ai/dream-machine/api — API Keys." },
      { key: "LUMA_MODEL", label: "Luma model (optional)", type: "text", placeholder: "ray-2", whereToGet: "Leave blank for the default (ray-2)." },
      { key: "KLING_API_KEY", label: "Kling API key", type: "secret", whereToGet: "klingai.com developer platform — API Keys." },
    ],
  },
  {
    group: "Voice (text-to-speech)",
    description: "",
    fields: [
      {
        key: "DEFAULT_VOICE_PROVIDER",
        label: "Provider to use",
        type: "select",
        options: ["", "elevenlabs", "huggingface"],
        whereToGet: "Leave blank for auto (ElevenLabs if set, else Hugging Face, else mock).",
      },
      {
        key: "ELEVENLABS_API_KEY",
        label: "ElevenLabs API key",
        type: "secret",
        whereToGet: "elevenlabs.io → Profile → API Keys. Best quality + word-level timing, ~10k chars/month free.",
      },
      {
        key: "HUGGINGFACE_API_KEY",
        label: "Hugging Face API token",
        type: "secret",
        whereToGet: "huggingface.co/settings/tokens — free. Also used for image generation below.",
      },
    ],
  },
  {
    group: "Background music",
    description: "",
    fields: [
      {
        key: "MUBERT_API_KEY",
        label: "Mubert API key",
        type: "secret",
        whereToGet: "mubert.com/render — free tier available. Leave blank to use a mock music track.",
      },
    ],
  },
  {
    group: "Storage (final assets: video, audio, captions)",
    description: "Required for real output — without this, generated files aren't retrievable after rendering.",
    fields: [
      {
        key: "STORAGE_PROVIDER",
        label: "Storage mode",
        type: "select",
        options: ["local", "s3"],
        whereToGet: "\"s3\" for a real deploy (S3-compatible: AWS S3 or Cloudflare R2). \"local\" only works on your own server, never on Vercel.",
      },
      { key: "S3_BUCKET", label: "Bucket name", type: "text", whereToGet: "The bucket you created on AWS S3 or Cloudflare R2." },
      { key: "S3_REGION", label: "Region", type: "text", placeholder: "auto", whereToGet: "AWS region, or \"auto\" for Cloudflare R2." },
      { key: "S3_ACCESS_KEY_ID", label: "Access key ID", type: "secret", whereToGet: "From your S3/R2 bucket's API token page." },
      { key: "S3_SECRET_ACCESS_KEY", label: "Secret access key", type: "secret", whereToGet: "From your S3/R2 bucket's API token page." },
      { key: "S3_ENDPOINT", label: "Endpoint (R2 only)", type: "text", whereToGet: "Cloudflare R2 dashboard → bucket → \"S3 API\" endpoint URL. Leave blank for AWS S3." },
      { key: "S3_PUBLIC_BASE_URL", label: "Public base URL (optional)", type: "text", whereToGet: "A public bucket/CDN URL in front of your storage, if you have one." },
    ],
  },
  {
    group: "Final video assembly (rendering)",
    description: "",
    fields: [
      {
        key: "SHOTSTACK_API_KEY",
        label: "Shotstack API key",
        type: "secret",
        whereToGet: "Sign up free at shotstack.io → Dashboard → API Keys → \"Sandbox\" key. Renders in the cloud — no server needed.",
      },
      {
        key: "SHOTSTACK_ENV",
        label: "Shotstack tier",
        type: "select",
        options: ["stage", "v1"],
        whereToGet: "\"stage\" = free sandbox (watermarked). \"v1\" = paid production (no watermark).",
      },
    ],
  },
];

export const ALL_CREDENTIAL_KEYS: string[] = CREDENTIAL_CATALOG.flatMap((g) => g.fields.map((f) => f.key));
export const SECRET_CREDENTIAL_KEYS = new Set(
  CREDENTIAL_CATALOG.flatMap((g) => g.fields.filter((f) => f.type === "secret").map((f) => f.key))
);
