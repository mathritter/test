import { Controller, Post, Body } from '@nestjs/common'
import { AiService } from './ai.service'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { AiRequestDto } from './ai.dto'

@ApiTags('images')
@Controller('api/generation')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post()
  @ApiOperation({ summary: 'Generate images based on a text prompt' })
  @ApiResponse({
    status: 200,
    description: 'The image generation request has been accepted',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async generateImage(@Body() aiRequest: AiRequestDto) {
    const generation = await this.aiService.generateImage(aiRequest.prompt)
    return generation
  }
}
