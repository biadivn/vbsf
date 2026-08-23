# syntax=docker/dockerfile:1
# VBSF Strapi backend — local/test image only.

FROM node:20-alpine AS build
RUN apk update && apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev git python3 make g++ > /dev/null 2>&1
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
WORKDIR /opt/app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache vips-dev
ENV NODE_ENV=production
WORKDIR /opt/app
COPY --from=build /opt/app ./
ENV PATH=/opt/app/node_modules/.bin:$PATH
RUN mkdir -p /opt/app/.tmp /opt/app/public/uploads && chown -R node:node /opt/app
USER node
EXPOSE 1337
CMD ["npm", "run", "start"]
