import request from 'supertest'
import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { GenerationStatus } from '../constants/generation-status.enum'
import { AppModule } from '../app.module'
import { PrismaService } from '../service/prisma.service'
import axios from 'axios'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('Ai E2E', () => {
  let app: INestApplication

  const prismaMock = {
    generations: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $disconnect: jest.fn(),
    $connect: jest.fn(),
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    jest.useRealTimers()

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile()

    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  const generationPayload = { prompt: 'test prompt' }

  describe('POST /api/generation', () => {
    it('should create a generation and return generationId', async () => {
      const mockGeneration = {
        id: 'test-id',
        generationId: 'test-generation-id',
        prompt: 'test prompt',
        imageHeight: 1024,
        imageWidth: 1024,
        coreModel: 'SDXL',
        createdAt: new Date(),
        updatedAt: new Date(),
        public: true,
        flagged: false,
        nsfw: false,
        generationStatus: GenerationStatus.PENDING,
        imageUrl: null,
        retryAttempts: 0,
        lastRetryAt: null,
        retryErrors: null,
      }

      prismaMock.generations.create.mockResolvedValue(mockGeneration)
      mockedAxios.post.mockResolvedValue({
        data: { imageUrl: 'http://image-url/test' },
      })
      prismaMock.generations.update.mockResolvedValue({})

      const response = await request(app.getHttpServer())
        .post('/api/generation')
        .send(generationPayload)
        .expect(201)

      expect(response.body).toHaveProperty('generationId')
      expect(prismaMock.generations.create).toHaveBeenCalled()
    })
  })

  describe('GET /api/generation/:id', () => {
    it('should return generation with retry information when status is COMPLETE', async () => {
      const mockGeneration = {
        generationStatus: GenerationStatus.COMPLETE,
        prompt: 'test prompt',
        imageUrl: 'http://image-url/test',
        retryAttempts: 2,
        lastRetryAt: new Date('2024-01-01T00:00:00Z'),
      }

      prismaMock.generations.findUnique.mockResolvedValue(mockGeneration)

      const response = await request(app.getHttpServer())
        .get('/api/generation/test-id')
        .expect(200)

      expect(response.body).toEqual({
        generationStatus: GenerationStatus.COMPLETE,
        prompt: 'test prompt',
        imageUrl: 'http://image-url/test',
        retryAttempts: 2,
        lastRetryAt: expect.any(String),
      })
    })

    it('should return generation without imageUrl when status is PENDING', async () => {
      const mockGeneration = {
        generationStatus: GenerationStatus.PENDING,
        prompt: 'test prompt',
        imageUrl: 'http://image-url/test',
        retryAttempts: 0,
        lastRetryAt: null,
      }

      prismaMock.generations.findUnique.mockResolvedValue(mockGeneration)

      const response = await request(app.getHttpServer())
        .get('/api/generation/test-id')
        .expect(200)

      expect(response.body.generationStatus).toBe(GenerationStatus.PENDING)
      expect(response.body.imageUrl).toBeUndefined()
    })

    it('should return generation with retry information when status is FAILED', async () => {
      const mockGeneration = {
        generationStatus: GenerationStatus.FAILED,
        prompt: 'test prompt',
        imageUrl: null,
        retryAttempts: 3,
        lastRetryAt: new Date('2024-01-01T00:00:00Z'),
      }

      prismaMock.generations.findUnique.mockResolvedValue(mockGeneration)

      const response = await request(app.getHttpServer())
        .get('/api/generation/test-id')
        .expect(200)

      expect(response.body.generationStatus).toBe(GenerationStatus.FAILED)
      expect(response.body.imageUrl).toBeUndefined()
      expect(response.body.retryAttempts).toBe(3)
    })

    it('should return 404 when generation is not found', async () => {
      prismaMock.generations.findUnique.mockResolvedValue(null)

      await request(app.getHttpServer()).get('/api/generation/non-existent').expect(404)
    })
  })

  describe('Retry Mechanism E2E', () => {
    it('should retry on AI server failure and eventually succeed', async () => {
      jest.useFakeTimers()
      const mockGeneration = {
        id: 'test-id',
        generationId: 'test-generation-id',
        prompt: 'test prompt',
        imageHeight: 1024,
        imageWidth: 1024,
        coreModel: 'SDXL',
        createdAt: new Date(),
        updatedAt: new Date(),
        public: true,
        flagged: false,
        nsfw: false,
        generationStatus: GenerationStatus.PENDING,
        imageUrl: null,
        retryAttempts: 0,
        lastRetryAt: null,
        retryErrors: null,
      }

      prismaMock.generations.create.mockResolvedValue(mockGeneration)
      mockedAxios.post
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({
          data: { imageUrl: 'http://image-url/success' },
        })

      prismaMock.generations.update.mockResolvedValue({})

      const response = await request(app.getHttpServer())
        .post('/api/generation')
        .send(generationPayload)
        .expect(201)

      expect(response.body).toHaveProperty('generationId')

      await jest.advanceTimersByTimeAsync(5000)

      expect(mockedAxios.post).toHaveBeenCalledTimes(3)
      expect(prismaMock.generations.update).toHaveBeenCalledWith({
        where: { generationId: 'test-generation-id' },
        data: expect.objectContaining({
          generationStatus: GenerationStatus.COMPLETE,
          imageUrl: 'http://image-url/success',
          retryAttempts: 2,
          lastRetryAt: expect.any(Date),
          retryErrors: expect.arrayContaining([
            expect.objectContaining({
              attempt: 1,
              error: expect.any(String),
              timestamp: expect.any(String),
            }),
            expect.objectContaining({
              attempt: 2,
              error: expect.any(String),
              timestamp: expect.any(String),
            }),
          ]),
        }),
      })
    })

    it('should mark as FAILED after max retry attempts', async () => {
      jest.useFakeTimers()
      const mockGeneration = {
        id: 'test-id',
        generationId: 'test-generation-id',
        prompt: 'test prompt',
        imageHeight: 1024,
        imageWidth: 1024,
        coreModel: 'SDXL',
        createdAt: new Date(),
        updatedAt: new Date(),
        public: true,
        flagged: false,
        nsfw: false,
        generationStatus: GenerationStatus.PENDING,
        imageUrl: null,
        retryAttempts: 0,
        lastRetryAt: null,
        retryErrors: null,
      }

      prismaMock.generations.create.mockResolvedValue(mockGeneration)
      mockedAxios.post.mockRejectedValue(new Error('Persistent error'))

      prismaMock.generations.update.mockResolvedValue({})

      const response = await request(app.getHttpServer())
        .post('/api/generation')
        .send(generationPayload)
        .expect(201)

      expect(response.body).toHaveProperty('generationId')

      await jest.advanceTimersByTimeAsync(15000)

      expect(mockedAxios.post).toHaveBeenCalledTimes(3)
      expect(prismaMock.generations.update).toHaveBeenCalledWith({
        where: { generationId: 'test-generation-id' },
        data: expect.objectContaining({
          generationStatus: GenerationStatus.FAILED,
          retryAttempts: 3,
          lastRetryAt: expect.any(Date),
          retryErrors: expect.arrayContaining([
            expect.objectContaining({
              attempt: 1,
              error: expect.any(String),
            }),
            expect.objectContaining({
              attempt: 2,
              error: expect.any(String),
            }),
            expect.objectContaining({
              attempt: 3,
              error: expect.any(String),
            }),
          ]),
        }),
      })
    })

    it('should apply exponential backoff between retries', async () => {
      jest.useFakeTimers()
      const mockGeneration = {
        id: 'test-id',
        generationId: 'test-generation-id',
        prompt: 'test prompt',
        imageHeight: 1024,
        imageWidth: 1024,
        coreModel: 'SDXL',
        createdAt: new Date(),
        updatedAt: new Date(),
        public: true,
        flagged: false,
        nsfw: false,
        generationStatus: GenerationStatus.PENDING,
        imageUrl: null,
        retryAttempts: 0,
        lastRetryAt: null,
        retryErrors: null,
      }

      prismaMock.generations.create.mockResolvedValue(mockGeneration)
      const callTimes: number[] = []
      mockedAxios.post.mockImplementation(async () => {
        callTimes.push(Date.now())
        throw new Error('Network error')
      })

      prismaMock.generations.update.mockResolvedValue({})

      await request(app.getHttpServer()).post('/api/generation').send(generationPayload).expect(201)

      await jest.advanceTimersByTimeAsync(100)
      expect(mockedAxios.post).toHaveBeenCalledTimes(1)

      await jest.advanceTimersByTimeAsync(1000)
      expect(mockedAxios.post).toHaveBeenCalledTimes(2)

      await jest.advanceTimersByTimeAsync(2000)
      expect(mockedAxios.post).toHaveBeenCalledTimes(3)

      if (callTimes.length >= 2) {
        const delay1 = callTimes[1] - callTimes[0]
        const delay2 = callTimes[2] - callTimes[1]
        expect(delay2).toBeGreaterThan(delay1)
      }
    })
  })
})
