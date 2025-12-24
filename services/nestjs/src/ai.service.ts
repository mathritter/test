import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import axios from 'axios'

@Injectable()
export class AiService implements OnModuleDestroy {
  private prisma: PrismaClient
  private readonly mockAiUrl = 'http://mock-ai:3001'

  constructor() {
    this.prisma = new PrismaClient()
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect()
  }

  private async processImageGeneration(prompt: string, generationId: string) {
    try {
      console.log('processImageGeneration for prompt', prompt)
      console.log('processImageGeneration for generationId', generationId)
      console.log(`${this.mockAiUrl}/generate`)
      const response = await axios.post(`${this.mockAiUrl}/generate`, { prompt, generationId })
      console.log('response in NestJS service', response)
      return response.data
    } catch (error) {
      console.error('Error in processImageGeneration:', error)
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
        })
      }
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          response: error.response?.data,
          status: error.response?.status,
          headers: error.response?.headers,
        })
      }
      // Update the generation status to failed
      await this.prisma.generations.update({
        where: { generationId },
        data: {
          updatedAt: new Date(),
        },
      })
      throw error // Re-throw the error to be caught by the caller
    }
  }

  async generateImage(prompt: string) {
    try {
      const generation = await this.prisma.generations.create({
        data: {
          prompt,
          imageHeight: 1024,
          imageWidth: 1024,
          coreModel: 'SDXL',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })

      const generationId = generation.generationId
      console.log('generationId', generationId)

      // Start the image generation process in the background
      // Using Promise.resolve().then() to ensure it runs in the next tick
      Promise.resolve().then(async () => {
        try {
          await this.processImageGeneration(prompt, generationId)
        } catch (error) {
          console.error('Background processing failed:', error)

          await this.prisma.generations.update({
            where: { generationId },
            data: {
              updatedAt: new Date(),
            },
          })
        }
      })

      // Return the generationId immediately
      return { generationId }
    } catch (error) {
      throw new Error(`Failed to initiate image generation: ${error}`)
    }
  }
}
