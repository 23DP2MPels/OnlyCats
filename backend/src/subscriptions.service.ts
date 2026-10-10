import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from './prisma.service';
import { PaypalService } from './paypal.service';
import { config } from './config';
import { hasPaidAccess, verifiedSubscriptionState } from './access';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paypal: PaypalService,
  ) {}

  async checkout(userId: string, catId: string) {
    const cat = await this.prisma.cat.findUnique({ where: { id: catId } });
    if (!cat) throw new NotFoundException('Кот не найден');
    if (cat.ownerId === userId)
      throw new BadRequestException('Ваши публикации уже доступны вам');
    let sub = await this.prisma.subscription.upsert({
      where: { userId_catId: { userId, catId } },
      create: { userId, catId },
      update: {},
    });
    if (hasPaidAccess(sub))
      throw new BadRequestException('Подписка уже активна');
    if (sub.paypalId) {
      const remote = await this.paypal.details(sub.paypalId);
      if (remote.status === 'ACTIVE') {
        const updated = await this.sync(sub.id);
        return { activated: hasPaidAccess(updated) };
      }
      if (
        remote.status === 'APPROVAL_PENDING' ||
        remote.status === 'APPROVED'
      ) {
        const approval = remote.links?.find(
          (link) => link.rel === 'approve',
        )?.href;
        if (!approval)
          throw new BadRequestException(
            'Подтверждение PayPal ещё обрабатывается. Обновите статус в кабинете',
          );
        this.validateApproval(approval);
        return { approvalUrl: approval, id: sub.id };
      } else if (['CANCELLED', 'EXPIRED'].includes(remote.status)) {
        const reset = await this.prisma.subscription.updateMany({
          where: { id: sub.id, updatedAt: sub.updatedAt },
          data: {
            paypalId: null,
            status: 'PENDING',
            paidUntil: null,
            checkoutKey: randomUUID(),
          },
        });
        if (!reset.count)
          throw new BadRequestException(
            'Подписка уже обновляется. Попробуйте ещё раз',
          );
        sub = (await this.prisma.subscription.findUnique({
          where: { id: sub.id },
        }))!;
      } else {
        throw new BadRequestException(
          'Сначала отмените прежнюю подписку в личном кабинете',
        );
      }
    }
    const result = await this.paypal.createSubscription(
      sub.id,
      sub.checkoutKey,
    );
    const approval = result.links.find((link) => link.rel === 'approve')?.href;
    this.validateApproval(approval);
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { paypalId: result.id },
    });
    return { approvalUrl: approval, id: sub.id };
  }

  private validateApproval(approval: string | undefined) {
    try {
      const url = new URL(approval || '');
      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'www.sandbox.paypal.com'
      )
        throw new Error();
    } catch {
      throw new BadRequestException('Некорректная ссылка PayPal Sandbox');
    }
  }

  async sync(id: string, userId?: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub || !sub.paypalId)
      throw new NotFoundException('Подписка не найдена');
    if (userId && sub.userId !== userId) throw new ForbiddenException();
    const details = await this.paypal.details(sub.paypalId);
    let state;
    try {
      state = verifiedSubscriptionState(details, {
        id: sub.id,
        paypalId: sub.paypalId,
        planId: config.paypal.planId,
      });
    } catch {
      throw new BadRequestException('Данные подписки PayPal не совпали');
    }
    // Optimistic concurrency prevents a delayed sync overwriting a concurrent cancellation.
    await this.prisma.subscription.updateMany({
      where: { id, updatedAt: sub.updatedAt },
      data: state,
    });
    return this.prisma.subscription.findUnique({
      where: { id },
      include: { cat: true },
    });
  }

  async confirm(userId: string, paypalId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { paypalId },
    });
    if (!sub || sub.userId !== userId)
      throw new NotFoundException('Подписка не найдена');
    return this.sync(sub.id, userId);
  }

  async cancel(userId: string, id: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub || sub.userId !== userId)
      throw new NotFoundException('Подписка не найдена');
    if (sub.status === 'CANCELLED') return sub;
    if (sub.paypalId) {
      const remote = await this.paypal.details(sub.paypalId);
      if (!['CANCELLED', 'EXPIRED'].includes(remote.status))
        await this.paypal.cancel(sub.paypalId);
    }
    return this.prisma.subscription.update({
      where: { id },
      data: { status: 'CANCELLED', paidUntil: null },
    });
  }

  async webhook(
    headers: Record<string, string | string[] | undefined>,
    event: {
      id?: string;
      event_type?: string;
      resource?: { id?: string; billing_agreement_id?: string };
    },
  ) {
    if (!(await this.paypal.verifyWebhook(headers, event)))
      throw new BadRequestException('Invalid PayPal signature');
    if (!event.id) throw new BadRequestException('Missing event id');
    if (await this.prisma.webhookEvent.findUnique({ where: { id: event.id } }))
      return { received: true };
    const paypalId = event.event_type?.startsWith('BILLING.SUBSCRIPTION.')
      ? event.resource?.id
      : event.resource?.billing_agreement_id;
    if (paypalId) {
      const sub = await this.prisma.subscription.findUnique({
        where: { paypalId },
      });
      if (sub) await this.sync(sub.id);
    }
    try {
      await this.prisma.webhookEvent.create({ data: { id: event.id } });
    } catch (error) {
      if (!(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ))
        throw error;
    }
    return { received: true };
  }
}
