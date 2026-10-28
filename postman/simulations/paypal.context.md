# OnlyCats PayPal simulācija

Izveidota 2026. gada 25. oktobrī pēc oficiālajām PayPal abonementu un tīmekļa
aizķeru saskarnēm; saites ir `docs/paypal.md`. Pakalpojuma sniedzēja uzturēts
imitācijas serveris nav importēts, un autorizēta Postman darbvieta nav izmantota.
Apstrādātājs ir lokāls, un to uztur šis projekts.

## Mērķis

Pārbaudīt īsto `PaypalService` HTTP klientu bez Sandbox piekļuves datiem.
Stāvokli saglabājošā daļa atrodas `postman/mocks/paypal/default.js`.

## Palaišana

No repozitorija saknes ar Postman CLI 1.76+:

```powershell
postman simulation run postman/simulations/paypal.sim.yaml --port 4900 --output ndjson --no-history
# Citā terminālī:
npm run test:paypal -w backend
# Ar migrētu SQLite datubāzi un sākotnējiem datiem:
npm run test:subscriptions -w backend
```

Pirmajai komandai jāparāda `listening`. Pēc testa apturiet to ar Ctrl+C.
Pieprasījumu žurnālus neiekļaujiet komitos. Tests izvada kopsavilkumu,
savukārt simulācijas žurnāli norāda visus apkalpotos ceļus.

## Pieņēmumi

- 2026-10-25: pārbaude izmanto sagatavotus testa datus, nevis īstu Sandbox maksājumu.
  Nav pārbaudīta apstiprināšana pārlūkā, konta atbilstība, īstā parakstu kriptogrāfija,
  pagarinājumu grafiks un tīmekļa aizķeru piegāde publiskā HTTPS adresē.
- 2026-10-25: lokālais maršruts `/__test/activate` simulē apstiprināšanu un apmaksātu
  pirmo periodu. Tas nav PayPal galapunkts un nav iekļauts lietotnes API.
- 2026-10-25: `interceptRequests: true` vajadzīgs parsētiem pieprasījumu datiem
  un apstrādātāja kļūdu izolēšanai. Nezināmi maršruti atgriež 501.

## Novērojumi

<!-- begin:observations -->

2026-10-25: PayPal simulācijas daļa apkalpoja OAuth, atkārtotu izveidi, gaidošu
un apmaksātu abonementu nolasīšanu, derīgu un nederīgu parakstu, atcelšanu un
nezināmu abonementu. Klients arī noraidīja nesasniedzamu lokālo adresi.
Visi pieprasījumi saņēma atbildi.

2026-10-25: otrajā palaišanas reizē SubscriptionsService tika pārbaudīts ar īstu
PostgreSQL datubāzi, tostarp atkārtota noformēšana, īpašumtiesības, nederīga paraksta
noraidīšana, atkārtotu tīmekļa aizķeru atpazīšana, aktivizācija un atkārtota atcelšana.
PayPal simulācijas daļa apkalpoja visus pieprasījumus pakalpojuma sniedzējam.
Šis ir vēsturiskais pārbaudes rezultāts; pašreizējā lietotne izmanto PostgreSQL.

2026-10-28: `npm run test:earnings -w backend` pārbaudīja īstu NestJS API un
atsevišķu PostgreSQL datubāzi. PayPal simulācijas daļa apkalpoja OAuth,
abonementus, transakciju vēsturi, paraksta pārbaudi un atcelšanu; tā apkalpoja
visus ārējos pieprasījumus, neviena daļa nepalika neizmantota. Ienākumu tests
apstiprināja atkārtotu maksājumu atpazīšanu, rezervācijas konkurenci, īpašnieku
izolāciju, atmaksu izslēgšanu un atlikuma saglabāšanu pie PayPal 503 atbildes.
Izmaksu galapunkts nav modelēts vai izsaukts. Īsti Sandbox konti netika izmantoti.
<!-- end:observations -->
