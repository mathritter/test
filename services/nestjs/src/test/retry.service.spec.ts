import { Test, TestingModule } from '@nestjs/testing'
import { RetryService } from '../service/retry.service'

describe('RetryService', () => {
  let service: RetryService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RetryService],
    }).compile()

    service = module.get<RetryService>(RetryService)
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
  })

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue('success')

      const result = await service.executeWithRetry(mockFn)

      expect(result.success).toBe(true)
      expect(result.result).toBe('success')
      expect(result.attempts).toBe(1)
      expect(result.errors).toBeUndefined()
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure and succeed on second attempt', async () => {
      jest.useFakeTimers()
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce('success')

      const promise = service.executeWithRetry(mockFn, {
        maxAttempts: 3,
        initialDelayMs: 1000,
      })

      await jest.advanceTimersByTimeAsync(1000)
      const result = await promise

      expect(result.success).toBe(true)
      expect(result.result).toBe('success')
      expect(result.attempts).toBe(2)
      expect(result.errors).toHaveLength(1)
      expect(result.errors![0].attempt).toBe(1)
      expect(result.errors![0].error).toBe('First attempt failed')
      expect(mockFn).toHaveBeenCalledTimes(2)
    })

    it('should fail after max attempts', async () => {
      jest.useFakeTimers()
      const error = new Error('Always fails')
      const mockFn = jest.fn().mockRejectedValue(error)

      const promise = service.executeWithRetry(mockFn, {
        maxAttempts: 3,
        initialDelayMs: 100,
      })

      await jest.advanceTimersByTimeAsync(500)
      const result = await promise

      expect(result.success).toBe(false)
      expect(result.result).toBeUndefined()
      expect(result.attempts).toBe(3)
      expect(result.lastError).toBe(error)
      expect(result.errors).toHaveLength(3)
      expect(mockFn).toHaveBeenCalledTimes(3)
    })

    it('should apply exponential backoff', async () => {
      jest.useFakeTimers()
      const mockFn = jest.fn().mockRejectedValue(new Error('Failed'))

      const promise = service.executeWithRetry(mockFn, {
        maxAttempts: 3,
        initialDelayMs: 1000,
        backoffMultiplier: 2,
      })

      let callCount = 0
      const callTimes: number[] = []

      const originalCall = mockFn.mockImplementation(async () => {
        callTimes.push(Date.now())
        callCount++
        throw new Error('Failed')
      })

      await jest.advanceTimersByTimeAsync(100)
      expect(mockFn).toHaveBeenCalledTimes(1)

      await jest.advanceTimersByTimeAsync(1000)
      expect(mockFn).toHaveBeenCalledTimes(2)

      await jest.advanceTimersByTimeAsync(2000)
      expect(mockFn).toHaveBeenCalledTimes(3)

      await promise
    })

    it('should respect maxDelayMs', async () => {
      jest.useFakeTimers()
      const mockFn = jest.fn().mockRejectedValue(new Error('Failed'))

      const promise = service.executeWithRetry(mockFn, {
        maxAttempts: 4,
        initialDelayMs: 1000,
        maxDelayMs: 2000,
        backoffMultiplier: 2,
      })

      await jest.advanceTimersByTimeAsync(100)
      expect(mockFn).toHaveBeenCalledTimes(1)

      await jest.advanceTimersByTimeAsync(1000)
      expect(mockFn).toHaveBeenCalledTimes(2)

      await jest.advanceTimersByTimeAsync(2000)
      expect(mockFn).toHaveBeenCalledTimes(3)

      await jest.advanceTimersByTimeAsync(2000)
      expect(mockFn).toHaveBeenCalledTimes(4)

      await promise
    })

    it('should track errors with timestamps', async () => {
      jest.useFakeTimers()
      const error1 = new Error('Error 1')
      const error2 = new Error('Error 2')
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockResolvedValueOnce('success')

      const promise = service.executeWithRetry(mockFn, {
        maxAttempts: 3,
        initialDelayMs: 100,
      })

      await jest.advanceTimersByTimeAsync(300)
      const result = await promise

      expect(result.success).toBe(true)
      expect(result.errors).toHaveLength(2)
      expect(result.errors![0].error).toBe('Error 1')
      expect(result.errors![1].error).toBe('Error 2')
      expect(result.errors![0].timestamp).toBeDefined()
      expect(result.errors![1].timestamp).toBeDefined()
    })

    it('should handle non-Error objects', async () => {
      jest.useFakeTimers()
      const mockFn = jest.fn().mockRejectedValueOnce('String error').mockResolvedValueOnce('success')

      const promise = service.executeWithRetry(mockFn, {
        maxAttempts: 3,
        initialDelayMs: 100,
      })

      await jest.advanceTimersByTimeAsync(200)
      const result = await promise

      expect(result.success).toBe(true)
      expect(result.errors).toHaveLength(1)
      expect(result.errors![0].error).toBe('String error')
    })

    it('should use custom retry configuration', async () => {
      jest.useFakeTimers()
      const mockFn = jest.fn().mockRejectedValue(new Error('Failed'))

      const promise = service.executeWithRetry(mockFn, {
        maxAttempts: 2,
        initialDelayMs: 500,
        maxDelayMs: 1000,
        backoffMultiplier: 1.5,
      })

      await jest.advanceTimersByTimeAsync(100)
      expect(mockFn).toHaveBeenCalledTimes(1)

      await jest.advanceTimersByTimeAsync(500)
      expect(mockFn).toHaveBeenCalledTimes(2)

      const result = await promise

      expect(result.success).toBe(false)
      expect(result.attempts).toBe(2)
    })

    it('should not retry on 4xx errors (except 408, 429)', async () => {
      jest.useFakeTimers()
      const axiosError = {
        response: { status: 400 },
      }

      const mockFn = jest.fn().mockRejectedValue(axiosError)

      const promise = service.executeWithRetry(mockFn, {
        maxAttempts: 3,
        initialDelayMs: 100,
      })

      await jest.advanceTimersByTimeAsync(200)
      const result = await promise

      expect(result.success).toBe(false)
      expect(result.attempts).toBeDefined()
      expect(result.attempts).toBeGreaterThan(0)
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should retry on 408 (Request Timeout)', async () => {
      jest.useFakeTimers()
      const axiosError = {
        response: { status: 408 },
      }

      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(axiosError)
        .mockResolvedValueOnce('success')

      const promise = service.executeWithRetry(mockFn, {
        maxAttempts: 3,
        initialDelayMs: 100,
      })

      await jest.advanceTimersByTimeAsync(200)
      const result = await promise

      expect(result.success).toBe(true)
      expect(result.attempts).toBe(2)
      expect(mockFn).toHaveBeenCalledTimes(2)
    })

    it('should retry on 429 (Too Many Requests)', async () => {
      jest.useFakeTimers()
      const axiosError = {
        response: { status: 429 },
      }

      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(axiosError)
        .mockResolvedValueOnce('success')

      const promise = service.executeWithRetry(mockFn, {
        maxAttempts: 3,
        initialDelayMs: 100,
      })

      await jest.advanceTimersByTimeAsync(200)
      const result = await promise

      expect(result.success).toBe(true)
      expect(result.attempts).toBe(2)
      expect(mockFn).toHaveBeenCalledTimes(2)
    })

    it('should retry on 5xx errors', async () => {
      jest.useFakeTimers()
      const axiosError = {
        response: { status: 500 },
      }

      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(axiosError)
        .mockResolvedValueOnce('success')

      const promise = service.executeWithRetry(mockFn, {
        maxAttempts: 3,
        initialDelayMs: 100,
      })

      await jest.advanceTimersByTimeAsync(200)
      const result = await promise

      expect(result.success).toBe(true)
      expect(result.attempts).toBe(2)
      expect(mockFn).toHaveBeenCalledTimes(2)
    })
  })
})

