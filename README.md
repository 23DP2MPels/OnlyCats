# OnlyCats

Mācību projekts tehnikumam: kaķu abonementi un privātas fotogrāfijas.
Monorepozitorijs: **NestJS + Vue 3 + Prisma ORM + PostgreSQL**.
Maksājumi notiek tikai **PayPal Sandbox** vidē; īsta nauda netiek izmantota.

## Iespējas

- Reģistrācija, pieteikšanās, sesija HttpOnly sīkdatnē un izrakstīšanās.
- Katalogs ar meklēšanu un filtriem, kaķu profili un publiskas publikācijas.
- Kaķu un publikāciju izveide un rediģēšana īpašnieka kontā.
- Publikāciju dzēšana un fotoattēlu augšupielāde līdz 8 MB.
- Privāti teksti un faili īpašniekam, administratoram un aktīviem abonentiem.
- Viena kaķa abonements: **5 USD mēnesī**, izmantojot PayPal Sandbox.
- Maksājuma pārbaude serverī, statusa sinhronizācija, atcelšana un tīmekļa aizķeres paraksta pārbaude.
- Administratora API lietotāju apskatei, Swagger un GitHub Actions.
- Saskarne latviešu, krievu un angļu valodā, gaišā un tumšā tēma.
- Sociālā plūsma, atzīmes “Patīk” un komentāri.

## Struktūra

```text
backend/   NestJS API, Prisma, migrācijas un testi
frontend/  Vue, TypeScript, Vite un oriģinālas SVG ilustrācijas
devops/    Atsevišķo pakalpojumu Dockerfile, Nginx un ilustrāciju ģenerators
docs/      API, arhitektūra, demonstrācija un darbu sadalījums
postman/   Lokāla PayPal HTTP simulācija
Dockerfile Abu lietotnes daļu būvēšana un palaišana vienā konteinerā
```

## Palaišana vienā Docker konteinerā

Nepieciešams Docker Desktop ar Compose un Git.

```powershell
Copy-Item .env.example .env
# Iestatiet POSTGRES_PASSWORD. Failā .env aizstājiet JWT_SECRET ar nejaušu virkni, kurā ir vismaz 32 rakstzīmes.
docker compose up --build -d
docker compose exec app npm run db:seed
```

Vietne: http://localhost:8080 · API: http://localhost:8080/api/docs

Viens NestJS process izsniedz API un Vue būvējuma failus, ieskaitot Vue Router
maršrutus. Migrācijas tiek izpildītas pirms API palaišanas. PostgreSQL darbojas
atsevišķā Compose servisā. Fotoattēli glabājas datubāzes BYTEA laukos.

Apturēšana: `docker compose down`. Dati saglabājas nosauktajos sējumos
`postgres_data`. Nelietojiet `down -v`, ja jāsaglabā datubāze un fotoattēli.
Sākotnējo datu skripts paredzēts mācību videi un izveido zināmas demonstrācijas paroles.

## Vides mainīgie, API adrese un CORS

Docker palaišanai izmantojiet saknes `.env`, lokālajam backend — `backend/.env`.

| Mainīgais          | Piemērs                                                  | Pielietojums                                                            |
| ------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `JWT_SECRET`       | Nejauša virkne ar vismaz 32 rakstzīmēm                   | Sesiju parakstīšana                                                     |
| `FRONTEND_URL`     | `http://localhost:8080`                                  | Publiskā vietnes adrese un PayPal atgriešanās saites                    |
| `API_URL`          | `/api`                                                   | API bāzes adrese Vue klientam; var norādīt `https://api.example.lv/api` |
| `CORS_ORIGIN`      | `http://localhost:8080`                                  | Atļautā pārlūka izcelsme; vairākas adreses atdala ar komatu             |
| `DATABASE_URL`     | `postgresql://onlycats:password@localhost:5433/onlycats` | PostgreSQL savienojuma URL                                              |
| `COOKIE_SAME_SITE` | `lax`                                                    | Sesijas sīkdatnes politika: `lax`, `strict` vai `none`                  |
| `COOKIE_SECURE`    | `false`                                                  | `true` ļauj sīkdatni pārsūtīt tikai ar HTTPS                            |
| `PORT`             | `3000`                                                   | Porta numurs konteinera iekšienē                                        |
| `FRONTEND_DIST`    | `/app/frontend/dist`                                     | Vue būvējuma mape; Dockerfile to iestata automātiski                    |

Vienā konteinerā atstājiet `API_URL=/api`: pārlūks izmanto to pašu domēnu un
portu. Ārējai API adresei jābūt sasniedzamai no lietotāja pārlūka; Docker servisa
nosaukums pārlūkā nav publiska adrese. `API_URL` jāiekļauj API prefikss `/api`.

`CORS_ORIGIN` satur precīzas izcelsmes ar protokolu un portu, bez ceļa un beigu
slīpsvītras. Piemērs: `https://cats.example.lv,http://localhost:5173`.
Aizstājējzīme `*` netiek atbalstīta, jo autentifikācija izmanto sīkdatnes.
Šis pats saraksts pārbauda arī datus mainošo pārlūka pieprasījumu Origin.

API konfigurācija tiek izsniegta ar `/runtime-config.js`, tāpēc pēc `API_URL`
maiņas Vue nav jāpārbūvē. Pēc `.env` maiņas atjaunojiet konteineru:

```powershell
docker compose up -d --force-recreate app
```

Ja frontend un API atrodas dažādās vietnēs, izmantojiet HTTPS,
`COOKIE_SAME_SITE=none` un `COOKIE_SECURE=true`. Pārlūka trešo pušu sīkdatņu
ierobežojumi joprojām var ietekmēt pieteikšanos. Vienas izcelsmes izvietojums
ar `API_URL=/api` ļauj izmantot noklusējuma `lax` politiku.

## Palaišana bez Docker

Nepieciešams Node.js 22.12+ (ieteicams Node 22 LTS) un npm.
PostgreSQL glabā datus un augšupielādētos fotoattēlus serverī.

```powershell
npm ci
Copy-Item backend/.env.example backend/.env
# Failā backend/.env norādiet nejaušu JWT_SECRET vērtību.
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:backend
```

Citā terminālī no repozitorija saknes:

```powershell
npm run dev:frontend
```

Vietne: http://localhost:5173 · API: http://localhost:3000/api/docs
Vite pārsūta `/api` pieprasījumus uz NestJS. Pēc backend izmaiņām tas jāpārstartē;
frontend atjaunojas automātiski. Ja Vite klientam vajadzīga ārēja API adrese,
izveidojiet `frontend/.env` pēc `frontend/.env.example` un iestatiet `VITE_API_URL`.
Šo Vite mainīgo nolasa izstrādes servera palaišanas vai būvēšanas laikā;
Docker vidē lietojiet izpildlaika `API_URL`.

PostgreSQL shēma tiek sagatavota ar `npm run db:migrate`. Komandas palaidiet no
projekta saknes, izmantojot npm skriptus. Lai izveidotu rezerves kopiju,
apturiet backend un nokopējiet datubāzes failu un augšupielādētos fotoattēlus.

## Demonstrācijas konti

Pēc sākotnējo datu ievietošanas visiem ir parole `OnlyCatsDemo2026!`:

| E-pasts               | Pielietojums                 |
| --------------------- | ---------------------------- |
| creator@onlycats.test | Četru kaķu īpašnieks         |
| viewer@onlycats.test  | Apmeklētājs bez abonementiem |
| admin@onlycats.test   | Administrators               |

Sākotnējo datu skripts atkārtoti nepārraksta esošos lietotājus, kaķus un publikācijas.
Izmantotas pašu ilustrācijas un publiski pieejami Unsplash fotoattēli;
autori un licence norādīti [attēlu aprakstā](docs/assets.md).
Īpašnieks var augšupielādēt jaunus fotoattēlus savā kontā.

## PayPal Sandbox

Iestatīšana aprakstīta [PayPal instrukcijā](docs/paypal.md).
Bez piekļuves atslēgām darbojas katalogs, autentifikācija, lietotāja konts un publikācijas;
maksājuma noformēšana parāda norādi iestatīt Sandbox. Fiktīva abonementa aktivizācija netiek veikta.

## Pārbaudes

```powershell
npm run db:generate
npm run build
npm test
npm run test:http -w backend  # Vajadzīgs palaists API un atsevišķa datubāze ar testa datiem.
npm run test:social -w backend # Atzīmes, komentāri, privātums un plūsmas lapošana.
npm run test:deployment -w backend # Vajadzīgs API ar iestatītu FRONTEND_DIST un Vue būvējumu.
npm audit
```

HTTP pamatdarbības tests izveido jaunu testa lietotāju un pagaidu publikāciju;
publikācija pēc pārbaudes tiek izdzēsta. Nelietojiet testu ar vērtīgiem datiem.
PayPal pārbaude bez piekļuves atslēgām aprakstīta [simulācijas instrukcijā](postman/simulations/paypal.context.md).

## Komanda un vēsture

Maksims — backend; Kirills — backend un DevOps; Mairis un Glebs — frontend.
Papildinformācija: [komandas apraksts](docs/team.md).

Komitu vēsture noformēta retrospektīvi pa posmiem no 2026. gada 15. septembra
līdz 25. oktobrim. Datumi un autori atspoguļo saskaņoto darbu sadalījumu,
nevis apliecina faktisko izstrādi šajās dienās. Pirms nodošanas dalībniekiem
jāpārbauda sava daļa. GitHub izmaiņu pieprasījumu un koda pārskatīšanas datumi ir faktiskie.

## Mācību MVP ierobežojumi

Tiek izmantots viens pārdevēja konts un kopīgs mēneša tarifs. Nav izmaksu
īpašniekiem, atmaksu, tarifu maiņas, paroles atjaunošanas, e-pasta apstiprināšanas
un atsevišķas moderatora saskarnes. Atcelšana uzreiz pārtrauc piekļuvi.
Bez tīmekļa aizķeres pagarinājums jāpārbauda ar statusa atjaunošanas pogu kontā.
Katalogā un plūsmā ir ne vairāk kā 100 ierakstu.

Docker konfigurācija paredzēta lokālai demonstrācijai. Publiskai izvietošanai
vajadzīgs HTTPS, rezerves kopijas, atsevišķi noslēpumi un datu glabātuves uzturēšana.

## Savas fotogrāfijas

Kontā atveriet kaķa redaktoru un izvēlieties savu JPEG, PNG vai WebP (līdz 8 MB). Avatāri un publikāciju fotoattēli glabājas PostgreSQL tabulas StoredImage BYTEA laukā.
Iepriekšējās SQLite datubāzes un uploads importēšana: no backend mapes `node scripts/import-legacy.mjs data/onlycats.db`. Avota faili netiek dzēsti; importējiet pirms seed, lai saglabātu esošos ierakstus. PostgreSQL iepriekšējiem failu fotoattēliem var palaist to pašu skriptu bez argumenta.
