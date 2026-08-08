FROM node:22-alpine

WORKDIR /app

COPY package.json .
RUN npm install

COPY server.ts .
COPY types.ts .
COPY data/presets.ts ./data/

EXPOSE 8000

ENV PORT=8000

CMD ["npx", "tsx", "server.ts"]
