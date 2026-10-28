ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;
UPDATE "User" SET "isAdmin" = true WHERE "role" = 'ADMIN';
ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "Role";
