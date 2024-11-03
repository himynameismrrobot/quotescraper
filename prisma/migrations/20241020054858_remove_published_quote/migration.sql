/*
  Warnings:

  - You are about to drop the `PublishedQuote` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `Speaker` will be added. If there are existing duplicate values, this will fail.

*/
-- DropTable
DROP TABLE "PublishedQuote";

-- CreateTable
CREATE TABLE "SavedQuote" (
    "id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "rawQuoteText" TEXT NOT NULL,
    "articleDate" TIMESTAMP(3) NOT NULL,
    "articleUrl" TEXT NOT NULL,
    "speakerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Speaker_name_key" ON "Speaker"("name");

-- AddForeignKey
ALTER TABLE "SavedQuote" ADD CONSTRAINT "SavedQuote_speakerId_fkey" FOREIGN KEY ("speakerId") REFERENCES "Speaker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
