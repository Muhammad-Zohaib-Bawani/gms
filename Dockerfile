# Build context is the repo root, not this folder:
#   docker build -f Frontend/Dockerfile -t gms-frontend .
FROM node:22-alpine AS build
WORKDIR /app

# Vite inlines these at build time — nothing is read at runtime, so container/App
# Service env vars set after the build have no effect. Leaving VITE_API_URL empty
# makes the SPA call /api on its own origin (see src/config/env.js), which only
# works if something in front proxies /api to the backend; set it to the API's
# absolute URL including /api otherwise.
ARG VITE_API_URL=
ARG VITE_API_TIMEOUT=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_TIMEOUT=$VITE_API_TIMEOUT

ARG VITE_BACKEND_ORIGIN=
ENV VITE_BACKEND_ORIGIN=$VITE_BACKEND_ORIGIN
# Portal sign-in mode. VITE_AUTH_MODE=entra renders "Sign in with Microsoft" and
# hides the password form; it has to agree with the backend's Auth:Mode, which
# rejects portal password logins outright when that is EntraId. The client and
# tenant ids are the app registration's — public values, not secrets, and baked in
# here because MSAL needs them before the first request is ever made.
ARG VITE_AUTH_MODE=local
ARG VITE_ENTRA_TENANT_ID=
ARG VITE_ENTRA_CLIENT_ID=
ARG VITE_ENTRA_SCOPE=
ENV VITE_AUTH_MODE=$VITE_AUTH_MODE
ENV VITE_ENTRA_TENANT_ID=$VITE_ENTRA_TENANT_ID
ENV VITE_ENTRA_CLIENT_ID=$VITE_ENTRA_CLIENT_ID
ENV VITE_ENTRA_SCOPE=$VITE_ENTRA_SCOPE

COPY Frontend/package*.json ./
RUN npm ci

COPY Frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine AS runtime

# Without this the stock config 404s every deep link (/guests, /events/3) on
# refresh — the SPA needs index.html served for any path the router owns.
# Same job vercel.json's rewrite does on Vercel.
COPY docker/nginx/spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
