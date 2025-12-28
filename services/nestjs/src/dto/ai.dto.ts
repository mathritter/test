import { ApiProperty } from '@nestjs/swagger'

export class AiRequestDto {
  @ApiProperty({
    description: 'The text prompt for image generation',
    example: 'A beautiful sunset over a calm ocean',
  })
  prompt: string
}
