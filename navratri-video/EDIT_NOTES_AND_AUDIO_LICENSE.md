# SitesNSign – Navratri Day 1 (Maa Shailputri) – Edit Notes

## Source
Only the poster image was supplied (1254×1254 px, no video, no voice). No footage was invented.
The film is built entirely from the poster's own artwork.

## Output
SitesNSign_Navratri_Day1_Cinematic_4K.mp4 – 3840×2160, 16:9, 30 fps, H.264 (CRF 15) + AAC 256k, 30.0 s, -16 LUFS, TP -1.5 dB.
Note: the source is 1254 px wide, so 4K is an upscale (Lanczos). It is delivered 4K for platform quality; it is not native 4K detail.

## Edit structure (30 s)
| Time | Scene | Move | Voiceover (Hindi) / caption (Hinglish) |
|---|---|---|---|
| 0.0-6.2 | Full poster, brand reveal | slow push-in | Navratri ki hardik shubhkamnayein |
| 5.4-12.6 | Maa Shailputri close-up | push-in | Maa Shailputri - shakti, sthirta aur nayi shuruaat ka prateek |
| 11.8-18.2 | "Happy Navratri - Day 1" text | push-in | Maa ka aashirwad ... himmat, positivity aur safalta bhar de |
| 17.4-24.4 | Buyers/Brokers/Builders/Bankers/Owners cards | tracking pan | ... sabke liye ek platform |
| 23.6-30.0 | Full poster close + contact footer | pull-out | Technology, Trust aur Real Estate se ek mazboot kal. Shubh Navratri! - Team SitesNSign |

Transitions 0.8 s (fade / smooth / flash-white), light warm grade + vignette, burned-in gold keyword captions timed to the voiceover, SRT in captions_hinglish.srt.

## Voiceover
Neural Hindi voice: Kokoro-82M v1.0 (quantised ONNX), voice `hf_alpha`, run fully offline (build_voiceover.py), speed 0.97, at most 1.15x time-fit per line, light compression and room reverb.
Model/voice weights: Apache-2.0 (Kokoro-82M by hexgrad; obtained via the npm packages expo-kokoro / kokoro-q8-shards). Apache-2.0 permits commercial use; keep this attribution.
It is far more natural than the previous espeak-ng track but is still synthetic: loan words (Buyers, Brokers, SitesNSign) are read with Hindi phonetics. For a final brand film, a human recording is still the best option.
Lines start at 0.8, 5.9, 12.3, 17.9, 24.1 s. Mix: music sidechain-ducked under voice, loudnorm -16 LUFS, peak -1.5 dB.

## Audio licensing (music/SFX)
Drone pad and bell strikes are synthesised with ffmpeg `aevalsrc` (see this folder's scripts). No samples or stock library; original, free for commercial use, no attribution required.
Poster artwork/logo/contact details belong to SitesNSign Prop Tech Pvt Ltd; deity imagery appears AI-generated - confirm you hold rights before publishing.
Note: 4K is upscaled from a 1254 px source.

Files: build_video.py, build_voiceover.py, captions_hinglish.srt.
