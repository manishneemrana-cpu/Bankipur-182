import numpy as np, soundfile as sf, subprocess, json
from kokoro_onnx import Kokoro
B="/tmp/kk/d_expo-kokoro/package/build"
k=Kokoro(f"{B}/kokoro-quantized.onnx","/tmp/kk/voices.npz")
VOICE="hf_alpha"
lines=[(0.8,5.0,"नवरात्रि की हार्दिक शुभकामनाएँ।"),
(5.9,5.8,"माँ शैलपुत्री, शक्ति, स्थिरता और नई शुरुआत का प्रतीक।"),
(12.3,5.4,"माँ का आशीर्वाद आपके जीवन में हिम्मत, पॉज़िटिविटी और सफलता भर दे।"),
(17.9,5.6,"बायर्स, ब्रोकर्स, बिल्डर्स, बैंकर्स और प्रॉपर्टी ओनर्स, सबके लिए एक प्लेटफ़ॉर्म।"),
(24.1,5.6,"टेक्नोलॉजी, ट्रस्ट और रियल एस्टेट से, एक मज़बूत कल। शुभ नवरात्रि! टीम साइट्स एन साइन।")]
tm=[]
for i,(st,mx,t) in enumerate(lines):
    s,sr=k.create(t,voice=VOICE,speed=0.97,lang="hi")
    sf.write(f"raw{i}.wav",s,sr); d=len(s)/sr
    r=max(1.0,d/mx)
    subprocess.check_call(["ffmpeg","-y","-loglevel","error","-i",f"raw{i}.wav","-af",
      f"atempo={r:.3f},highpass=f=90,acompressor=threshold=-20dB:ratio=2.5,aecho=0.8:0.9:60:0.12,volume=1.4","-ar","48000",f"vo{i}.wav"])
    d2=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f"vo{i}.wav"]))
    tm.append((st,d2)); print(i,round(d,2),round(d2,2),round(r,2))
json.dump(tm,open("timings.json","w"))
