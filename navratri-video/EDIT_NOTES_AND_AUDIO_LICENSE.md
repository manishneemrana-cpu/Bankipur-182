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

## Voiceover - IMPORTANT
Generated offline with espeak-ng (Hindi voice, sped to fit each scene). It is intelligible but clearly synthetic/robotic: treat it as a scratch track.
No better TTS was reachable from this sandbox. For publication, record a human voice (or a licensed TTS) reading build_voiceover.py's lines and replace the voice track; scene timing already has room (each line starts at 0.8, 5.9, 12.3, 17.9, 24.1 s).
Licence: espeak-ng is GPL software, but speech it produces is not subject to copyright in its own right; no third-party voice data or actors involved.
Mix: music ducked under voice via sidechain compression, loudnorm -16 LUFS, peak -1.5 dB.

## Audio licensing (music/SFX)
Drone pad and bell strikes are synthesised with ffmpeg `aevalsrc` (see this folder's scripts). No samples or stock library; original, free for commercial use, no attribution required.
Poster artwork/logo/contact details belong to SitesNSign Prop Tech Pvt Ltd; deity imagery appears AI-generated - confirm you hold rights before publishing.
Note: 4K is upscaled from a 1254 px source.

Files: build_video.py, build_voiceover.py, captions_hinglish.srt.
