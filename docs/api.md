# HTTP API

Prefikss ir `/api`. Pieprasījumi izmanto JSON, izņemot attēla augšupielādi ar multipart.
Sesija glabājas sīkdatnē `onlycats_session`; pārlūks izmanto `credentials: include`.
Swagger apraksts pieejams `/api/docs`, JSON apraksts — `/api/docs-json`.
Ievaddatu shēmas definētas failā `backend/src/dto.ts`.

Sociālā plūsma atgriež pa 20 ierakstiem ar `nextCursor`; `scope=all` izvēlas visu
plūsmu, bet `scope=subscriptions` — abonēto kaķu saturu. Atzīmes “Patīk”
pievienošana un noņemšana ir idempotenta. Komentāru sarakstā ir pēdējie 50
komentāri; jauna komentāra JSON `{ "body": "..." }` var saturēt līdz 1000 rakstzīmēm.
Reakciju izveidei vajadzīga sesija. Privātu publikāciju komentāriem un atzīmēm
papildus vajadzīgas piekļuves tiesības. Plūsma neatklāj slēptus tekstus, attēlus,
failu atslēgas vai citu lietotāju abonementu sarakstus.

| Metode | Maršruts                         | Piekļuve un pielietojums                                             |
| ------ | -------------------------------- | -------------------------------------------------------------------- |
| GET    | /health                          | Datubāzes stāvoklis un Sandbox iestatījumi                           |
| POST   | /auth/register                   | email, name, password: 10–72 rakstzīmes, ne vairāk kā 72 UTF-8 baiti |
| POST   | /auth/login                      | email, password; iestata sīkdatni                                    |
| POST   | /auth/logout                     | Dzēš sīkdatni                                                        |
| GET    | /auth/me                         | Pašreizējā lietotāja publiskie dati vai null                         |
| GET    | /cats?search=                    | Katalogs ar ne vairāk kā 100 kaķiem                                  |
| GET    | /cats/:id                        | Profils un pazīmes isOwner/subscribed                                |
| POST   | /cats                            | Sesija; name, breed, bio un neobligāts avatar                        |
| PATCH  | /cats/:id                        | Īpašnieks/ADMIN; visi tie paši lauki                                 |
| GET    | /cats/:id/posts                  | Līdz 100 publikācijām; privātie lauki ir paslēpti                    |
| POST   | /cats/:id/posts                  | Īpašnieks/ADMIN; title, body, isPrivate                              |
| PATCH  | /posts/:id                       | Īpašnieks/ADMIN; title, body, isPrivate                              |
| DELETE | /posts/:id                       | Īpašnieks/ADMIN; dzēš publikāciju un fotoattēlu                      |
| POST   | /posts/:id/image                 | Īpašnieks/ADMIN; multipart lauks file, līdz 8 MB                     |
| GET    | /posts/:id/image                 | Piekļuves tiesības pārbauda katram pieprasījumam                     |
| GET    | /feed?scope=all&cursor=UUID      | Plūsma pa 20 ierakstiem                                              |
| PUT    | /posts/:id/like                  | Sesija un piekļuve publikācijai; pievieno atzīmi “Patīk”             |
| DELETE | /posts/:id/like                  | Sesija un piekļuve publikācijai; noņem atzīmi “Patīk”                |
| GET    | /posts/:id/comments              | Piekļuve publikācijai; pēdējie 50 komentāri                          |
| POST   | /posts/:id/comments              | Sesija un piekļuve publikācijai; body                                |
| GET    | /account                         | Sesija; savi kaķi un abonementi                                      |
| POST   | /subscriptions                   | Sesija; catId; atgriež approvalUrl                                   |
| POST   | /subscriptions/confirm/:paypalId | Sava abonementa apstiprināšana, izmantojot PayPal                    |
| POST   | /subscriptions/:id/sync          | Sava abonementa aktuālā stāvokļa iegūšana                            |
| DELETE | /subscriptions/:id               | Sava abonementa atcelšana                                            |
| POST   | /payments/paypal/webhook         | Pārbaudīts PayPal paraksts; pieļauj atkārtotu piegādi                |
| GET    | /admin/users                     | Tikai ADMIN; bez paroļu jaucējvērtībām                               |

Kļūdas: 400 — nederīgi dati, 401 — nav sesijas, 403 — nav piekļuves tiesību,
404 — objekts nav atrasts, 409 — e-pasts jau aizņemts, 413 — pārsniegts faila
izmērs, 503 — Sandbox nav iestatīts vai nav pieejams. Kļūdas teksts ir laukā `message`.

CORS atļautās izcelsmes norāda `CORS_ORIGIN`; atbalstītas vairākas precīzas
adreses, atdalītas ar komatu. Tiek atļauti pieprasījumi ar sīkdatnēm.
Datus mainošiem pārlūka pieprasījumiem Origin papildus pārbauda serverī.
`/runtime-config.js` ir publiska klienta konfigurācija un nesatur noslēpumus.

## Kaķa fotogrāfija

POST `/api/cats/:id/avatar`: īpašnieka multipart `file`, JPEG/PNG/WebP līdz 8 MB. Atgriež `{avatar}`. GET `/api/cats/:id/avatar` publiski izsniedz JPEG. Augšupielādes tiek validētas un pārkodētas, glabātas PostgreSQL `StoredImage.data` (BYTEA). Privāto publikāciju attēlu GET joprojām pārbauda abonementu.

## Ienākumi un izmaksu pieprasījumi

Visiem `/creator` maršrutiem vajadzīga sesija; ownerId serveris iegūst no tās.
Summas atbildēs ir veseli USD centi. Pieprasījumi nepārskaita naudu.

| Metode | Maršruts                 | Pielietojums                                                                                            |
| ------ | ------------------------ | ------------------------------------------------------------------------------------------------------- |
| GET    | /creator/earnings        | receivedCents, reservedCents, availableCents, payments, withdrawals; sandbox=true, payoutsEnabled=false |
| POST   | /creator/earnings/sync   | Ielasa sava satura PayPal maksājumus un atgriež kopsavilkumu                                            |
| POST   | /creator/withdrawals     | JSON: amount kā decimālvirkne, piemēram, "2.50", un requestId kā UUID; atgriež id, status, amountCents  |
| DELETE | /creator/withdrawals/:id | Atceļ savu pieprasījumu un atbrīvo rezervāciju                                                          |
| GET    | /admin/withdrawals       | Tikai ADMIN; pēdējie 100 pieprasījumi ar īpašnieka publiskajiem datiem                                  |

Nepietiekamam atlikumam vai nederīgai summai atgriež 400; requestId konfliktam —
409; svešam vai neesošam atceļamajam pieprasījumam — 404. Pamatnoteikumi un
vēstures ierobežojumi aprakstīti [ienākumu dokumentācijā](earnings.md).

## Profila vēsture

| Metode | Maršruts                   | Pielietojums                                                                                                               |
| ------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| GET    | /account/login-history     | Sesija; savas pēdējās 50 veiksmīgās pieteikšanās ar id, kind, ipAddress, userAgent, createdAt                              |
| GET    | /account/transactions      | Sesija; savas pēdējās 100 transakcijas ar amountCents, currency, status, paidAt, cat.name un direction: INCOME vai EXPENSE |
| POST   | /account/transactions/sync | Sesija; ielasa savus PayPal maksājumus un ienākumus, atgriež transakciju vēsturi                                           |

Lietotāja identifikatoru vienmēr iegūst no sesijas; klienta userId vai ownerId
parametrs nemaina atlasi. Atbildes nesatur paroles, sesiju žetonus vai citu
lietotāju maksājumu rekvizītus. [IP uzticamība un vēstures robežas](profile.md).

## Search, gifts and deletion

GET /api/search?q= searches public account names and cat names together (minimum 2 characters, maximum 20 results per type). GET /api/users/:id returns public profile and cats, without email or authentication fields.
POST /api/cats/:id/gifts accepts {userId}; only the cat owner may grant 30 days of free access. giftUntil is independent of paidUntil; it creates no PayPal payment or earnings.
DELETE /api/posts/:id is owner/admin-only and removes attached image and reactions. DELETE /api/account requires the current password, confirms provider cancellation for related PayPal subscriptions, removes owned data and invalidates the session. If provider cancellation fails, local account deletion does not proceed.
Cancelling a subscription stops renewal and preserves access through the existing paidUntil/giftUntil boundary. Provider sync for CANCELLED subscriptions preserves the previously confirmed paidUntil.
