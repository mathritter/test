import { Module } from '@nestjs/common'
import { AiController } from './controller/ai.controller'
import { AiService } from './service/ai.service'
import { RetryService } from './service/retry.service'
import { PrismaModule } from './prisma.module'

@Module({
  controllers: [AiController],
  providers: [AiService, RetryService],
  imports: [PrismaModule],
})
export class AppModule {}
