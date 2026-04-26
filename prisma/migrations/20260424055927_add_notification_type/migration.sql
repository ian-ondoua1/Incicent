-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INCIDENT_CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'SLA_BREACH', 'COMMENT_ADDED');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "type" "NotificationType" NOT NULL DEFAULT 'INCIDENT_CREATED';

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");
