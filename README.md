[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/jWlmNV3B)
# API Code Challenge

A project to evaluate potential candidates for the API team. This project demonstrates a microservices architecture using NestJS, AWS Lambda, and PostgreSQL.

# Suggested Pre-reading

To familiarise yourself with this code repository and read a little more about the challenge structure you can review the [OVERVIEW.md](docs/OVERVIEW.md) file included in the documentation (docs) directory.

## Candidate Instructions

This repository contains a series of tasks designed to evaluate your API development skills. Please:

1. Read through the [Tasks instructions](docs/TASKS.md) carefully
2. Complete tasks 1, 2, and 3, using no more than 3 hours
3. Understand & follow the submission guidelines in the [Tasks instructions](docs/TASKS.md)
4. Focus on solution design, code quality, testing, and documentation
5. You will have **7 days** to complete this task. If you need more time due to personal reasons, please request a submission extension **before** the time limit

## Prerequisites

- Node.js (v23.7.0 or higher)
- Docker Desktop (for macOS/Windows) or Docker Engine with Docker Compose (for Linux)
- Serverless Framework

- [*Windows users only*] Possible/likely that you will need [WSL](https://learn.microsoft.com/en-us/windows/wsl/install) setup to run this code challenge.

## Project Structure

```folder
├── prisma/                # Database schema and migrations
├── services/
│   ├── lambdas/           # AWS Lambda functions for handling callbacks
│   ├── mock-ai-server/    # Mock AI service for image generation
│   └── nestjs/            # NestJS service for generation requests
├── scripts/               # Setup and utility scripts
└── docker-compose.yaml    # Docker services configuration
```

## Set-up Instructions

1. Run the setup script:

   ```bash
   npm run setup
   ```

   This will:

   - Set up Node.js environment.
   - Install all dependencies.
   - Copy environment files.
   - Start PostgreSQL database.
   - Run database migrations.
   - Start all services.

2. The following services will be available:
   - NestJS API: <http://localhost:3000>
   - API Documentation: <http://localhost:3000/api/docs>
   - Mock AI Server: <http://localhost:3001>
   - Lambda: <http://localhost:3004>
   - PostgreSQL: localhost:5433

## Environment Variables

The setup script will automatically copy `.env.example` to the necessary locations. Make sure to update the following variables in your `.env` file:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5433/ai_generation?schema=public"

# Services
LAMBDA_CALLBACK_URL="http://localhost:3004/dev/callback"
```

## Available Scripts

- `npm run setup`: Complete project setup (erases all DB data).
- `npm run start:mock-ai`: Start the mock AI server.
- `npm run start:nest`: Start the NestJS service.
- `npm run deploy:lambda`: Deploy Lambda functions locally.
- `npm run prisma:migrate`: Run database migrations.

## Recommendations

- Once you have run the setup script, and before you tackle any tasks, use a client such as Postman or Insomnia (or the provided Swagger documentation UI) to make a POST request to `http://localhost:3000/api/generation` with the required payload (see [API Documentation](#docs)). This will create a generation row in the database that you could see with a database client. This will ensure you are set up correctly and ready to start on the tasks.

## <a name="docs" style="color: black;">API Documentation</a>

The API is documented using OpenAPI Spec. You can access the documentation UI at:

```url
<http://localhost:3000/api/docs>
```

This provides interactive documentation allowing you to:

- See all available endpoints.
- View request/response schemas.
- Test API endpoints directly from the browser.

## License

UNLICENSED
