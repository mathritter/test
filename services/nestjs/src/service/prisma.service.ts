import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

/**
 * PrismaService provides database access through Prisma Client.
 * It extends PrismaClient and implements NestJS lifecycle hooks to ensure
 * proper connection management during module initialization and destruction.
 *
 * @example
 * ```typescript
 * constructor(private readonly prisma: PrismaService) {}
 *
 * async findUser(id: string) {
 *   return this.prisma.user.findUnique({ where: { id } })
 * }
 * ```
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /**
   * Connects to the database when the module is initialized.
   * This ensures the Prisma Client is ready before any database operations are performed.
   */
  async onModuleInit() {
    await this.$connect()
  }

  /**
   * Disconnects from the database when the module is destroyed.
   * This ensures proper cleanup and prevents connection leaks when the application shuts down.
   */
  async onModuleDestroy() {
    await this.$disconnect()
  }
}

