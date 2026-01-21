FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first to cache dependencies
COPY package*.json ./

# Install production dependencies
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on (Fly.io sets the PORT env var)
ENV PORT=8080
EXPOSE 8080

# Start the application
CMD ["npm", "start"]
