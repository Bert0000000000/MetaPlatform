FROM node:22-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY package.json pnpm-lock.yaml* ./
COPY bff/package.json ./bff/
RUN pnpm install --filter @mate/bff...
WORKDIR /app/bff
ENV NODE_ENV=production
ENV PORT=3000
ENV API_MODE=mock
EXPOSE 3000
CMD ["node", "dist/server.js"]