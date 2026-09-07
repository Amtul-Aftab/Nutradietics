-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_intakeId_fkey";

-- AlterTable
ALTER TABLE "Appointment" ALTER COLUMN "intakeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "Intake"("id") ON DELETE SET NULL ON UPDATE CASCADE;
