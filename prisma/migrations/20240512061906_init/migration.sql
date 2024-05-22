/*
  Warnings:

  - Added the required column `amount` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `signature` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "amount" TEXT NOT NULL,
ADD COLUMN     "signature" TEXT NOT NULL;
