-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "incidentId" TEXT,
ADD COLUMN     "subject" TEXT;

-- CreateIndex
CREATE INDEX "Conversation_incidentId_idx" ON "Conversation"("incidentId");
