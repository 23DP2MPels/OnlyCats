import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { PaypalService } from './paypal.service';
import { usdCents } from './money';
import { verifiedSubscriptionState, PaypalDetails } from './access';
import { config } from './config';

@Injectable()
export class EarningsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paypal: PaypalService,
  ) {}

  async syncPayments(
    sub: {
      id: string;
      paypalId: string | null;
      catId: string;
      createdAt: Date;
    },
    details: PaypalDetails,
  ) {
    if (!sub.paypalId) return;
    try {
      verifiedSubscriptionState(details, {
        id: sub.id,
        paypalId: sub.paypalId,
        planId: config.paypal.planId,
      });
    } catch {
      throw new BadRequestException('Данные подписки PayPal не совпали');
    }
    const transactions = await this.paypal.transactions(
      sub.paypalId,
      sub.createdAt,
    );
    const cat = await this.prisma.cat.findUniqueOrThrow({
      where: { id: sub.catId },
    });
    const rows = transactions
      .filter((payment) =>
        ['COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(
          payment.status,
        ),
      )
      .map((payment) => {
        try {
          const amount = payment.amount_with_breakdown.gross_amount;
          const paidAt = new Date(payment.time);
          if (
            !payment.id ||
            amount.currency_code !== 'USD' ||
            !Number.isFinite(paidAt.getTime())
          )
            throw new Error();
          return {
            paypalTransactionId: payment.id,
            paypalSubscriptionId: sub.paypalId!,
            subscriptionId: sub.id,
            ownerId: cat.ownerId,
            catId: cat.id,
            amountCents: usdCents(amount.value),
            currency: 'USD',
            status: payment.status,
            paidAt,
          };
        } catch {
          throw new ServiceUnavailableException(
            'Некорректная сумма платежа PayPal',
          );
        }
      });
    await this.prisma.$transaction(async (tx) => {
      await this.lockOwner(tx, cat.ownerId);
      for (const row of rows) {
        const existing = await tx.ownerPayment.findUnique({
          where: { paypalTransactionId: row.paypalTransactionId },
        });
        if (existing && existing.paypalSubscriptionId !== sub.paypalId)
          throw new ConflictException('Платёж уже связан с другой подпиской');
        if (existing && existing.amountCents !== row.amountCents)
          throw new ServiceUnavailableException(
            'Некорректная сумма платежа PayPal',
          );
        // A delayed response must not turn a known refund back into earnings.
        const status =
          existing?.status === 'REFUNDED' ||
          (existing?.status === 'PARTIALLY_REFUNDED' &&
            row.status === 'COMPLETED')
            ? existing.status
            : row.status;
        await tx.ownerPayment.upsert({
          where: { paypalTransactionId: row.paypalTransactionId },
          create: row,
          update: { status },
        });
      }
    });
  }

  async syncOwner(ownerId: string) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { cat: { ownerId }, paypalId: { not: null } },
    });
    for (const sub of subscriptions) {
      const details = await this.paypal.details(sub.paypalId!);
      await this.syncPayments(sub, details);
    }
    return this.summary(ownerId);
  }

  async transactions(userId: string) {
    const payments = await this.prisma.ownerPayment.findMany({
      where: { OR: [{ ownerId: userId }, { subscription: { userId } }] },
      select: {
        id: true,
        ownerId: true,
        amountCents: true,
        currency: true,
        status: true,
        paidAt: true,
        cat: { select: { name: true } },
      },
      orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    return payments.map(({ ownerId, ...payment }) => ({
      ...payment,
      direction: ownerId === userId ? 'INCOME' : 'EXPENSE',
    }));
  }

  async syncTransactions(userId: string) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        paypalId: { not: null },
        OR: [{ userId }, { cat: { ownerId: userId } }],
      },
    });
    for (const sub of subscriptions) {
      await this.syncPayments(sub, await this.paypal.details(sub.paypalId!));
    }
    return this.transactions(userId);
  }

  private async lockOwner(tx: Prisma.TransactionClient, ownerId: string) {
    // Serialize reservations and payment updates for one owner across API instances.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ownerId}, 0))::text`;
  }

  private async balances(tx: Prisma.TransactionClient, ownerId: string) {
    const [payments, requests] = await Promise.all([
      tx.ownerPayment.aggregate({
        where: { ownerId, status: 'COMPLETED', currency: 'USD' },
        _sum: { amountCents: true },
      }),
      tx.withdrawalRequest.aggregate({
        where: { ownerId, status: 'PENDING', currency: 'USD' },
        _sum: { amountCents: true },
      }),
    ]);
    const receivedCents = payments._sum.amountCents || 0;
    const reservedCents = requests._sum.amountCents || 0;
    return {
      receivedCents,
      reservedCents,
      availableCents: Math.max(0, receivedCents - reservedCents),
    };
  }

  async summary(ownerId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOwner(tx, ownerId);
      const balances = await this.balances(tx, ownerId);
      const [payments, withdrawals] = await Promise.all([
        tx.ownerPayment.findMany({
          where: { ownerId },
          select: {
            id: true,
            amountCents: true,
            status: true,
            paidAt: true,
            cat: { select: { name: true } },
          },
          orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
          take: 50,
        }),
        tx.withdrawalRequest.findMany({
          where: { ownerId },
          select: {
            id: true,
            amountCents: true,
            status: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 50,
        }),
      ]);
      return {
        ...balances,
        currency: 'USD',
        sandbox: true,
        payoutsEnabled: false,
        payments,
        withdrawals,
      };
    });
  }

  async requestWithdrawal(ownerId: string, amount: string, requestId: string) {
    let amountCents: number;
    try {
      amountCents = usdCents(amount);
    } catch {
      throw new BadRequestException(
        'Укажите положительную сумму в USD с точностью до цента',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      await this.lockOwner(tx, ownerId);
      const existing = await tx.withdrawalRequest.findUnique({
        where: { requestId },
      });
      if (existing) {
        if (
          existing.ownerId !== ownerId ||
          existing.amountCents !== amountCents
        )
          throw new ConflictException(
            'Запрос с таким идентификатором уже существует',
          );
        return {
          id: existing.id,
          status: existing.status,
          amountCents: existing.amountCents,
        };
      }
      const balance = await this.balances(tx, ownerId);
      if (amountCents > balance.availableCents)
        throw new BadRequestException('Сумма превышает доступный остаток');
      return tx.withdrawalRequest.create({
        data: { ownerId, amountCents, requestId },
        select: { id: true, status: true, amountCents: true },
      });
    });
  }

  async cancelWithdrawal(ownerId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOwner(tx, ownerId);
      const request = await tx.withdrawalRequest.findFirst({
        where: { id, ownerId },
      });
      if (!request) throw new NotFoundException('Заявка не найдена');
      return tx.withdrawalRequest.update({
        where: { id },
        data: { status: 'CANCELLED' },
        select: { id: true, status: true },
      });
    });
  }
}
