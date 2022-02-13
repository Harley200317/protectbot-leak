FROM node:17-slim

WORKDIR /usr/src/ProtectBot
COPY . .

RUN npm install && npm update
RUN npm install zlib-sync bufferutil utf-8-validate discord/erlpack
CMD [ "node", "index.js" ]
