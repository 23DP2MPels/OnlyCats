# OnlyCats PayPal simulation

Created 2026-10-25 from the official PayPal Subscriptions and webhook contracts;
see links in `docs/paypal.md`. No provider-owned mock was imported: no signed-in
Postman workspace was used. The handler is local and maintained by this project.

## Purpose

Exercise the actual `PaypalService` HTTP client without Sandbox credentials.
The stateful member lives in `postman/mocks/paypal/default.js`.

## Execution

From the repository root, with Postman CLI 1.76+:

```powershell
postman simulation run postman/simulations/paypal.sim.yaml --port 4900 --output ndjson --no-history
# In another terminal:
npm run test:paypal -w backend
# With PostgreSQL migrated and seeded:
npm run test:subscriptions -w backend
```

The first command must report `listening`. Stop it with Ctrl+C after the test.
Do not commit request logs. The test prints a summary; the simulation logs
identify all served paths.

## Assumptions

- 2026-10-25: this is fixture-based verification, not a real Sandbox payment.
  Browser approval, account eligibility, real signature cryptography, renewal
  scheduling and public HTTPS webhook delivery remain unverified.
- 2026-10-25: the local `/__test/activate` route simulates approval plus a paid
  first period. It is not a PayPal endpoint and is absent from the application API.
- 2026-10-25: `interceptRequests: true` is required for parsed bodies and handler
  error containment. Unknown routes return 501 rather than pretending to exist.

## Observations

<!-- begin:observations -->

2026-10-25: the paypal member served OAuth, repeated creation, pending and paid
lookups, signature success/failure, cancellation and an unknown subscription.
The client also rejected an unreachable local address. No member stayed silent.
2026-10-25: a second run exercised SubscriptionsService with real PostgreSQL,
including repeated checkout, ownership, signature rejection, webhook deduplication,
activation and repeated cancellation. The paypal member served all provider calls.
<!-- end:observations -->
