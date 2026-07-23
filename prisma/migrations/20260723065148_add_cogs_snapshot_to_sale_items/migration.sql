-- AlterTable
ALTER TABLE "sales_order_items" ADD COLUMN     "cogs_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "unit_cost_at_sale" DECIMAL(12,2) NOT NULL DEFAULT 0;
