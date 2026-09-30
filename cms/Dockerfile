# Built in CI (the admin build needs ~2 GB RAM); the VPS only runs the image.
FROM node:24-alpine AS build
RUN apk add --no-cache build-base python3 vips-dev
WORKDIR /opt/app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NODE_ENV=production
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
RUN apk add --no-cache vips
WORKDIR /opt/app
ENV NODE_ENV=production \
    DATABASE_FILENAME=/opt/app/data/data.db
COPY --from=build --chown=node:node /opt/app ./
RUN mkdir -p /opt/app/data && chown node:node /opt/app/data
USER node
EXPOSE 1337
CMD ["npm", "run", "start"]
