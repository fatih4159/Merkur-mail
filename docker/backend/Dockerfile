# Development Dockerfile for Backend
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY apps/backend/package*.json ./
RUN npm install

# Copy source code
COPY apps/backend ./

# Generate Prisma Client
RUN npx prisma generate

EXPOSE 3001

CMD ["npm", "run", "dev"]
