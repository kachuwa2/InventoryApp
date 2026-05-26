/*
  Warnings:

  - A unique constraint covering the columns `[invoice_number]` on the table `sales_orders` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "invoice_number" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_invoice_number_key" ON "sales_orders"("invoice_number");
