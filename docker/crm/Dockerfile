FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
COPY package.json package-lock.json* ./
COPY apps/crm/package.json apps/crm/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace=@taxima/crm --include-workspace-root=false 2>/dev/null || npm install
COPY packages/shared packages/shared
COPY apps/crm apps/crm
RUN npm run build -w @taxima/crm

FROM nginx:1.27-alpine
COPY docker/crm/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/crm/dist /usr/share/nginx/html
EXPOSE 80
