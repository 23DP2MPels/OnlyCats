// Fixtures follow https://developer.paypal.com/docs/api/subscriptions/v1/
// Local simulation only; never communicates with PayPal.
const http = require('http');
http
  .createServer(async (req, res) => {
    const path = req.url.split('?')[0];
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(body === undefined ? undefined : JSON.stringify(body));
    };
    const records = (await pm.state.get('paypal.subscriptions')) || {};
    const keys = (await pm.state.get('paypal.idempotency')) || {};
    const payments = (await pm.state.get('paypal.transactions')) || {};
    const failures = (await pm.state.get('paypal.transactionFailures')) || {};
    const body = req.body || {};
    if (req.method === 'POST' && path === '/v1/oauth2/token')
      return send(200, {
        access_token: 'simulation-token',
        token_type: 'Bearer',
        expires_in: 3600,
      });
    if (req.method === 'POST' && path === '/v1/billing/subscriptions') {
      if (
        body.plan_id !== 'P-SIMULATION' ||
        !body.custom_id ||
        !body.application_context?.return_url
      )
        return send(400, { name: 'INVALID_REQUEST' });
      const key = req.headers['paypal-request-id'];
      if (!key) return send(400, { name: 'INVALID_REQUEST' });
      if (keys[key]) return send(201, records[keys[key]]);
      const id = `I-SIM${Object.keys(records).length + 1}`;
      records[id] = {
        id,
        status: 'APPROVAL_PENDING',
        plan_id: body.plan_id,
        custom_id: body.custom_id,
        links: [
          {
            rel: 'approve',
            href: `https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=${id}`,
          },
        ],
      };
      keys[key] = id;
      await pm.state.set('paypal.subscriptions', records);
      await pm.state.set('paypal.idempotency', keys);
      return send(201, records[id]);
    }
    const transactionMatch =
      /^\/v1\/billing\/subscriptions\/([^/]+)\/transactions$/.exec(path);
    if (req.method === 'GET' && transactionMatch) {
      const id = transactionMatch[1];
      if (!records[id]) return send(404, { name: 'RESOURCE_NOT_FOUND' });
      if (failures[id]) return send(503, { name: 'SERVICE_UNAVAILABLE' });
      const query = new URL(req.url, 'http://localhost').searchParams;
      if (!query.has('start_time') || !query.has('end_time'))
        return send(400, { name: 'INVALID_REQUEST' });
      const start = new Date(query.get('start_time')).getTime();
      const end = new Date(query.get('end_time')).getTime();
      const transactions = (payments[id] || []).filter(
        (p) =>
          new Date(p.time).getTime() >= start &&
          new Date(p.time).getTime() <= end,
      );
      return send(200, {
        transactions,
        total_items: transactions.length,
        total_pages: 1,
        links: [],
      });
    }
    const match = /^\/v1\/billing\/subscriptions\/([^/]+)(\/cancel)?$/.exec(
      path,
    );
    if (match) {
      const record = records[match[1]];
      if (!record) return send(404, { name: 'RESOURCE_NOT_FOUND' });
      if (req.method === 'POST' && match[2]) {
        record.status = 'CANCELLED';
        await pm.state.set('paypal.subscriptions', records);
        return send(204);
      }
      if (req.method === 'GET' && !match[2]) return send(200, record);
    }
    if (
      req.method === 'POST' &&
      path === '/v1/notifications/verify-webhook-signature'
    )
      return send(200, {
        verification_status:
          body.transmission_sig === 'valid-test-signature' &&
          body.webhook_id === 'WH-SIMULATION'
            ? 'SUCCESS'
            : 'FAILURE',
      });
    // Simulation control, not a real PayPal route.
    if (req.method === 'POST' && path === '/__test/activate') {
      if (!records[body.id]) return send(404, { name: 'RESOURCE_NOT_FOUND' });
      Object.assign(records[body.id], {
        status: 'ACTIVE',
        billing_info: {
          last_payment: {
            time: new Date().toISOString(),
            amount: { value: '5.00', currency_code: 'USD' },
          },
          next_billing_time: new Date(Date.now() + 30 * 86400000).toISOString(),
        },
      });
      await pm.state.set('paypal.subscriptions', records);
      payments[body.id] = payments[body.id] || [
        {
          id: `TX-${body.id}-1`,
          status: 'COMPLETED',
          time: new Date().toISOString(),
          amount_with_breakdown: {
            gross_amount: { value: '5.00', currency_code: 'USD' },
          },
        },
      ];
      await pm.state.set('paypal.transactions', payments);
      return send(200, records[body.id]);
    }
    if (req.method === 'POST' && path === '/__test/payment') {
      if (!records[body.subscriptionId])
        return send(404, { name: 'RESOURCE_NOT_FOUND' });
      const list = payments[body.subscriptionId] || [];
      const payment = {
        id: body.id,
        status: body.status || 'COMPLETED',
        time: body.time || new Date().toISOString(),
        amount_with_breakdown: {
          gross_amount: {
            value: body.amount || '5.00',
            currency_code: body.currency || 'USD',
          },
        },
      };
      const index = list.findIndex((p) => p.id === body.id);
      if (index < 0) list.push(payment);
      else list[index] = payment;
      payments[body.subscriptionId] = list;
      await pm.state.set('paypal.transactions', payments);
      return send(200, payment);
    }
    if (req.method === 'POST' && path === '/__test/transaction-failure') {
      failures[body.id] = Boolean(body.enabled);
      await pm.state.set('paypal.transactionFailures', failures);
      return send(200, { enabled: failures[body.id] });
    }
    return send(501, { name: 'ENDPOINT_NOT_MODELLED' });
  })
  .listen(process.env.PORT || 4901);
