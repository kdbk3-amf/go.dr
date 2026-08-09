-- AlterTable: make doctor qualification optional (required for
-- doctor registration where qualification is collected later).
ALTER TABLE "doctors" ALTER COLUMN "qualification" DROP NOT NULL;

