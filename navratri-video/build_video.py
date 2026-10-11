import subprocess, sys
S="/tmp/claude-0/-home-user-Bankipur-182/d2deabbc-9422-5b24-9c54-c972fdd501ad/scratchpad"
W,H=3840,2160; FPS=30; XF=0.8
# name, crop(x,y,w,h), duration, zoom direction
scenes=[("full",(0,0,1254,1254),6.2,"in"),
        ("goddess",(540,60,714,700),7.2,"in"),
        ("title",(0,120,560,620),6.4,"in"),
        ("cards",(0,740,1254,310),7.0,"pan"),
        ("close",(0,0,1254,1254),6.4,"out")]

import os
def sh(c): subprocess.check_call(c)
files=[]
for i,(n,(x,y,w,h),d,mode) in enumerate(scenes):
    sc=min(3400/w,1640/h); fw=int(w*sc)//2*2; fh=int(h*sc)//2*2
    n_fr=int(d*FPS)+int(FPS*XF)+2
    dn=int(d*FPS)
    if mode=="in": z=f"1+0.10*on/{dn}"
    elif mode=="out": z=f"1.12-0.12*on/{dn}"
    else: z="1.10"
    px=f"(iw-iw/zoom)*on/{dn}" if mode=="pan" else "iw/2-(iw/zoom/2)"
    f=(f"[0:v]split[a][b];[a]scale=480:480,crop=480:270:0:100,boxblur=6:2,scale={W}:{H}:flags=bicubic,eq=brightness=-0.12:saturation=1.1[bg];"
       f"[b]crop={w}:{h}:{x}:{y},scale={int(fw*1.5)}:{int(fh*1.5)}:flags=lanczos,"
       f"zoompan=z='{z}':x='{px}':y='ih/2-(ih/zoom/2)':d={n_fr}:s={fw}x{fh}:fps={FPS}[fg];"
       f"[bg][fg]overlay=(W-w)/2:(H-h)/2-150:shortest=1,format=yuv420p,setsar=1[v]")
    out=f"{S}/sc{i}.mp4"
    sh(["ffmpeg","-y","-hide_banner","-loglevel","error","-loop","1","-framerate","30","-t",str(d+2),"-i",f"{S}/poster.png","-filter_complex",f,"-map","[v]","-frames:v",str(n_fr),
        "-c:v","libx264","-preset","fast","-crf","12","-pix_fmt","yuv420p","-r",str(FPS),out])
    files.append(out); print("scene",i,flush=True)
fc=[];t=scenes[0][2];cur="[0:v]"
for i in range(1,len(scenes)):
    off=t-XF
    tr=["fade","smoothleft","fadewhite","smoothright"][(i-1)%4]
    fc.append(f"{cur}[{i}:v]xfade=transition={tr}:duration={XF}:offset={off:.2f}[x{i}]")
    cur=f"[x{i}]"; t=off+scenes[i][2]
total=t
fc.append(f"{cur}trim=0:{total:.2f},setpts=PTS-STARTPTS,curves=all='0/0 0.5/0.52 1/1',eq=contrast=1.06:saturation=1.08,vignette=PI/5,"
          f"fade=t=in:d=0.8,fade=t=out:st={total-1.2:.2f}:d=1.2,ass={S}/captions.ass[v]")
inp=[]
for f in files: inp+=["-i",f]
sh(["ffmpeg","-y","-hide_banner","-loglevel","error"]+inp+["-filter_complex",";".join(fc),"-map","[v]","-an","-c:v","libx264","-preset","medium","-crf","15","-pix_fmt","yuv420p","-r",str(FPS),f"{S}/video_noaudio.mp4"])
print("total",total)
