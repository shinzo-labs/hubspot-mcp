# Use Node.js 20 LTS
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Set Node options for memory
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Copy package files
COPY --chown=node:node package*.json ./

# Install dependencies using npm
RUN npm ci

# Copy source files
COPY --chown=node:node src/ ./src/
COPY --chown=node:node tsconfig.json ./

# Build TypeScript
RUN npm run build

# Switch to non-root user
USER node

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
