FROM node:12.16-alpine

RUN apk add ffmpeg

ADD package.json /source/package.json
ADD video-narrator.js /source/video-narrator.js
WORKDIR /source
RUN npm install @google-cloud/text-to-speech -save

WORKDIR /scriptdir

ENTRYPOINT [ "/usr/local/bin/node", "/source/video-narrator.js" ]

