# PayPal Sandbox

Lietotnē ir fiksēta adrese `https://api-m.sandbox.paypal.com`.
Pārslēgšanās uz Live vidi nav paredzēta. HTTP simulācijas testā adresi maina
tikai atsevišķā testa procesa atmiņā.

1. Atveriet [PayPal izstrādātāju paneli](https://developer.paypal.com/dashboard/).
2. Izveidojiet Sandbox REST lietotni un testa Business pārdevēja un Personal pircēja kontus.
3. Saglabājiet Client ID un Client Secret failā `backend/.env` lokālai palaišanai
   vai saknes `.env` Docker palaišanai. Noslēpumus nesūtiet čatā un neiekļaujiet komitos.
4. Izveidojiet produktu un mēneša plānu par 5 USD:

```powershell
npm run paypal:setup -w backend
# Docker Compose gadījumā:
docker compose exec app npm run paypal:setup
```

5. Saglabājiet izvadīto `PAYPAL_PLAN_ID` attiecīgajā `.env`. Komanda katrā
   palaišanas reizē izveido jaunu produktu un plānu; neatkārtojiet to bez vajadzības.
6. Tīmekļa aizķerei vajadzīgs PayPal sasniedzams HTTPS URL:
   `https://YOUR_HOST/api/payments/paypal/webhook`. Izveidojiet to Sandbox lietotnes
   iestatījumos. Abonējiet `BILLING.SUBSCRIPTION.ACTIVATED`, `.UPDATED`, `.CANCELLED`,
   `.SUSPENDED`, `.EXPIRED`, `.PAYMENT.FAILED` un `PAYMENT.SALE.COMPLETED`.
7. Saglabājiet `PAYPAL_WEBHOOK_ID`. Mainīgajā `FRONTEND_URL` norādiet faktisko
   frontend adresi, bet `CORS_ORIGIN` — atļauto pārlūka izcelsmi. Pārstartējiet backend.
   Compose gadījumā: `docker compose up -d --force-recreate app`.
8. Piesakieties OnlyCats kā apmeklētājs, izvēlieties kaķi un nospiediet pievienošanās
   pogu. PayPal vietnē izmantojiet Personal Sandbox kontu, nevis pārdevēja kontu.
9. Pēc atgriešanās serveris nolasa abonementa stāvokli no PayPal. Piekļuve rodas
   tikai ar ACTIVE statusu, apstiprinātu pozitīvu maksājumu un perioda beigām nākotnē.
   Aizkaves gadījumā izmantojiet atkārtotas pārbaudes vai statusa atjaunošanas pogu kontā.

Kopīgs plāns tiek izmantots dažādiem kaķiem, bet katram lietotāja un kaķa pārim
atbilst atsevišķs PayPal abonements. `custom_id` to sasaista ar lokālo ierakstu.
Atgriešanās URL apmeklējums pats par sevi neapstiprina maksājumu.

Tīmekļa aizķeri vispirms pārbauda ar PayPal API, pēc tam lietotne atkārtoti
nolasa autoritatīvo abonementa stāvokli. Apstrādāto notikumu ID saglabā, lai
atkārtotas piegādes neradītu atkārtotas darbības. Pakalpojuma kļūmes gadījumā
atgriež kļūdu, lai PayPal varētu atkārtot paziņojuma piegādi.

Veiksmīga simulācija nepārbauda īstas piekļuves atslēgas, konta pieejamību,
maksājumu PayPal pārlūkā un tīmekļa aizķeres piegādi publiskā HTTPS adresē.
Šīs pārbaudes veic pēc Sandbox iestatīšanas.

Avoti: [abonementu API](https://developer.paypal.com/docs/api/subscriptions/v1/),
[tīmekļa aizķeru pārbaude](https://developer.paypal.com/api/rest/webhooks/rest/),
[abonementu notikumi](https://developer.paypal.com/subscriptions/webhooks).
