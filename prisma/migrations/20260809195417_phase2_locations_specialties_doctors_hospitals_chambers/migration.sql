-- DropForeignKey
ALTER TABLE "chambers" DROP CONSTRAINT "chambers_hospitalId_fkey";

-- AlterTable
ALTER TABLE "appointments" ALTER COLUMN "appointmentNumber" SET DEFAULT 'APT-' || to_char(now(),'YYYY') || '-' || lpad(nextval('appointment_number_seq')::text, 6, '0'),
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "chambers" ALTER COLUMN "hospitalId" DROP NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "doctors" ADD COLUMN     "nameBn" VARCHAR(150),
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "hospitals" ADD COLUMN     "nameBn" VARCHAR(200),
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "patients" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "refresh_tokens" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "reviews" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "specialties" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "divisions" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "nameBn" VARCHAR(100),
    "slug" VARCHAR(120) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "divisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "nameBn" VARCHAR(100),
    "slug" VARCHAR(120) NOT NULL,
    "divisionId" BIGINT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "divisions_name_key" ON "divisions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "divisions_slug_key" ON "divisions"("slug");

-- CreateIndex
CREATE INDEX "divisions_slug_idx" ON "divisions"("slug");

-- CreateIndex
CREATE INDEX "divisions_isActive_idx" ON "divisions"("isActive");

-- CreateIndex
CREATE INDEX "districts_slug_idx" ON "districts"("slug");

-- CreateIndex
CREATE INDEX "districts_divisionId_idx" ON "districts"("divisionId");

-- CreateIndex
CREATE INDEX "districts_isActive_idx" ON "districts"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "districts_name_divisionId_key" ON "districts"("name", "divisionId");

-- CreateIndex
CREATE INDEX "chambers_district_idx" ON "chambers"("district");

-- CreateIndex
CREATE INDEX "specialties_isActive_idx" ON "specialties"("isActive");

-- CreateIndex
CREATE INDEX "specialties_order_idx" ON "specialties"("order");

-- CreateIndex
CREATE INDEX "specialties_deletedAt_idx" ON "specialties"("deletedAt");

-- AddForeignKey
ALTER TABLE "districts" ADD CONSTRAINT "districts_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "divisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chambers" ADD CONSTRAINT "chambers_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
