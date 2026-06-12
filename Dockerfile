# Astro frontend + chat API server.
# PUBLIC_* values are inlined into the static HTML at build time, so pass
# them as build args; server secrets (GROQ_API_KEY etc.) are read from the
# environment at container runtime.

FROM node:20 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG PUBLIC_SITE_TITLE
ARG PUBLIC_TERMINAL_USER
ARG PUBLIC_TERMINAL_HOST
ARG PUBLIC_GITHUB_URL
ARG PUBLIC_LINKEDIN_URL
ARG PUBLIC_CONTACT_EMAIL
ARG PUBLIC_WEBSITE_URL
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]
