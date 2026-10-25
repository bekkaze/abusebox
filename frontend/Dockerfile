# Pinned to the Node.js 22.23.4 security release (October 2026). The digest is
# the official multi-arch index (linux/amd64 + linux/arm64); Dependabot keeps
# it current.
FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914

WORKDIR /app
COPY package.json yarn.lock .yarnrc .yarnrc.yml ./
COPY .yarn ./.yarn
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY . .
EXPOSE 3000

CMD ["yarn", "run", "dev"]
