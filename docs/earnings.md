# Īpašnieka ienākumi un izmaksu pieprasījumi

Konta cilnē “Ienākumi” īpašnieks redz apstiprināto maksājumu kopsummu,
pieprasījumos rezervēto summu, pieejamo atlikumu un jaunākos 50 maksājumus
un pieprasījumus. Kopsummas aptver visu saglabāto vēsturi. Visi dati attiecas
uz PayPal Sandbox; reālu izmaksu nav.

## Maksājumu uzskaite

Ienākumus iegūst no PayPal abonementa transakcijām, nevis aktīvo abonementu
skaita vai fiksēta tarifa reizinājuma. Tiek pārbaudīta PayPal abonementa,
plāna un lokālā ieraksta sasaiste. Katra PayPal transakcija datubāzē ir unikāla:
atkārtota sinhronizācija un tīmekļa aizķeru piegāde nepalielina ienākumus divreiz.

Summas glabā veselos USD centos. Kopsummā iekļauj tikai COMPLETED transakcijas,
izmantojot gross_amount pirms PayPal komisijas. REFUNDED un PARTIALLY_REFUNDED
ieraksti ir redzami vēsturē, bet netiek ieskaitīti pieejamajā atlikumā.
Daļēji atmaksāta maksājuma atlikums netiek uzskatīts par pieejamu izmaksai.
Zināmu atmaksu nepārraksta novēlota COMPLETED atbilde. Abonementa atcelšana
nedzēš iepriekš saņemtos maksājumus.

Jauni maksājumi tiek ielasīti abonementa apstiprināšanas un sinhronizācijas laikā,
arī pēc pārbaudīta PayPal paziņojuma. Poga “Atjaunot maksājumus” ielasa vēsturi
pašlaik sasaistītajiem īpašnieka kaķu PayPal abonementiem, arī atceltiem abonementiem.
Vecu PayPal abonementu, kura identifikators jau aizstāts pirms šīs funkcijas
ieviešanas, automātiski atjaunot nevar. PayPal kļūme neatjauno datus ar izdomātām summām.

Izmantotā saskarne: [PayPal abonementa transakcijas](https://developer.paypal.com/api/subscriptions/v1/subscriptions-transactions).

## Pieprasījumi

Īpašnieks ievada summu USD ar precizitāti līdz centam. Pieprasījums tiek
saglabāts ar statusu PENDING un rezervē šo summu. Pieejamais atlikums ir
apstiprinātie maksājumi mīnus visas PENDING summas, ne mazāk par nulli.
Vienlaicīgus pieprasījumus vienam īpašniekam serializē ar PostgreSQL transakcijas
slēdzeni, lai vienu atlikumu nevarētu rezervēt vairākas reizes.

requestId ir klienta ģenerēts UUID atkārtota pieprasījuma atpazīšanai.
Atkārtojot to ar to pašu īpašnieku un summu, atgriež iepriekšējo pieprasījumu;
citādi atgriež 409. Īpašnieks var atcelt savu pieprasījumu; statuss kļūst
CANCELLED un rezervācija tiek atbrīvota. Lietotājs nevar apskatīt vai atcelt
cita īpašnieka pieprasījumus. Administrators var tos apskatīt API.

Nav naudas pārskaitīšanas, PayPal Payouts integrācijas, automātiskas apstiprināšanas
vai PAID statusa. Nav jāievada bankas vai PayPal saņēmēja rekvizīti.

## Pārbaude

Ar migrētu, atsevišķu PostgreSQL testa datubāzi un palaistu simulāciju no
`postman/simulations/paypal.sim.yaml`:

```powershell
npm run test:earnings -w backend
```

Tests izmanto īstu NestJS HTTP API un PostgreSQL kopā ar lokālu PayPal HTTP
simulāciju. Tas pārbauda īpašumtiesības, summas, rezervācijas, paralēlus un
atkārtotus pieprasījumus, atmaksas un pakalpojuma kļūmi. Tas neapliecina īstu
Sandbox kontu vai publisko tīmekļa aizķeru pieejamību.
