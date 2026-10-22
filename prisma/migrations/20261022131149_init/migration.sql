-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "AssignmentMode" AS ENUM ('FIXED', 'ROTATING');

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chore" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "startDate" DATE NOT NULL,
    "startTime" TEXT,
    "durationMin" INTEGER,
    "freq" "Frequency" NOT NULL DEFAULT 'NONE',
    "interval" INTEGER NOT NULL DEFAULT 1,
    "byWeekday" INTEGER[],
    "untilDate" DATE,
    "assignmentMode" "AssignmentMode" NOT NULL DEFAULT 'FIXED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChoreAssignee" (
    "choreId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ChoreAssignee_pkey" PRIMARY KEY ("choreId","memberId")
);

-- CreateTable
CREATE TABLE "OccurrenceOverride" (
    "id" TEXT NOT NULL,
    "choreId" TEXT NOT NULL,
    "originalDate" DATE NOT NULL,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "overrideDate" DATE,
    "overrideMemberId" TEXT,
    "doneAt" TIMESTAMP(3),
    "doneAssigneeId" TEXT,

    CONSTRAINT "OccurrenceOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OccurrenceOverride_choreId_originalDate_key" ON "OccurrenceOverride"("choreId", "originalDate");

-- AddForeignKey
ALTER TABLE "ChoreAssignee" ADD CONSTRAINT "ChoreAssignee_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreAssignee" ADD CONSTRAINT "ChoreAssignee_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccurrenceOverride" ADD CONSTRAINT "OccurrenceOverride_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
