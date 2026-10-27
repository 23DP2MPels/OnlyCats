# OnlyCats saskarne

Silta, neitrāla krāsu palete, koraļļu akcents, pašu SVG kaķi un īsti fotoattēli.
Ilustrācijas var atkārtoti ģenerēt ar `node devops/generate-art.mjs`.
Fonti tiek ielādēti no Google Fonts; ja tie nav pieejami, izmanto sistēmas fontus.

Saskarne atbalsta latviešu valodu pēc noklusējuma, kā arī krievu un angļu valodu.
LV/RU/EN pārslēdzējs atrodas galvenē. Vārdnīcas glabājas `frontend/src/locales/`,
reaktīvā lokalizācija un tulkotās kļūdas — `frontend/src/i18n.ts`.
Datumus formatē ar Intl atbilstoši izvēlētajai valodai. Lietotāju saturs saglabājas
autora valodā. Vārdnīcu pilnīgumu pārbauda ar `npm test -w frontend`.

Saules un mēness poga pārslēdz gaišo un tumšo tēmu. Pirmajā apmeklējumā ņem
vērā sistēmas tēmu, turpmāk — saglabāto izvēli. Valoda un tēma tiek saglabātas
localStorage. Krāsas definētas ar semantiskiem CSS mainīgajiem. Pamattekstam
izmanto Nunito Sans, akcentiem — Bitter. Izmantoti vidēji un pustrekni burtu svari;
teksta izmērs palielināts aptuveni par 20%. Sekundārajam tekstam ir paaugstināts
kontrasts, sadaļas atdala apmales un foni. Izvēlnes un darbību ikonas ir vienoti
SVG no UiIcon. Stāstu avatariem ir fiksēti izmēri, apgriešana un atsevišķa paraksta rinda.

Stilus būvē Tailwind CSS 4 ar oficiālo Vite spraudni. Kopīgie dizaina mainīgie
definēti `@theme`, atkārtotie elementi izmanto Tailwind utilītklases ar `@apply`
slānī components. Krāsu tēmu pārvalda data-theme atribūts.

Sākumlapa ir sociālā plūsma ar personalizēta satura un savu abonementu cilnēm,
publikāciju kartītēm, atzīmēm “Patīk” un komentāriem. Atzīmes un komentāri
saglabājas serverī. Privātas publikācijas ir aizsargātas arī tiešos API pieprasījumos.
Katalogs un iepazīšanās ar projektu atrodas `/explore`.

Lapas: katalogs, kaķa profils, pieteikšanās un reģistrācija, lietotāja konts,
PayPal rezultāts un 404. Navigācija izmanto Vue Router. Vienotajā konteinerā
NestJS atgriež index.html klienta maršrutiem; nezināmiem `/api` maršrutiem
saglabājas API 404 atbilde.

API klients sūta pieprasījumus ar `credentials: include`. Bāzes adresi nolasa
no `window.__ONLYCATS_CONFIG__.apiUrl`, ko serveris izsniedz ar `/runtime-config.js`.
Tā atbilst backend vides mainīgajam `API_URL`; noklusējums ir `/api`.
Izstrādē vai atsevišķā būvējumā var izmantot `VITE_API_URL` no `frontend/.env`.
API atgrieztās attēlu saites ar `/api/` prefiksu pielāgo izvēlētajai bāzes adresei.

Sesijas JWT glabājas HttpOnly sīkdatnē, un Vue to nelasa. Pēc pieteikšanās
atjaunojas reaktīvais lietotāja stāvoklis. Formas parāda kļūdas un pieprasījuma
laikā bloķē atkārtotu nospiešanu. Ja fotoattēla augšupielāde neizdodas, redaktors
saglabā jau izveidotās publikācijas ID, lai atkārtots mēģinājums neradītu dublikātu.

Privāta publikācija tiek attēlota kā kartīte ar abonēšanas piedāvājumu. Serveris
neizsniedz tās tekstu vai attēlu; CSS izpludināšana netiek izmantota kā aizsardzība.
Pāreja uz maksājumu pieļauj tikai HTTPS saiti uz www.sandbox.paypal.com.

Izkārtojums pielāgojas šauriem ekrāniem. Formām ir label, pogām — disabled
stāvoklis un redzams fokuss. Ja iestatīts prefers-reduced-motion, animācija tiek atspējota.
