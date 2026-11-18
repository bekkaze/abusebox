# Build the static site on the build machine's own platform: the output is
# plain HTML/JS/CSS, so it is the same for every target architecture.
# Pinned to the Node.js 22.23.4 security release (October 2026); Dependabot
# keeps the digests current.
FROM --platform=$BUILDPLATFORM node:22.23.5-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS build

WORKDIR /app
COPY package.json yarn.lock .yarnrc ./
COPY .yarn ./.yarn
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY . .
RUN yarn build

# Serve it with nginx, which also proxies /api to the backend. No Node.js at runtime.
FROM nginx:1.30.6-alpine@sha256:901e593c95dc85f5a729f5765516321366ef4ac401821431d408897e95287d0a

ENV BACKEND_URL=http://backend:8100
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 3000

# nginx carries no curl either; this is the one tool the image is guaranteed
# to have and it checks the same socket a browser would reach.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD nginx -t -q && wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1
