FROM node:22-alpine AS build
ENV CI=true PUPPETEER_SKIP_DOWNLOAD=true NODE_OPTIONS=--max-old-space-size=4096
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.15.1 --activate
COPY metaplatform-frontend/pnpm-workspace.yaml metaplatform-frontend/pnpm-lock.yaml \
     metaplatform-frontend/package.json metaplatform-frontend/.npmrc ./
COPY metaplatform-frontend/apps/web/package.json apps/web/
COPY metaplatform-frontend/packages/shared/package.json packages/shared/
COPY metaplatform-frontend/packages/semi-theme-mate/package.json packages/semi-theme-mate/
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY metaplatform-frontend/ .
ENV VITE_ENV_LABEL=DEMO
RUN pnpm rebuild esbuild && pnpm --filter @mate/web typecheck && pnpm --filter @mate/web build

FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY infra/demo-cloud/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
