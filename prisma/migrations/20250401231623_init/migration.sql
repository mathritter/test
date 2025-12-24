-- CreateEnum
CREATE TYPE "core_models" AS ENUM ('SD', 'SDXL');

-- CreateTable
CREATE TABLE "generations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "generationId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "public" BOOLEAN NOT NULL DEFAULT true,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "nsfw" BOOLEAN NOT NULL DEFAULT false,
    "coreModel" "core_models" NOT NULL DEFAULT 'SD',
    "imageHeight" INTEGER NOT NULL,
    "imageWidth" INTEGER NOT NULL,
    "prompt" VARCHAR(1500) NOT NULL,

    CONSTRAINT "generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "generations_generationId_key" ON "generations"("generationId");
