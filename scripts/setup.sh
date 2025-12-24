#!/bin/bash
set -e

# Function to check if a port is available
check_port() {
    local port=$1
    if lsof -i :$port >/dev/null; then
        return 0 # Port is in use
    else
        return 1 # Port is available
    fi
}

echo "🚀 Setting up the project..."

# Source the Node.js setup script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/node_setup.sh"

# Setup Node.js environment with required versions
echo "🔧 Setting up Node.js environment..."
setup_node_environment "23.7.0" "10.0.0"

# Check for docker-compose
echo "🔍 Checking docker-compose installation..."
if ! command_exists docker-compose; then
    echo "Installing docker-compose..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install docker-compose
    else
        # Linux
        curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi
fi

# Copy environment files
echo "📝 Setting up environment files..."
if [ -f .env.example ]; then
    echo "Copying .env.example to services/nestjs/.env"
    cp .env.example .env
    cp .env.example services/nestjs/.env
    cp .env.example services/lambdas/.env
else
    echo "Warning: .env.example not found in the root directory"
fi

echo "🚀 Starting all services..."

# Install dependencies
echo "📦 Installing dependencies..."
npm run install:all

# Build NestJS application
echo "🏗️  Building NestJS application..."
(cd services/nestjs && npm run build)

# Start the database
echo "🗄️  Starting PostgreSQL database..."
docker-compose up -d postgres

# Wait for the database to be healthy
echo "⏳ Waiting for database to be ready..."
until docker-compose ps postgres | grep "healthy"; do
    sleep 2
done

# Clean up and reset database migrations
echo "🧹 Cleaning up existing migrations..."
rm -rf prisma/migrations
rm -rf prisma/migration_lock.toml

# Reset database and run migrations
echo "🔄 Resetting database and running migrations..."
npx prisma migrate reset --force
npx prisma migrate dev --name init

# Start mock AI server and NestJS service
echo "🤖 Starting mock AI server and NestJS service..."
docker-compose up -d mock-ai nestjs

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
until docker-compose logs mock-ai | grep -q "Mock AI server running on port 3001"; do
    printf '.'
    sleep 2
done
echo "✅ Mock AI server is ready!"

# Wait for services to be ready
echo "⏳ Waiting for NestJS service to start..."
until docker-compose logs nestjs | grep -q "Nest application successfully started"; do
    printf '.'
    sleep 2
done
echo "✅ NestJS service is ready!"

# Generate Prisma clients
echo "🔄 Generating Prisma client for lambdas ..."
(cd services/lambdas && npx prisma generate --schema=../../prisma/schema.prisma)

# Clean up any existing serverless build artifacts
echo "🧹 Cleaning up serverless build artifacts..."
rm -rf services/lambdas/.build

# Deploy serverless lambdas
echo "☁️  Deploying serverless lambdas..."
npm run deploy:lambda

echo "🎉 All services are up and running!"
echo "
Services available at:
- NestJS API: http://localhost:3000
- Mock AI Server: http://localhost:3001
- Lambda: http://localhost:3004
- PostgreSQL: localhost:5433
"
