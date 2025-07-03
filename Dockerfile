FROM node:18-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy app source
COPY . .

# Set default environment variables
ENV PORT=3000
ENV UPLOADS_DIR=/data/uploads
ENV NODE_ENV=production

# Create the uploads directory
RUN mkdir -p /data/uploads

# Expose the port the app runs on
EXPOSE 3000

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Command to run the application
CMD ["node", "server.js"]
