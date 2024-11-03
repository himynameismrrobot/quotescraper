-- CreateTable
CREATE TABLE "PublishedQuote" (
    "id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "rawQuoteText" TEXT NOT NULL,
    "speakerName" TEXT NOT NULL,
    "articleDate" TIMESTAMP(3) NOT NULL,
    "articleUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishedQuote_pkey" PRIMARY KEY ("id")
);
