# Profila vēsture

Konta cilne “Iestatījumi” rāda lietotāja vārdu, e-pastu un pēdējās 50 veiksmīgās
pieteikšanās reizes. Katrs ieraksts satur datumu un laiku, reģistrācijas vai
pieteikšanās veidu, IP adresi un pārlūka User-Agent. Saskarne no User-Agent
nosaka pārlūka un operētājsistēmas nosaukumu; tā nav droša ierīces identifikācija.

Reģistrācija saglabā pirmo vēstures ierakstu kopā ar lietotāja izveidi.
Pieteikšanos saglabā tikai pēc pareizas paroles pārbaudes un pirms sesijas
sīkdatnes izsniegšanas. Nepareizas paroles mēģinājumi netiek iekļauti šajā
veiksmīgo pieteikšanos vēsturē. Paroles un sesiju žetoni vēsturē netiek glabāti.
Iepriekšējos ierakstus pirms šīs funkcijas ieviešanas atjaunot nevar.

## IP adrese aiz starpniekservera

Pēc noklusējuma saglabā savienojuma IP adresi. X-Forwarded-For galveni
neuzskata par uzticamu, tāpēc klients nevar vienkārši norādīt citu vēstures IP.
Aiz izvietošanas platformas starpniekservera šī adrese var piederēt pašam
starpniekserverim.

Ja platforma izmanto uzticamu starpniekserveri, mainīgajā `TRUST_PROXY` norādiet
tā adresi vai uzticamos CIDR diapazonus, atdalītus ar komatu. Express atbalsta
arī nosauktus diapazonus, piemēram, `loopback`. Norādiet tikai faktiski uzticamus
starpniekserverus un nepieļaujiet tiešu publisku piekļuvi backend, kas ļautu
apiet šo uzticamības robežu. Pēc izmaiņām atjaunojiet konteineru.

## Transakcijas

Cilne “Transakcijas” rāda pēdējās 100 saglabātās PayPal transakcijas:
lietotāja abonementu maksājumus kā izdevumus un sava satura ienākumus kā
ieņēmumus. Katram ierakstam ir kaķa vārds, summa, datums un statuss. Citu
lietotāju e-pastus vai maksātāja rekvizītus neatklāj.

Poga “Atjaunot transakcijas” ielasa PayPal vēsturi tikai pašreizējā lietotāja
abonementiem un viņa kaķu abonementiem. Izmantota tā pati unikālo transakciju
uzskaite kā [īpašnieka ienākumiem](earnings.md). Atmaksas rāda ar sākotnējo
maksājuma summu un atmaksas statusu, nevis kā jaunu izmaksu.

Visi maksājumi ir Sandbox testa darījumi. Izmaksu pieprasījumi un pieteikšanās
vēsture nav PayPal transakcijas; tiem kontā ir atsevišķas vēstures sadaļas.
