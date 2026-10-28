import { SubscriptionStatus } from '@prisma/client';

export function hasPaidAccess(
  subscription:
    | {
        status: SubscriptionStatus;
        paidUntil: Date | null;
        giftUntil?: Date | null;
      }
    | null
    | undefined,
  now = new Date(),
) {
  return (
    !!subscription &&
    ((!!subscription.giftUntil && subscription.giftUntil > now) ||
      (['ACTIVE', 'CANCELLED'].includes(subscription.status) &&
        !!subscription.paidUntil &&
        subscription.paidUntil > now))
  );
}

export type PaypalDetails = {
  id: string;
  status: string;
  plan_id: string;
  custom_id: string;
  links?: { rel: string; href: string }[];
  billing_info?: {
    next_billing_time?: string;
    last_payment?: {
      time?: string;
      amount?: { value?: string; currency_code?: string };
    };
  };
};

export function verifiedSubscriptionState(
  details: PaypalDetails,
  expected: { paypalId: string; id: string; planId: string },
) {
  if (
    details.id !== expected.paypalId ||
    details.custom_id !== expected.id ||
    details.plan_id !== expected.planId
  ) {
    throw new Error('PayPal subscription identity mismatch');
  }
  const statuses: Record<string, SubscriptionStatus> = {
    ACTIVE: 'ACTIVE',
    CANCELLED: 'CANCELLED',
    SUSPENDED: 'SUSPENDED',
    EXPIRED: 'EXPIRED',
  };
  const status = statuses[details.status] || 'PENDING';
  const payment = details.billing_info?.last_payment;
  const next = details.billing_info?.next_billing_time;
  const paidUntil =
    payment?.time &&
    Number(payment.amount?.value) > 0 &&
    payment.amount?.currency_code === 'USD' &&
    next
      ? new Date(next)
      : null;
  return {
    status,
    paidUntil:
      paidUntil && Number.isFinite(paidUntil.getTime()) ? paidUntil : null,
  };
}
