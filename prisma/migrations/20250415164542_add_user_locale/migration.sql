/*
  Warnings:

  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/

ALTER TABLE "users" ADD COLUMN "locale" TEXT;
