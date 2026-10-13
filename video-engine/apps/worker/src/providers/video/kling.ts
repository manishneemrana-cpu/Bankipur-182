import { config } from "../../config.js";
import { PaidApiNotImplemented, paidGate } from "../../lib/paid.js";
import { MockImageToVideoProvider } from "./mock.js";
import type { I2VDeps, I2VOptions, ImageToVideoProvider } from "./types.js";

/** Kling AI — image-to-video API */
export class KlingProvider implements ImageToVideoProvider {
  readonly id = "kling";
  private mock: MockImageToVideoProvider;
  constructor(deps: I2VDeps) { this.mock = new MockImageToVideoProvider(deps); }

  async generate(imageUrl: string, opts: I2VOptions): Promise<string> {
    if (paidGate("kling", config.KLING_API_KEY) === "mock") return this.mock.generate(imageUrl, opts);

    // TODO(paid-api): Kling — implement once the owner confirms the key is ready to test. Billed per generation.
    //   Auth: Kling uses a short-lived HS256 JWT signed with an access-key/secret-key pair. Decide the env format
    //   (e.g. KLING_API_KEY="<accessKey>:<secretKey>") when wiring this up, then: Authorization: `Bearer ${jwt}`
    //   POST https://api.klingai.com/v1/videos/image2video
    //   body: { model_name: "kling-v2-master", image: imageUrl, prompt: opts.prompt, duration: "5", aspect_ratio: opts.aspect, mode: "std" }
    //   poll: GET /v1/videos/image2video/{task_id} until data.task_status === "succeed"; URL = data.task_result.videos[0].url
    throw new PaidApiNotImplemented("Kling AI — image-to-video API");
  }
}
