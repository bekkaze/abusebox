# Pin the October 2026 Node.js security release. This OCI index supports the
# linux/amd64 and linux/arm64 platforms built by the publish workflow.
FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914

# Fail the build if the resolved base image is not the required security runtime.
RUN test "$(node --version)" = "v22.23.4"

WORKDIR /app
COPY package.json yarn.lock .yarnrc .yarnrc.yml ./
COPY .yarn ./.yarn
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY . .
EXPOSE 3000

CMD ["yarn", "run", "dev"]
