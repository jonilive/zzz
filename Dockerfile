FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy app source
COPY . .

# Set default environment variables
ENV PORT=3000
ENV UPLOADS_DIR=/data/uploads

# Create the uploads directory in the data volume
RUN mkdir -p /data/uploads

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "server.js"]
