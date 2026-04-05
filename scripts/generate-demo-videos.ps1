$ErrorActionPreference = "Stop"

$ffmpegPath = node -e "process.stdout.write(require('ffmpeg-static'))"
if (-not $ffmpegPath) {
  throw "ffmpeg-static not found. Run: npm install --save-dev ffmpeg-static"
}

New-Item -ItemType Directory -Path ".\public\videos" -Force | Out-Null

$productFilter = "drawbox=x=0:y=0:w=iw:h=ih:color=#061018:t=fill,drawbox=x=46:y=42:w=1188:h=96:color=#00E99120:t=fill,drawbox=x=46:y=586:w=1188:h=90:color=#0e1a23:t=fill,drawtext=text='Wovo AI Product Demo':fontcolor=white:fontsize=56:x=94:y=64,drawtext=text='Get more booked tables from social content':fontcolor=#C6FFE7:fontsize=36:x=94:y=206:enable='between(t,0,2.4)',drawtext=text='Generate hooks captions and offer copy':fontcolor=#C6FFE7:fontsize=36:x=94:y=206:enable='between(t,2.4,4.8)',drawtext=text='Create ad visuals and promo concepts fast':fontcolor=#C6FFE7:fontsize=36:x=94:y=206:enable='between(t,4.8,7.2)',drawtext=text='Launch weekly campaigns and track bookings':fontcolor=#C6FFE7:fontsize=36:x=94:y=206:enable='between(t,7.2,9.6)',drawtext=text='Start DIY at $49/mo or scale with agency support':fontcolor=#C6FFE7:fontsize=34:x=94:y=206:enable='between(t,9.6,12)',drawtext=text='Restaurant growth system by Wovo Media':fontcolor=#80F9CF:fontsize=30:x=(w-text_w)/2:y=620"

& $ffmpegPath -y -f lavfi -i "color=c=#060d15:s=1280x720:d=12:r=30" -vf $productFilter -c:v libx264 -pix_fmt yuv420p -movflags +faststart "public/videos/wovo-product-demo.mp4"

$explainerFilter = "drawbox=x=0:y=0:w=iw:h=ih:color=#08131b:t=fill,drawbox=x=36:y=42:w=1208:h=122:color=#00E9911E:t=fill,drawbox=x=36:y=186:w=1208:h=444:color=#0f1b24:t=fill,drawtext=text='Wovo AI 60-Second Explainer':fontcolor=white:fontsize=54:x=72:y=74,drawtext=text='01 Capture your weekly offer and goal':fontcolor=#BDFDE1:fontsize=36:x=80:y=244:enable='between(t,0,3.5)',drawtext=text='02 Generate conversion-focused captions':fontcolor=#BDFDE1:fontsize=36:x=80:y=316:enable='between(t,3.5,7)',drawtext=text='03 Create ad visuals and short scripts':fontcolor=#BDFDE1:fontsize=36:x=80:y=388:enable='between(t,7,10.5)',drawtext=text='04 Publish optimize and repeat winners':fontcolor=#BDFDE1:fontsize=36:x=80:y=460:enable='between(t,10.5,14)',drawtext=text='From prompt to booked tables':fontcolor=#69F5C7:fontsize=34:x=(w-text_w)/2:y=644"

& $ffmpegPath -y -f lavfi -i "color=c=#081018:s=1280x720:d=14:r=30" -vf $explainerFilter -c:v libx264 -pix_fmt yuv420p -movflags +faststart "public/videos/wovo-explainer.mp4"

Write-Host "Demo videos generated in public/videos/"
