import subprocess, json
S="."
lines=[(0.8,5.2,"नवरात्रि की हार्दिक शुभकामनाएँ।"),
(5.9,5.6,"माँ शैलपुत्री, शक्ति, स्थिरता और नई शुरुआत का प्रतीक।"),
(12.3,5.0,"माँ का आशीर्वाद आपके जीवन में हिम्मत, पॉज़िटिविटी और सफलता भर दे।"),
(17.9,5.5,"बायर्स, ब्रोकर्स, बिल्डर्स, बैंकर्स और प्रॉपर्टी ओनर्स, सबके लिए एक प्लेटफ़ॉर्म।"),
(24.1,5.4,"टेक्नोलॉजी, ट्रस्ट और रियल एस्टेट से, एक मज़बूत कल। शुभ नवरात्रि! टीम साइट्स एन साइन।")]
timings=[]
for i,(st,maxd,txt) in enumerate(lines):
    subprocess.check_call(["espeak-ng","-v","hi+f3","-s","155","-p","55","-w",f"raw{i}.wav",txt])
    d=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f"raw{i}.wav"]))
    r=max(1.0,d/maxd)
    subprocess.check_call(["ffmpeg","-y","-loglevel","error","-i",f"raw{i}.wav","-af",
      f"atempo={r:.3f},highpass=f=120,equalizer=f=3000:t=q:w=1:g=3,acompressor=threshold=-18dB:ratio=3,volume=1.6","-ar","48000",f"vo{i}.wav"])
    d2=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f"vo{i}.wav"]))
    timings.append((st,d2)); print(i,round(d,2),round(d2,2))
json.dump(timings,open("timings.json","w"))
