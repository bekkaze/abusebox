FROM node:22-alpine

WORKDIR /app
COPY package.json yarn.lock .yarnrc .yarnrc.yml ./
COPY .yarn ./.yarn
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY . .
EXPOSE 3000

CMD ["yarn", "run", "dev"]
