import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { config } from './config';
import { PaypalDetails } from './access';

export type PaypalTransaction = {
  id: string;
  status: string;
  time: string;
  amount_with_breakdown: {
    gross_amount: { value: string; currency_code: string };
  };
};

@Injectable()
export class PaypalService {
  private token?: { value: string; expires: number };
  get configured() {
    return !!(
      config.paypal.clientId &&
      config.paypal.clientSecret &&
      config.paypal.planId
    );
  }

  private async accessToken() {
    if (!config.paypal.clientId || !config.paypal.clientSecret)
      throw new ServiceUnavailableException('PayPal Sandbox ещё не настроен');
    if (this.token && this.token.expires > Date.now()) return this.token.value;
    try {
      const response = await fetch(`${config.paypal.baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.paypal.clientId}:${config.paypal.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
      if (!response.ok) throw new Error('OAuth failed');
      const data = (await response.json()) as {
        access_token: string;
        expires_in: number;
      };
      this.token = {
        value: data.access_token,
        expires: Date.now() + (data.expires_in - 60) * 1000,
      };
      return data.access_token;
    } catch {
      throw new ServiceUnavailableException(
        'Не удалось подключиться к PayPal Sandbox',
      );
    }
  }

  async request<T = Record<string, unknown>>(
    path: string,
    method = 'GET',
    body?: unknown,
    requestId?: string,
  ): Promise<T> {
    const token = await this.accessToken();
    try {
      const response = await fetch(`${config.paypal.baseUrl}${path}`, {
        method,
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
          ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (response.status === 401) this.token = undefined;
      if (!response.ok) throw new Error(`PayPal ${response.status}`);
      return response.status === 204
        ? ({} as T)
        : ((await response.json()) as T);
    } catch {
      throw new ServiceUnavailableException(
        'PayPal Sandbox недоступен. Попробуйте позже',
      );
    }
  }

  createSubscription(id: string, requestId: string) {
    if (!this.configured)
      throw new ServiceUnavailableException('PayPal Sandbox ещё не настроен');
    return this.request<{ id: string; links: { rel: string; href: string }[] }>(
      '/v1/billing/subscriptions',
      'POST',
      {
        plan_id: config.paypal.planId,
        custom_id: id,
        application_context: {
          brand_name: 'OnlyCats Sandbox',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: `${config.frontendUrl}/payment/return`,
          cancel_url: `${config.frontendUrl}/account?payment=cancelled`,
        },
      },
      requestId,
    );
  }
  details(id: string) {
    return this.request<PaypalDetails>(
      `/v1/billing/subscriptions/${encodeURIComponent(id)}`,
    );
  }
  async transactions(id: string, since: Date) {
    const transactions: PaypalTransaction[] = [];
    const end = Date.now();
    // Small date windows also support subscriptions older than six months.
    for (let start = since.getTime() - 1000; start < end;) {
      const stop = Math.min(start + 180 * 86400000, end);
      const query = new URLSearchParams({
        start_time: new Date(start).toISOString(),
        end_time: new Date(stop).toISOString(),
      });
      const endpoint = `/v1/billing/subscriptions/${encodeURIComponent(id)}/transactions`;
      let path: string | undefined = `${endpoint}?${query}`;
      const seen = new Set<string>();
      while (path) {
        if (seen.has(path) || seen.size >= 100)
          throw new ServiceUnavailableException(
            'Не удалось загрузить историю PayPal',
          );
        seen.add(path);
        const page: {
          transactions: PaypalTransaction[];
          links?: { rel: string; href: string }[];
        } = await this.request(path);
        if (!Array.isArray(page.transactions))
          throw new ServiceUnavailableException(
            'Не удалось загрузить историю PayPal',
          );
        transactions.push(...page.transactions);
        const next = page.links?.find((link) => link.rel === 'next');
        path = undefined;
        if (next) {
          const url = new URL(next.href, config.paypal.baseUrl + '/');
          const expected = new URL(`${config.paypal.baseUrl}${endpoint}`);
          if (
            url.origin !== expected.origin ||
            url.pathname !== expected.pathname
          )
            throw new ServiceUnavailableException(
              'Некорректная страница PayPal',
            );
          path = endpoint + url.search;
        }
      }
      start = stop;
    }
    return transactions;
  }

  cancel(id: string) {
    return this.request(
      `/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`,
      'POST',
      { reason: 'Cancelled by OnlyCats subscriber' },
    );
  }

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    event: unknown,
  ) {
    if (!config.paypal.webhookId)
      throw new ServiceUnavailableException(
        'PAYPAL_WEBHOOK_ID is not configured',
      );
    const result = await this.request<{ verification_status: string }>(
      '/v1/notifications/verify-webhook-signature',
      'POST',
      {
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: config.paypal.webhookId,
        webhook_event: event,
      },
    );
    return result.verification_status === 'SUCCESS';
  }
}
