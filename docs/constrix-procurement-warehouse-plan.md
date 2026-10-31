# CONSTRIX — Təchizat, anbar və maliyyə üzrə ilkin plan

**Versiya:** 0.1\
**Hazırlanma əsası:** 31.10.2026 müştəri dosyesi, MoySklad hesabının oxu baxışı, mövcud CONSTRIX kod bazasının ilkin auditi\
**Sənədin məqsədi:** biznes axınlarını, mərhələləri, mövcud vəziyyəti və növbəti planlama paketini müəyyənləşdirmək. Bu sənəd icra spesifikasiyası və ya kod dəyişikliyi deyil.

## 1. İstifadə olunan mənbələr

- `CONSTRIX_31_10_2026_Techizat_Anbar_Dosye_v1.pdf` — müştərinin qərarları, ekran görüntüləri, Excel alış aktı nümunəsi və qəbul meyarları.
- `CONSTRIX_31_10_2026_Techizat_Anbar_Dosye_v1.md` — qərar və tələblərin mətn xülasəsi.
- MoySklad-da istifadəçi tərəfindən verilən anbar linkləri — şəxsi hesabda mövcud naviqasiya və siyahı strukturu.
- MoySklad rəsmi kömək mərkəzi — [anbar uçotu](https://support.moysklad.ru/hc/ru/%D0%B7%D0%BD%D0%B0%D0%BA%D0%BE%D0%BC%D1%81%D1%82%D0%B2%D0%BE%20%D1%81%20%D1%81%D0%B5%D1%80%D0%B2%D0%B8%D1%81%D0%BE%D0%BC/%D0%BF%D1%80%D0%BE%D1%86%D0%B5%D1%81%D1%81%D1%8B/%D1%81%D0%BA%D0%BB%D0%B0%D0%B4%D1%81%D0%BA%D0%BE%D0%B8_%D1%83%D1%87%D0%B5%D1%82), [təchizatçıdan qəbul](https://support.moysklad.ru/hc/ru/%D0%B7%D0%B0%D0%BA%D1%83%D0%BF%D0%BA%D0%B8/%D0%BF%D1%80%D0%B8%D0%B5%D0%BC%D0%BA%D0%B0_%D1%82%D0%BE%D0%B2%D0%B0%D1%80%D0%BE%D0%B2), [ilkin/artıq qalıq mədaxili](https://support.moysklad.ru/hc/ru/%D1%82%D0%BE%D0%B2%D0%B0%D1%80%D1%8B%20%D0%B8%20%D1%81%D0%BA%D0%BB%D0%B0%D0%B4%D1%8B/%D0%BE%D0%BF%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D0%B8/%D0%BE%D0%BF%D1%80%D0%B8%D1%85%D0%BE%D0%B4%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D0%B5_%D1%82%D0%BE%D0%B2%D0%B0%D1%80%D0%BE%D0%B2), [qalıqlar və rezervlər](https://support.moysklad.ru/hc/ru/%D1%82%D0%BE%D0%B2%D0%B0%D1%80%D1%8B%20%D0%B8%20%D1%81%D0%BA%D0%BB%D0%B0%D0%B4%D1%8B/%D0%BE%D1%81%D1%82%D0%B0%D1%82%D0%BA%D0%B8%20%D0%B8%20%D1%81%D0%B5%D0%B1%D0%B5%D1%81%D1%82%D0%BE%D0%B8%D0%BC%D0%BE%D1%81%D1%82%D1%8C/%D1%81%D0%BA%D0%BB%D0%B0%D0%B4%D1%81%D0%BA%D0%BE%D0%B8_%D1%83%D1%87%D0%B5%D1%82_%D0%BE%D1%81%D1%82%D0%B0%D1%82%D0%BA%D0%B8_%D1%80%D0%B5%D0%B7%D0%B5%D1%80%D0%B2%D1%8B_%D0%BE%D0%B6%D0%B8%D0%B4%D0%B0%D0%BD%D0%B8%D1%8F), [köçürmələr](https://support.moysklad.ru/hc/ru/%D1%82%D0%BE%D0%B2%D0%B0%D1%80%D1%8B%20%D0%B8%20%D1%81%D0%BA%D0%BB%D0%B0%D0%B4%D1%8B/%D0%BE%D0%BF%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D0%B8/%D0%BF%D0%B5%D1%80%D0%B5%D0%BC%D0%B5%D1%89%D0%B5%D0%BD%D0%B8%D1%8F), [daxili sifarişlər](https://support.moysklad.ru/hc/ru/%D0%B7%D0%B0%D0%BA%D1%83%D0%BF%D0%BA%D0%B8/%D0%B2%D0%BD%D1%83%D1%82%D1%80%D0%B5%D0%BD%D0%BD%D0%B8%D0%B5_%D0%B7%D0%B0%D0%BA%D0%B0%D0%B7%D1%8B), [inventarizasiya](https://support.moysklad.ru/hc/ru/%D1%82%D0%BE%D0%B2%D0%B0%D1%80%D1%8B%20%D0%B8%20%D1%81%D0%BA%D0%BB%D0%B0%D0%B4%D1%8B/%D0%BE%D0%BF%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D0%B8/%D0%B8%D0%BD%D0%B2%D0%B5%D0%BD%D1%82%D0%B0%D1%80%D0%B8%D0%B7%D0%B0%D1%86%D0%B8%D1%8F_%D1%82%D0%BE%D0%B2%D0%B0%D1%80%D0%BE%D0%B2).
- Mövcud kod: `src/pages/Warehouse.tsx`, `src/pages/PurchaseActs.tsx`, `src/domain/ops.ts`, `src/domain/purchaseActs.ts`, `src/domain/types.ts`, `src/domain/access.ts`, `backend/src/records/act-workflows.service.ts`, `backend/prisma/schema.prisma`.

## 2. Mövcud CONSTRIX bazası

Bu plan mövcud funksiyaları təkrarlamamaq və kritik boşluqları düzgün sıraya qoymaq üçün yazılıb.

| Sahə | Hazırkı vəziyyət | Planlama nəticəsi |
|---|---|---|
| Anbar interfeysi | `Qalıq`, `Kritik`, `Partiyalar`, `Pasport`, `Transfer`, `Hərəkət`, `Anbarlar` tabları var. | İcmal, rezerv, sərfiyyat, məsul şəxsin qalığı və inventarizasiya axınları hazırkı tablara əlavə edilə və ya ayrıca açıla bilər; qərar wireframe mərhələsində veriləcək. |
| Anbarlar | `Location` növü mərkəz, zavod, sex və sahədir; layihəyə bağlama mümkündür. | Valideyn anbar, müvəqqəti yer, ünvan/kod və anbardar məsuliyyəti modeli çatışmır. Hiyerarxiyanın necə saxlanması müəyyənləşdirilməlidir. |
| Qalıq | `Stock` material/anbar üzrə miqdar saxlayır; `Movement` mədaxil, məxaric və köçürmə qeydlərini saxlayır. | Rezerv, gözlənilən mədaxil, məsul şəxsin üzərindəki qalıq və audit üçün kanonik qaynaq razılaşdırılmalıdır. |
| Köçürmə | Anbarlararası sadə hərəkət və çoxdayanacaqlı shipment marşrutu var. | Təsdiq, yoldadır, qismən qəbul, uyğunsuzluq və təhvil imzaları tam sənəd statuslarına çevrilməlidir. |
| Partiyalar | `StockLot`, QR, partiya, maya dəyəri və son istifadə sahələri; FIFO/orta maya seçimi var. | Lot əməliyyatları ilə ümumi `Stock`/`Movement` yazılışları vahid tranzaksiyada əlaqələndirilməlidir. QR/barcode müştəri üçün məcburi qəbul meyarı deyil. |
| Alış aktı | Sətirdə təchizatçı və nağd ödəniş sahələri var. Qaralama/təsdiq, qiymət fərqi əlavəsi var. | Müştərinin istədiyi qismən faktiki qəbul və hər təchizatçı üzrə ayrı uzlaşma üçün statuslar genişlənməlidir. |
| Alışın təsdiqi | Demo/domain funksiyası təsdiqdə bütün akt sətirlərini anbara yazır və təchizatçı borcu yaradır. Backend `receive-purchase` bunu audit/idempotency ilə tranzaksiyada edir, amma tam aktı və bir anbarı qəbul edir. | Təsdiqli alış aktı, göndərilmiş mal və faktiki qəbulu ayrı hadisələr kimi ayırmaq; sətrə və təchizatçıya görə qismən qəbul etmək. |
| Borclar | `Payable` əsasən təchizatçı, sənəd ID-si, məbləğ və status saxlayır. | İlkin məbləğ, avans/nağd/bank ödənişləri, hissəli ödəniş, son tarix və bir ödənişi bir neçə borca bölmə üçün tam plan tələb olunur. |
| İcazələr | Direktor, layihə rəhbəri, sahə, anbar, təchizat, mühasib, satış rolları var. | Kim tələb yaradır, təsdiqləyir, qəbul edir, sərfiyyatı yoxlayır və maliyyəni bağlayır — server tərəfində ayrıca matris olmalıdır. |

MoySklad hesabının bu baxışında sənəd siyahıları və hesabatlar boş idi, bir “Основной склад” görünürdü. Buna görə interfeys davranışı və rəsmi funksiyalar yoxlanıb, real şirkət axını və status nümunələri isə təsdiqlənməyib.

### MoySklad terminlərinin CONSTRIX üçün tərcüməsi

- İstifadəçi linkindəki `#enter` **Оприходования** səhifəsinə düşür: ilkin/artıq qalıq düzəlişidir. Təchizatçıdan faktiki alış qəbulu isə **Закупки → Приемки** bölməsindədir.
- İstifadəçi linkindəki `#warehouseorder` **Волны отбора** — sifariş yığma dalğaları səhifəsinə düşür; “anbar sifarişi” deyil.
- Bu səbəbdən CONSTRIX naviqasiyasında **Təchizatçıdan qəbul**, **Qalıq düzəlişi** və **Daxili anbar sifarişi/köçürmə tələbi** ayrı anlayışlar olmalıdır.

## 3. İlkin biznes qaydaları

Bu hissədə müştərinin təsdiqlədiyi qərarlar sabit, həlli gözləyən məsələlər isə açıq göstərilir.

### Qalıq hesabı

MoySklad-da “mövcud” miqdar faktiki qalıq + gözlənilən mədaxil − rezerv kimi hesablanır. CONSTRIX-də fiziki sərbəst miqdarı hesabat və əməliyyat planlamasından ayırmaq təklif olunur:

- **Faktiki anbarda:** keçirilmiş və fiziki qəbul edilmiş material.
- **Rezerv edilmiş:** təsdiqli tələb/sifariş üçün saxlanmış material.
- **Fiziki sərbəst:** faktiki anbarda − rezerv edilmiş.
- **Gözlənilən:** təsdiqli sifariş və ya yolda olan qəbul; fiziki qalıq deyil.
- **Planlaşdırılmış tələbat:** smeta/QRP/mühəndis hesabı; nə stok, nə də sərfiyyatdır.
- **Məsul şəxsdə:** imza ilə anbardan çıxmış, amma layihə sərfiyyatı kimi təsdiqlənməmiş material.

Gözlənilən miqdar yalnız ayrıca “təminat planı” göstəricisində fiziki sərbəstə əlavə edilməlidir. Beləliklə, sahədə olmayan mal anbarda var kimi göstərilmir.

### Sənəd və audit qaydası

- Təsdiqlənmiş sənədin sətrləri səssiz redaktə/silmə ilə dəyişdirilmir; düzəliş səbəb, əvvəlki snapshot və əks hərəkətlə saxlanır.
- Stok yalnız faktiki qəbul, buraxılış, qaytarma, inventarizasiya düzəlişi və ya təsdiqli köçürmə kimi keçirilən hadisələrdə dəyişir.
- Hər kritik əməliyyat tenant, layihə, anbar, material, miqdar, vahid, edən/təsdiqləyən şəxs, vaxt, səbəb və mənbə sənədi ilə audit olunur.
- Server əməliyyatları tranzaksiyalı və təkrar sorğuya davamlı (idempotent) olmalıdır.

## 4. Hədəf iş axınları və statuslar

Status adları planlama səviyyəsindədir; yekun enum/API adları növbəti icra planlamasında müəyyənləşəcək.

### 4.1 Material tələbi və təminat bölgüsü

`Qaralama → Göndərilib → Rəhbər baxışında → Təsdiq / Rədd / Düzəlişə qaytarılıb → Təminat bölünüb → İcra edilir → Tam təmin olunub / Bağlanıb`

- Tələb layihə, iş sahəsi, tələb edən şəxs, material, vahid, miqdar, ehtiyac tarixi, təcililik və səbəb daşıyır.
- Rəhbər təsdiqdən əvvəl miqdar, təyinat anbarı və qeydi dəyişə bilməlidir; dəyişiklik tarixçədə görünür.
- Təklif olunan təminat əvvəlcə fiziki sərbəst anbar qalığına baxır, sonra icazəli layihə ehtiyatı, köçürmə və satınalma variantlarını göstərir.
- Bir tələb bir neçə mənbəyə bölünə bilər; hər hissənin anbarı, miqdarı və statusu ayrılıqda izlənir.
- Toplu təsdiqdə sistem qaydaya uyğun sifarişləri keçirir, bloklananları səbəbi ilə ayrıca saxlayır.

### 4.2 Satınalma sifarişi, alış aktı və faktiki qəbul

`Sifariş qaralaması → Rəhbər təsdiqi → Təchizatçıya sifariş → Göndərilib → Qismən qəbul / Tam qəbul → Təchizatçı və sətir üzrə uzlaşma → Bağlanıb`

- Bir alış aktında müxtəlif təchizatçıların sətirləri ola bilər; hər sətrin təchizatçısı, miqdarı, vahid qiyməti, məbləği, ödəniş qeydi və göndərən tərəf saxlanır.
- Qəbul sənədi faktiki gələn miqdarı, uyğunluq/çatışmazlıq, qəbul edən anbardar, anbar, vaxt və imzalı sübutu qeyd edir.
- Qismən qəbul edilmiş miqdar anbara yazılır; çatmayan miqdar aktı açıq saxlayır.
- Təchizatçı üzrə qəbul və borc digər təchizatçı sətrlərinin problemindən asılı olmayaraq uzlaşa bilər.
- Aktın təsdiqi ilə faktiki qəbul eyni düymə/sənəd kimi modellənmir. Aktın maliyyə cəmi və faktiki anbar qalığı ayrı vəziyyətlərdir.
- Çatışmazlıq sonradan gətirilə və ya rəhbərin təsdiqlədiyi, tarixçəli sənədli düzəlişlə bağlana bilər.

### 4.3 Anbarlar və transfer

`Tələb/qaralama → Təsdiq → Mənbədə rezerv → Göndərildi/yoldadır → Qismən qəbul / Uyğunsuzluq / Tam qəbul → Bağlanıb`

- Anbar qeydində unikal kod, ad, tip, layihə, valideyn yer, ünvan, məsul anbardar və aktivlik saxlanmalıdır.
- Planlaşdırılan struktur: mərkəzi → layihə → sahə → müvəqqəti saxlama. Eyni fiziki sahə üçün bir neçə anbar açılıb-açılmaması da ayrıca həll edilməlidir.
- Mənbə qalıq göndərişdə rezervdən azalır; təyinatın faktiki qalığı isə qəbul təsdiqində artır. “Yoldadır” ayrıca hesabatda qalır.
- Göndərən və qəbul edən anbardar hərəkətə ayrı təsdiq/imza verir. Qismən qəbul və uyğunsuzluq üçün səbəb və sübut tələb olunur.
- Layihələrarası transferdə mənbə layihənin sərbəst qalığı, rezervi və planlaşdırılmış tələbatı göstərilir; rəhbərin ayrıca qərarı və səbəb qeydi tələb olunur.

### 4.4 Sahəyə/material məsuluna verilmə və sərfiyyat

- Anbardan məsul şəxsə verilmə ayrıca “sərəncam/təhvil” sənədidir; anbardar və alan şəxs qəbul miqdarını və imzanı təsdiqləyir.
- Təhvildən sonra mal ümumi anbar qalığından çıxır, amma hələ layihənin faktiki sərfiyyatı sayılmır; məsul şəxsin üzərində qalıq kimi görünür.
- Məsul şəxs sərfiyyat miqdarını, iş/smeta sətrini, tarixi və sübutu daxil edir.
- Layihə rəhbəri və ya təyin edilmiş nəzarətçi faktiki sərfiyyatı təsdiqləyir; artıq material anbardan və ya məsul şəxsdən geri qaytarma sənədi ilə bağlanır.
- Plan tələbatı, qəbul edilmiş miqdar, məsul şəxslərdə qalıq, təsdiqli sərfiyyat və geri qaytarma bir hesabatda ayrı sütunlarla görünür.

### 4.5 İnventarizasiya, itki/zədə və qaytarmalar

- İnventarizasiya hər anbar üzrə sistem qalığı və sayılmış faktiki qalığı müqayisə edir; fərq yalnız təsdiqli düzəliş sənədi ilə stoka yazılır.
- Təchizatçıya geri qaytarılan material poddon/taradan ayrı sənəd və reyestrdə aparılır; stok əks yazılışı və maliyyə təsiri ayrıca təsdiqlənir.
- Poddon izləməsində təchizatçı, layihə, cari anbar/məsul şəxs, alınma, yolda, qaytarılma, müddət və qəbul sənədi saxlanır.
- Poddon itkisi/zədəsi aktı sənədləşdirilir; avtomatik borc və ya cərimə yaratmır.

### 4.6 Borc və ödəniş

- Hər borc alış aktı sətri və təchizatçı ilə əlaqələnir; müxtəlif təchizatçıların bağlanması müstəqildir.
- Təchizat əməkdaşı ilkin ödəniş məlumatını daxil edir, maliyyə faktiki bank/kassa əməliyyatını təsdiqləyir.
- Borca yalnız təsdiqlənmiş ödəniş tətbiq olunur. Sistem ən köhnə borca bölgü təklif edə bilər, yekun bölgünü mühasib təsdiqləyir.
- Bir ödəniş bir neçə borca paylana bilər; avans, nağd, bank, qalıq, son tarix və gecikmə ayrı görünür.
- Geri qaytarılan malların borcdan silinməsi, kredit qalığı və ya ayrıca geri ödəniş modeli biznes qərarıdır; avtomatik fərz edilmir.

## 5. Rol və icazə matrisi — ilkin variant

| Əməliyyat | Təklif olunan icraçı | Təsdiq edən |
|---|---|---|
| Material tələbi yaratmaq | Sahə mühəndisi / layihə üzrə səlahiyyətli şəxs | Şirkət rəhbəri; delegasiya edilən limitlər sonra qərarlaşır |
| Sifarişə düzəliş və təminat bölgüsü | Təchizat; rəhbər redaktə edə bilər | Şirkət rəhbəri |
| Təchizatçı sifarişi və alış aktı hazırlamaq | Təchizat | Rəhbər sifariş mərhələsində; qəbul anbardar tərəfindən fakt üzrə |
| Anbar qəbulu | Qəbul edən anbardar | Sənəd üzrə ikinci tərəf/qəbul rolu; mübahisəli akt rəhbərə |
| Anbar transferi | Göndərən anbardar / təchizat | Qəbul edən anbardar; layihələrarası transfer rəhbər |
| Sahəyə material təhvili | Anbardar | Materialı alan məsul şəxs |
| Faktiki sərfiyyat | Material məsulu | Layihə rəhbəri/nəzarətçi |
| İnventar fərqinin düzəlişi | İnventar komissiyası/anbardar | Rəhbər və ya delegasiya olunmuş nəzarətçi |
| Ödəniş və borc bölgüsü | Təchizat ilkin məlumatı; mühasib əməliyyat | Maliyyə təsdiqi |
| Təchizatçı qaytarması və poddon aktı | Anbardar/təchizat | Rəhbər; təchizatçı qəbulu ayrıca sübut olunur |

Bu matris qəbul meyarı deyil, planlama başlanğıcıdır. İstifadəçi rolu, məbləğ limiti və təcili istisnalar serverdə tətbiq olunmazdan əvvəl təsdiqlənməlidir.

## 6. Mərhələlər və çıxış meyarları

| Mərhələ | Əhatə | Mərhələnin qəbul meyarı |
|---|---|---|
| **A — Sözlük və qayda qərarları** | “Mədaxil”, alış aktı, sifariş, rezerv, sərbəst, məsul şəxsdə qalıq, geri qaytarma terminləri; rol matrisi; imza/sənəd tələbləri. | Eyni hadisə müxtəlif ekranlarda fərqli status və ya qalıq mənası daşımır; açıq qərarlar sahibi ilə siyahıdadır. |
| **B — Anbar əsasları və qalıq** | Anbar iyerarxiyası, material/anbar qalıqları, rezervlər, gözlənilənlər, tarixçə, qalıq hesabatı, kanonik stok yazılışı. | Hər material/anbar üzrə faktiki = açılış + təsdiqli mədaxil + daxil transfer − məxaric − çıxan transfer; rezerv və yolda olan ayrıca göstərilir. |
| **C — Alış və qismən faktiki qəbul** | Sifariş/alış aktı, təchizatçı və sətir əlaqəsi, anbar qəbulu, qismən qəbul, çatışmazlıq, düzəliş, təchizatçı üzrə müstəqil uzlaşma. | Qaralama/təsdiq stok yaratmır; yalnız faktiki qəbul edilən sətir miqdarı stok yaradır; təkrar sorğu ikinci stok/borc yaratmır. |
| **D — Transfer və daxili tələb** | Rəhbər paneli, təminat bölgüsü, rezerv, yolda, qismən/tam qəbul, uyğunsuzluq, layihələrarası nəzarət. | Göndərilən və qəbul edilən miqdar ayrı uzlaşır; yolda olan miqdar iki anbarda eyni anda mövcud görünmür. |
| **E — Məsul şəxsdə qalıq və faktiki sərfiyyat** | İmza ilə təhvil, məsul şəxs uçotu, sərfiyyat, layihə təsdiqi, qalıq qaytarma. | Təhvil sərfiyyat sayılmır; yalnız təsdiqli sərfiyyat layihə faktına keçir; məsul şəxsdə qalıq hesabatla uzlaşır. |
| **F — Qaytarmalar, poddon, maliyyə uzlaşması** | Təchizatçıya qaytarma, ayrıca poddon reyestri, borclar, hissəli ödəniş və bölgü təsdiqi. | Qaytarma/poddon məlumatı qarışmır; maliyyə təsdiqi olmayan ödəniş borcu azaltmır; əks əməliyyat ilkin tarixi saxlayır. |
| **G — Tam hesabat və əməliyyat qəbul sınağı** | Layihə/anbar/material kəsimi, audit, rol yoxlaması, mobil/çap görünüşü, köhnə məlumat miqrasiyası. | Qəbul sınaqları bütün status yollarını, qismən ssenariləri, rolları və hesabat uzlaşmasını əhatə edir. |

**Asılılıq:** B mərhələsinin ledger/qalıq qərarları C–F mərhələlərinin hamısının əsasını təşkil edir. C və D-dən əvvəl stok modelini dəyişmək risklidir; buna görə UI maketindən əvvəl data/status modelinin sabitləşdirilməsi vacibdir.

## 7. İlkin planlamada bağlanmalı qərarlar

| Qərar | Başlanğıc təklifi | Nəyə təsir edir |
|---|---|---|
| “Mədaxil” termini | Təchizatçıdan qəbul ilə qalıq düzəlişini ayrı adlandırmaq. | Menyu, sənəd növü, hüquqlar və hesabat. |
| “Sərbəst qalıq” | Fiziki sərbəst = faktiki − rezerv; gözlənilənlər ayrıca. | Təminat təklifi və çatışmazlıq qərarı. |
| Anbar iyerarxiyası | Mərkəz → layihə → sahə → müvəqqəti yer; real valideyn əlaqəsi. | DB, naviqasiya və qalıq filtrləri. |
| Sifariş təsdiqi | Rəhbər ilkin qaydada təsdiqləyir; limit/delegasiya sonrakı qərardır. | Təsdiq paneli və növbə yükü. |
| Alış aktının bağlanması | Təchizatçı+sətir üzrə tam qəbul/uzlaşma. | Status, borc, qismən qəbul və multi-vendor. |
| Alış aktı “nağd ödəniş” | Mövcud Excel sütunu saxlanır, amma əsl ödəniş sənədindən ayrı ilkin məlumatdır. | Maliyyə borcu və bank/kassa təsdiqi. |
| Təchizatçıya qaytarma hesablaşması | Avtomatik seçim edilmir; qaytarma, borcdan silmə, kredit qalığı variantları açıq qalır. | Maliyyə hesabı və qaytarma statusu. |
| Poddonun son tarixi | Təchizatçı və ya çatdırılma üzrə standart ayrıca seçilməlidir. | Xəbərdarlıq və gecikmə göstəricisi. |
| Barkod/QR | Məcburi MVP şərti deyil; mövcud QR/partiya imkanları inteqrasiya üçün qiymətləndirilir. | Mobil UX, avadanlıq və qəbul tempi. |

## 8. İlkin plan bitəndən sonra növbəti planlama nə olacaq?

İlkin planın biznes qaydaları təsdiqləndikdən sonra ayrıca **icraya hazırlıq planı** hazırlanacaq. Bu, aşağıdakı konkret artefaktları verəcək:

1. **Kod və DB təsir xəritəsi:** hansı mövcud modellər saxlanır, genişlənir, birləşir və ya köçürülür; `Stock`/`Movement`/`StockLot` üçün bir kanonik yazılış qaydası.
2. **Təsdiqli vəziyyət diaqramları:** material tələbi, alış aktı/qəbul, transfer, məsul şəxs, sərfiyyat, inventarizasiya, qaytarma və ödəniş bölgüsü üçün icazəli keçidlər.
3. **Ekran spesifikasiyası və wireframe-lər:** əvvəlcə Anbar icmalı, rəhbər sifariş paneli, alış aktı/qəbul detalları, transfer, məsul şəxsdə material, qaytarma/poddon və borclar.
4. **API və tranzaksiya müqaviləsi:** endpoint, server validation, idempotency key, audit snapshot, sətir səviyyəli qismən qəbul, permission, error case.
5. **Miqrasiya və uyğunluq planı:** mövcud alış aktlarının qaralama/təsdiq statusu, açıq borc, `Movement`, `StockLot` və mümkün dublikat qalıqların uzlaşdırılması; geri dönüş strategiyası.
6. **Prioritetli backlog:** kiçik story-lər, asılılıqlar, texniki risk, qəbul sınağı və buraxılış mərhələsi. Qiymət/tarixli təxmin yalnız həcm və açıq qərarlar bağlandıqdan sonra veriləcək.
7. **UAT ssenariləri:** qismən qəbul, iki təchizatçıdan biri üzrə gecikmə, təkrar klik, layihələrarası transfer, anbardar uyğunsuzluğu, məsul şəxsdə qalıq, təsdiqsiz ödəniş, poddon itkisi və geri qaytarma.

### Növbəti planlama üçün təklif olunan MVP

İlk kodlaşdırma paketini bütün 12 alt bölməni birdən qurmaq əvəzinə, tam izlənə bilən bir zəncirlə məhdudlaşdırmaq təklif olunur:

`Tələb → rəhbər təsdiqi → təminat seçimi → alış aktı/sifariş → faktiki qismən qəbul → kanonik anbar qalığı və audit → qalıq hesabatı`

İkinci paketdə anbarlararası təsdiqli transfer və yolda/qismən qəbul; üçüncü paketdə məsul şəxsdə material və faktiki sərfiyyat; sonrakı paketdə qaytarma/poddon və borcların hissəli ödəniş bölgüsü işlənə bilər. Bu ardıcıllıq tələbat və real stok rəqəmlərini əvvəl quraraq onları sonrakı modullar üçün əsas edir.

## 9. Planlama mərhələsinin tamamlanmış sayılma şərtləri

- Açıq qərar cədvəlində hər bənd üçün cavab və qərar sahibi var.
- Status maşınları və rol matrisi müştəri tərəfindən nəzərdən keçirilib.
- MVP-nin daxilində və xaricində olan işlər yazılıb.
- Mövcud funksiyadan reuse, genişləndirmə və yenidənqurma sərhədi müəyyən edilib.
- Ekranların prioritet siyahısı və data/API təsir xəritəsi hazırdır.
- Miqrasiya, idempotency, audit, tenant/rol təhlükəsizliyi və UAT sınaqları plana daxildir.

Bu nöqtədən sonra növbəti mərhələ icra backlog-unu və ekran/API spesifikasiyasını təsdiqləməkdir; kod dəyişiklikləri həmin icra planı əsasında ayrıca aparılacaq.
