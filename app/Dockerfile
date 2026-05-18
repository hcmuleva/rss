# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Use production env for web build
COPY .env.production .env

# Build web output
RUN npx expo export -p web

# Production stage
FROM nginx:alpine
# Copy built assets to nginx subdirectory
COPY --from=builder /app/dist /usr/share/nginx/html/rss-app

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
