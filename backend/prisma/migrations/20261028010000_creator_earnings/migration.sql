-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'CANCELLED');

-- CreateTable
CREATE TABLE "OwnerPayment" (
    "id" TEXT NOT NULL,
    "paypalTransactionId" TEXT NOT NULL,
    "paypalSubscriptionId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "catId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalRequest" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OwnerPayment" ADD CONSTRAINT "OwnerPayment_positive_usd" CHECK ("amountCents" > 0 AND "currency" = 'USD');
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_positive_usd" CHECK ("amountCents" > 0 AND "currency" = 'USD');

-- CreateIndex
CREATE UNIQUE INDEX "OwnerPayment_paypalTransactionId_key" ON "OwnerPayment"("paypalTransactionId");

-- CreateIndex
CREATE INDEX "OwnerPayment_ownerId_paidAt_idx" ON "OwnerPayment"("ownerId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalRequest_requestId_key" ON "WithdrawalRequest"("requestId");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_ownerId_createdAt_idx" ON "WithdrawalRequest"("ownerId", "createdAt");

-- AddForeignKey
ALTER TABLE "OwnerPayment" ADD CONSTRAINT "OwnerPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerPayment" ADD CONSTRAINT "OwnerPayment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerPayment" ADD CONSTRAINT "OwnerPayment_catId_fkey" FOREIGN KEY ("catId") REFERENCES "Cat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
