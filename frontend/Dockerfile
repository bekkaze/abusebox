# Build the static site on the build machine's own platform: the output is
# plain HTML/JS/CSS, so it is the same for every target architecture.
# Pinned to the Node.js 22.23.4 security release (October 2026); Dependabot
# keeps the digests current.
FROM --platform=$BUILDPLATFORM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS build

WORKDIR /app
COPY package.json yarn.lock .yarnrc ./
COPY .yarn ./.yarn
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY . .
RUN yarn build

# Serve it with nginx, which also proxies /api to the backend. No Node.js at runtime.
FROM nginx:1.30.6-alpine@sha256:47928bf67eb62a1863cb08d9ecb52d3e704304ba614eaee17884204677702951

ENV BACKEND_URL=http://backend:8100
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 3000
