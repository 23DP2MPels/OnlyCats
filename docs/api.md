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
