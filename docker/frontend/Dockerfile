# Development Dockerfile for Frontend
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY apps/frontend/package*.json ./
RUN npm install

# Copy source code
COPY apps/frontend ./

EXPOSE 3000

CMD ["npm", "run", "dev"]
