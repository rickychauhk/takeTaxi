FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm install --ignore-scripts
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @taxima/shared && npm run build -w @taxima/api

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm install --omit=dev --ignore-scripts && npm rebuild bcrypt
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
