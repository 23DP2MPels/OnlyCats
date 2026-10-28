import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PaypalService } from '../src/paypal.service';

async function main() {
  const paypal = new PaypalService();
  const product = await paypal.request<{ id: string }>(
    '/v1/catalogs/products',
    'POST',
    {
      name: 'OnlyCats Sandbox',
      type: 'SERVICE',
      category: 'ENTERTAINMENT_AND_MEDIA',
    },
    randomUUID(),
  );
  const plan = await paypal.request<{ id: string }>(
    '/v1/billing/plans',
    'POST',
    {
      product_id: product.id,
      name: 'OnlyCats monthly — Sandbox',
      status: 'ACTIVE',
      billing_cycles: [
        {
          frequency: { interval_unit: 'MONTH', interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value: '5.00', currency_code: 'USD' },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CANCEL',
        payment_failure_threshold: 1,
      },
    },
    randomUUID(),
  );
  console.log(
    `Sandbox plan created. Add to backend/.env:\nPAYPAL_PLAN_ID=${plan.id}`,
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
