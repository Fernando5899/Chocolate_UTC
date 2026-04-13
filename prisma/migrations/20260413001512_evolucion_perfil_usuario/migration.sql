-- AlterTable
ALTER TABLE "Orden" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ciudad" TEXT,
ADD COLUMN     "codigoPostal" TEXT,
ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "estado" TEXT,
ADD COLUMN     "telefono" TEXT;

-- AddForeignKey
ALTER TABLE "Orden" ADD CONSTRAINT "Orden_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
