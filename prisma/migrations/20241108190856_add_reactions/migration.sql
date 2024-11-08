-- CreateTable
CREATE TABLE "QuoteReaction" (
    "id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_QuoteReactionToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "QuoteReaction_quoteId_emoji_key" ON "QuoteReaction"("quoteId", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "_QuoteReactionToUser_AB_unique" ON "_QuoteReactionToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_QuoteReactionToUser_B_index" ON "_QuoteReactionToUser"("B");

-- AddForeignKey
ALTER TABLE "QuoteReaction" ADD CONSTRAINT "QuoteReaction_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "SavedQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_QuoteReactionToUser" ADD CONSTRAINT "_QuoteReactionToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "QuoteReaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_QuoteReactionToUser" ADD CONSTRAINT "_QuoteReactionToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
