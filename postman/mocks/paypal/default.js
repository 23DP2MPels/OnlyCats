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
      return send(200, records[body.id]);
    }
    return send(501, { name: 'ENDPOINT_NOT_MODELLED' });
  })
  .listen(process.env.PORT || 4901);
