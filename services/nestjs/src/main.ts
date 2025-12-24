import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Enable CORS
  app.enableCors()

  // Swagger documentation setup
  const config = new DocumentBuilder()
    .setTitle('Image Generation API')
    .setDescription('API for generating and managing AI-generated images')
    .setVersion('1.0')
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'Image Generation API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  })

  await app.listen(3000, '0.0.0.0')
  console.log(`Application is running on: http://localhost:3000`)
  console.log(`Swagger documentation is available at: http://localhost:3000/api/docs`)
}
bootstrap()
