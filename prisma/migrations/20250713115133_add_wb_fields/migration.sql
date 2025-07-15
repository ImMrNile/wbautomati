-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'PUBLISHING', 'PUBLISHED', 'ERROR');

-- CreateTable
CREATE TABLE "wb_cabinets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiToken" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wb_cabinets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "generatedName" TEXT,
    "originalImage" TEXT NOT NULL,
    "dimensions" JSONB NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "referenceUrl" TEXT,
    "referenceData" JSONB,
    "suggestedCategory" TEXT,
    "colorAnalysis" TEXT,
    "seoDescription" TEXT,
    "aiCharacteristics" JSONB,
    "status" "ProductStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "wbNmId" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "wbData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_cabinets" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "cabinetId" TEXT NOT NULL,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "wbCardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_cabinets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wbId" INTEGER NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wb_cabinets_name_key" ON "wb_cabinets"("name");

-- CreateIndex
CREATE UNIQUE INDEX "product_cabinets_productId_cabinetId_key" ON "product_cabinets"("productId", "cabinetId");

-- AddForeignKey
ALTER TABLE "product_cabinets" ADD CONSTRAINT "product_cabinets_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_cabinets" ADD CONSTRAINT "product_cabinets_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "wb_cabinets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
