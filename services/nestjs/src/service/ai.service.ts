import { Injectable, OnModuleDestroy, NotFoundException } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import axios from 'axios'
import { GenerationStatus } from '../constants/generation-status.enum'

@Injectable()
export class AiService implements OnModuleDestroy {
  private readonly mockAiUrl = 'http://mock-ai:3001'

  constructor(private readonly prisma: PrismaClient) {}

  async onModuleDestroy() {
    await this.prisma.$disconnect()
  }

  private async updateGenerationStatus(generationId: string, status: GenerationStatus, imageUrl?: string) {
    await this.prisma.generations.update({
      where: { generationId },
      data: { generationStatus: status, imageUrl },
    })
  }

  private async processImageGeneration(prompt: string, generationId: string) {
    try {
      console.log('processImageGeneration for prompt', prompt)
      console.log('processImageGeneration for generationId', generationId)
      console.log(`${this.mockAiUrl}/generate`)
      const response = await axios.post(`${this.mockAiUrl}/generate`, { prompt, generationId })
      console.log('response in NestJS service new', response.data.imageUrl)
      return response.data.imageUrl
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
          const imageUrl = await this.processImageGeneration(prompt, generationId)
          // Update the generation status to complete
          await this.updateGenerationStatus(generationId, GenerationStatus.COMPLETE, imageUrl)
        } catch (error) {
          console.error('Background processing failed:', error)
          // Update the generation status to failed
          await this.updateGenerationStatus(generationId, GenerationStatus.FAILED)
        }
      })

      // Return the generationId immediately
      return { generationId }
    } catch (error) {
      throw new Error(`Failed to initiate image generation: ${error}`)
    }
  }

  async findGenerationById(id: string) {
    console.log('findGenerationById for id', id)
    try {
      const generations = await this.prisma.generations.findUnique({
        select: {
          generationStatus: true,
          prompt: true,
          imageUrl: true,
        },
        where: { generationId: id },
      })

      if (!generations) {
        throw new NotFoundException(`Data not found`)
      }

      // won't return imageUrl if generation is not complete
      if (generations.generationStatus !== GenerationStatus.COMPLETE) {
        delete generations.imageUrl
      }

      return generations
    } catch (error) {
      console.error('Error in findGenerationById:', error)
      throw new NotFoundException(`Data not found`)
    }
  }
}
