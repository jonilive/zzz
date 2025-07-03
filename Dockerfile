FROM node:18-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory and set permissions
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy app source
COPY . .

# Set default environment variables
ENV PORT=3000
ENV UPLOADS_DIR=/data/uploads
ENV NODE_ENV=production

# Create the uploads directory and set permissions
RUN mkdir -p /data/uploads && \
    chown -R nodejs:nodejs /app /data

# Switch to non-root user
USER nodejs

# Expose the port the app runs on
EXPOSE 3000

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Command to run the application
CMD ["node", "server.js"]
