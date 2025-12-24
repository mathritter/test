# Use Node.js base image with Alpine 3.18
FROM node:20-alpine3.18

# Set the working directory inside the container
WORKDIR /app

# Install OpenSSL 1.1 and any dependencies needed for Prisma
RUN apk update && apk add --no-cache \
    libssl1.1 \
    && rm -rf /var/cache/apk/*

# Copy package.json and package-lock.json first to install dependencies
COPY services/nestjs/package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application code
COPY services/nestjs/ .

# Copy .env file
COPY services/nestjs/.env .env

# Copy common Prisma schema
COPY prisma/schema.prisma ./prisma/schema.prisma

# Ensure Prisma client is generated
RUN npx prisma generate

# Expose the port your app will run on
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
