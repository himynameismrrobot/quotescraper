-- CreateTable
CREATE TABLE "CommentReaction" (
    "id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommentReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UserCommentReactions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CommentReaction_commentId_emoji_key" ON "CommentReaction"("commentId", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "_UserCommentReactions_AB_unique" ON "_UserCommentReactions"("A", "B");

-- CreateIndex
CREATE INDEX "_UserCommentReactions_B_index" ON "_UserCommentReactions"("B");

-- AddForeignKey
ALTER TABLE "CommentReaction" ADD CONSTRAINT "CommentReaction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserCommentReactions" ADD CONSTRAINT "_UserCommentReactions_A_fkey" FOREIGN KEY ("A") REFERENCES "CommentReaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserCommentReactions" ADD CONSTRAINT "_UserCommentReactions_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
