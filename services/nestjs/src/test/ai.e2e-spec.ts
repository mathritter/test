import request from 'supertest'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { GenerationStatus } from '../constants/generation-status.enum'
import { AppModule } from '../app.module'
import { AiService } from '../service/ai.service'

describe('Ai', () => {
  let app: INestApplication
  let aiService = {
    generateImage: () => {
      return Promise.resolve({ generationId: '123' })
    },
    findGenerationById: () => {
      return Promise.resolve({
        generationId: '123',
        generationStatus: GenerationStatus.COMPLETE,
        imageUrl: 'url test',
      })
    },
  }

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AiService)
      .useValue(aiService)
      .compile()

    app = moduleRef.createNestApplication()
    await app.init()
  })

  const generationPayload = { prompt: 'test prompt' }
  const generationResponse = { generationId: '123' }

  it('/POST generate image', () => {
    return request(app.getHttpServer()).post('/api/generation').send(generationPayload).expect(201).expect(generationResponse)
  })

  it('/GET get generation by generationId', () => {
    return request(app.getHttpServer()).get('/api/generation/123').expect(200).expect({
      generationId: '123',
      generationStatus: GenerationStatus.COMPLETE,
      imageUrl: 'url test',
    })
  })
})
