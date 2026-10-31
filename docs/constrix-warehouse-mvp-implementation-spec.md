# CONSTRIX — Anbar MVP üçün icraya hazırlıq spesifikasiyası

**Versiya:** 0.1\
**Əhatə:** MVP planı, məlumat/endpoint sərhədləri və qəbul ssenariləri\
**Status:** Qəbul/dispute, stok reconciliation, bilateral transfer və layihə təyinatı kodlanıb; migration 003–007 lokal `afez_db`-yə tətbiq edilib və `cbc18a3` commit-i `origin/main`-ə push olunub. Test tenant UAT-ı və real snapshot reconciliation açıqdır; ardıcıllıq [növbəti plan sənədində](./constrix-warehouse-next-plan.md) verilib.\
**Əlaqəli sənəd:** [İlkin plan](./constrix-procurement-warehouse-plan.md)

## 1. Bu spesifikasiya nəyə xidmət edir

İlkin biznes planından sonra ilk işlək buraxılışı kodlaşdırmağa hazırlamaq. Fokus bir zəncirdədir:

`Material tələbi → rəhbər təsdiqi → təminat → alış aktı → faktiki qismən qəbul → stok və audit → qalıq hesabatı`

Bu buraxılış anbarın bütün gələcək imkanlarını əhatə etmir. Anbarlararası təsdiqli transfer, məsul şəxsdə material, faktiki sərfiyyat, poddon, geri qaytarma və borc bölgüsü növbəti buraxılış planlarında qalır. Bunlar üçün mövcud data modeli qabaqcadan genişlənə bilən olmalıdır.

## 2. Təsdiqlənmiş tələblər və hələ seçilməmiş qaydalar

### Müştəri dosyesində təsdiqlənənlər

- Rəhbər təsdiqi olmadan sifariş icraya keçmir; rəhbər təsdiqdən qabaq sifarişi redaktə edə bilər.
- Təsdiqlənmiş alış aktı təkbaşına anbar qalığı yaratmır; faktiki qəbul stoku dəyişir.
- Qismən qəbul edilmiş miqdar stokda görünür; akt uzlaşma bitənə qədər açıq qalır.
- Eyni aktda bir neçə təchizatçı ola bilər; hər təchizatçının uzlaşması ayrıca bağlana bilər.
- Təsdiqlənməmiş ödəniş borcu azaltmır.
- Qalıq, rezerv və sərbəst miqdar ayrı göstəricilər olmalıdır.

### Kodlamadan əvvəl sahib tərəfindən seçilməli olanlar

| Qərar | MVP üçün başlanğıc fərziyyəsi | Təsiri |
|---|---|---|
| Fiziki sərbəst qalıq | `faktiki qalıq − aktiv rezerv`; gözlənilən mədaxil fiziki qalıq deyil. | Təminat təklifi və qalıq hesabatı. |
| Tələbi təsdiqləyən | Default şirkət rəhbəri; delegasiya MVP-yə daxil deyil. | Endpoint role check və panel. |
| Qəbul sənədinin sahibi | Hər faktiki qəbul ayrıca tarixçəli receipt hadisəsidir. | DB modeli, partial receipt və audit. |
| Çatışmazlıq səbəbi | Qismən qəbul edilən çatışmayan miqdar açıq qalır; yazılı düzəlişlə silinərsə səbəb tələb olunur. | Bağlanma qaydası. |
| Alış aktındakı “nağd ödəniş” | İlkin bəyan edilən məlumatdır; maliyyə təsdiqləyənə qədər ödəniş deyil. | Mövcud serverdəki `cashPaid` bloklamasının əvəzlənməsi. |
| Layihə üçün mənbə anbar bölgüsü | Hər qəbul sətri bir anbar seçir; bir sətri bir neçə anbara bölmək MVP-də tələb olunmur. | Receipt line UI və stok hesabı. |

## 3. Mövcud texniki axın və dəyişiklik nöqtələri

### Hazırda işləyənlər

1. `src/pages/PurchaseActs.tsx` qaralama alış aktı yaradır və qəbul anbarı seçdirir.
2. `src/store.tsx` təsdiq zamanı `POST /api/act-workflows/:id/receive-purchase` çağırır. Uğurdan sonra `reload()` ilə server məlumatı yenidən oxunur.
3. `backend/src/records/act-workflows.service.ts` `receivePurchase()` server tranzaksiyası, tenant scope, idempotency açarı, audit və `OperationReceipt` istifadə edir.
4. Hazırkı `receivePurchase()` bütün alış aktı sətirlərini seçilmiş bir anbara tam miqdarda keçirir; `PurchaseAct`-ı təsdiq edir; `Stock`, `Material`, `Movement`, `StockLot` və təchizatçı üzrə `Payable` yaradır.
5. `src/syncBooks.ts` adi qaralama və qeydləri ümumi CRUD API-yə sinxronlayır. Təsdiq/qəbul kimi kritik əməliyyatlar ayrıca endpoint-dən keçməlidir.

### MVP-də dəyişməli olanlar

**İcra statusu:** Qismən qəbul, receipt tarixçəsi, dispute resolution (əvəz mal, sənədli supplier krediti, rəhbər qalıq bağlama) və read-only reconciliation görünüşü kodlanıb. Supplier üzrə yekun bağlanma paneli, opening balance reconciliation və UAT hələ açıqdır.

- **Bütün aktı qəbul et** əməliyyatını **qəbul hadisəsi əlavə et** əməliyyatına çevir: receipt yalnız bu dəfə faktiki alınan sətir miqdarını qəbul edir.
- Alış aktının ümumi statusu `qaralama/təsdiq` ilə məhdud qalmamalıdır. Qismən qəbul və uzlaşma üçün vəziyyət görünməlidir; supplier/line statusu ümumi akt statusundan ayrıca saxlanmalıdır.
- Bir receipt hadisəsi DB-də oxuna bilən sənəd kimi saxlanmalıdır. `OperationReceipt` idempotency və bərpa üçün qalır, biznes tarixçəsinin yeganə görünən mənbəyi olmur.
- Qəbul sətirlərində `orderedQty`, `receivedQty`, `rejected/disputedQty` və `remainingQty` serverdə yoxlanmalıdır. `remainingQty` receipt hadisələrinin cəmindən hesablanmalı və ya eyni tranzaksiyada yenilənən snapshot olmalıdır.
- Eyni akt/supplier üzrə açıq kreditor qalığı təkrar receipt zamanı kopyalanmamalı: qəbul olunmuş məbləğ supplier hesabına əlavə olunmalıdır. Ödəniş təsdiqi ayrıca maliyyə əməliyyatıdır.
- `cashPaid` daxil edilmiş dəyər fiziki qəbulun qarşısını almamalıdır. Bu məlumat pending maliyyə yoxlamasına düşməlidir və borc yalnız yoxlanmış ödənişdə azalmalıdır.
- `Stock`, `Movement`, `StockLot` və receipt sətirlərinin əlaqəsi bir tranzaksiyada yazılmalıdır. Lot əməliyyatı eyni miqdarı ikinci dəfə stok kimi artırmamalıdır.

## 4. Məntiqi məlumat modeli

Bu siyahı schema qərarı üçün başlanğıcdır; növbəti DB review-də sütunlar, relation və tenant tələbləri sabitlənəcək.

| Obyekt | Əsas məlumat | Məqsəd |
|---|---|---|
| `Location` genişləndirilməsi | `parentId`, kod, tip, layihə, ünvan, məsul şəxs, aktivlik | Mərkəzi/anbar/sahə/müvəqqəti yerləri və məsuliyyəti ayırmaq. |
| `MaterialRequest` genişləndirilməsi | tələb tarixi, prioritet, submit/approve/reject, approver, səbəb, rezerv mənbələri | Layihə ehtiyacından rəhbər təsdiqinə qədər iz. |
| `PurchaseActLine` genişləndirilməsi | supplier/material ID, qəbul edilmiş cəm və ya line state, düzəliş əlaqəsi | Təchizatçı və faktiki qəbulun sətrə bağlanması. |
| `PurchaseReceipt` | akt, anbar, vaxt, qəbul edən, açar/istinad, sübut ID-ləri, status | Təkrar qəbulları ayrıca saxlayan hadisə. |
| `PurchaseReceiptLine` | akt sətri, bu qəbul miqdarı, uyğunsuzluq/çatışmazlıq, səbəb | Qismən qəbul və sətir auditini izləmək. |
| `StockReservation` (və ya ümumi `Reservation`) | material, anbar, mənbə tələb/sifariş, miqdar, status | Fiziki qalıqdan rezervi ayrıca hesablamaq. |
| `Movement` əlaqələri | mənbə növü, mənbə ID-si, mənbə sətri, reversal ID-si | Sətir/sənəd üzərindən hər stok dəyişikliyini izləmək; legacy `from` mətni saxlanıla bilər. |
| `Payable` əlaqələri | akt, supplier ID/snapshot, due date, ilkin məbləğ, status | Akt/supplier üzrə müstəqil borcu və sonradan ödənişləri bağlamak. |
| `PaymentAllocation` (sonrakı buraxılış) | ödəniş, borc, bölünmüş məbləğ, təsdiqləyən | Bir ödənişi bir neçə borca ayırmaq; MVP-də borc yaratma və manual maliyyə təsdiqi sərhədi qorunur. |

### Stokun invariantları

- `Stock(material, location)` cari qalıq snapshot-ıdır; stok tarixçəsi `Movement` və ona bağlı qəbul/transfer sənədidir.
- Qəbul əməliyyatı: `stock += qəbul edilmiş miqdar`; `lot.qty += eyni miqdar`; yalnız bir dəfə tətbiq olunur.
- Mövcud stokla uyğunluq: `Stock.qty` və həmin material/anbar üzrə müsbət lotların cəmi reconciliation qaydasına görə uyğun olmalıdır. Lot izlənməyən legacy açılış qalıqları ayrıca `legacy/untracked` mənbəsi kimi saxlanıla bilər.
- `Material.qty` ümumi cəmi saxlayırsa, receipt/transfer tranzaksiyası onu `Stock` anbar cəmlərinə uyğun yeniləyir; bu snapshot qaydası serverdə tək yerdə olmalıdır.
- Qəbul edilmiş miqdar sifariş miqdarını aşa bilməz; material vahidi sifariş və qəbul sənədində eyni olmalıdır.
- Təsdiqlənmiş əməliyyat generic PATCH/DELETE ilə ləğv edilmir; səbəbli reversal yaradır.

## 5. MVP API müqaviləsi — təklif

Mövcud generic `/api/purchase-acts` qaralama CRUD-u üçün qala bilər. Stok/borc dəyişikliyi yalnız xüsusi command endpoint-lərindən keçməlidir.

### Mövcud endpoint-in genişləndirilməsi

`POST /api/act-workflows/:actId/receive-purchase`

Təklif olunan body:

```json
{
  "key": "uuid-or-operation-key",
  "locationId": "warehouse-id",
  "receivedAt": "2026-11-01T09:30:00.000Z",
  "lines": [
    {
      "purchaseActLineId": "purchase-line-id",
      "acceptedQty": "12.000",
      "disputedQty": "0.000",
      "note": "Qaiməyə uyğundur",
      "proofFileIds": []
    }
  ]
}
```

Server bu əməliyyatı serializable tranzaksiyada etməlidir:

1. İstifadəçi/şirkət/rol və anbarın şirkətə aid olmasını yoxla.
2. `key`-i həmin şirkət və hesabla yoxla; eyni açarın fərqli body ilə təkrarı `409` olmalıdır.
3. Aktın aktiv vəziyyətini, hər sətrin material/supplier/ordered quantity əlaqəsini tap.
4. Əvvəlki receipt cəmini oxu; qalan miqdarı hesabla və over-receipt-i rədd et.
5. Yalnız `acceptedQty > 0` qədər `PurchaseReceiptLine`, `Movement`, `Stock`, `StockLot` və supplier üzrə borc təsirini yaz.
6. `disputedQty`/çatışmazlıq üçün stok yaratma; səbəb/sübut yoxlamasını tətbiq et.
7. Akt və supplier/line statuslarını qalan miqdara görə yenilə; akt açıq qalırsa qismən qəbul kimi görünür.
8. Audit snapshot-u və `OperationReceipt` yaz; cavabda receipt ID, accepted və remaining cəmləri qaytar.

Body hash-i `actId + locationId + normalized lines` və müştəri `receivedAt` göndəribsə həmin tarixdən qurulmalıdır. Server default vaxtı özü yaradırsa, retry zamanı yeni server vaxtı idempotency hash-ini dəyişməməlidir.

### Yeni command-lər

| Endpoint | İstifadə | Qaydalar |
|---|---|---|
| `POST /api/requests/:id/submit` | Qaralama tələbi rəhbərə göndərir. | Sahiblik, layihə, material, vahid və miqdar yoxlanır. |
| `POST /api/requests/:id/approve` | Tələbi təsdiqləyir. | Default direktor; qərar və dəyişən sahələr auditə düşür. |
| `POST /api/requests/:id/return` | Düzəlişə qaytarır. | Səbəb tələb olunur. |
| `POST /api/requests/:id/reject` | Rədd edir. | Səbəb tələb olunur; stok/borc dəyişmir. |
| `POST /api/act-workflows/:id/close-purchase-supplier` | Supplier üzrə uzlaşmış hissəni bağlayır. | Supplier sətirləri qalan miqdarla bağlana bilməz; səbəb/sənədli düzəliş tələb edilir. |
| `GET /api/purchase-acts/:id/receipts` | Receipt tarixçəsini göstərir. | Tenant və role scope; maliyyə sahələri anbardar görünüşündən redaktə olunur. |

Bu endpoint adları/ayrı controller seçimi DB və router review-dən sonra sonlaşdırılacaq.

## 6. UI işi və səhifələr

### 6.1 Tələb və rəhbər paneli

- Filtrlər: layihə, tarix, təcililik, status, tələb edən.
- Sətirlər: material/vahid, tələb miqdarı, fiziki sərbəst qalıq, rezerv, gözlənilən mədaxil, seçilmiş təminat bölgüsü.
- Rəhbər təsdiqdən əvvəl material, miqdar, mənbə anbarı və qeydi redaktə edir; əvvəlki dəyər tarixçədə saxlanır.
- Toplu təsdiq yalnız serverdə uğurlu olan qeydləri keçirir; problemli olanlar xəta səbəbi ilə siyahıda qalır.

### 6.2 Alış aktı detail və qəbul paneli

- Akt başlığı: layihə/obyekt, status, supplier üzrə uzlaşma xülasəsi.
- Material cədvəli: supplier, material, vahid, sifariş miqdarı, əvvəl qəbul, bu dəfə qəbul, qalıq, vahid qiyməti, məbləğ, çatışmazlıq/qüsur səbəbi.
- Qəbul paneli: anbar, qəbul edən, tarix/vaxt, qaimə/şəkil faylları, supplier imza sübutu (rəqəmsal imza imkanı yoxdursa imza edilmiş sənəd faylı).
- Gözlənilən/qaralama qəbul stok hesabatına düşmür. Yalnız server təsdiqlədikdən sonra ekran yenilənir.
- Supplier panelində qəbul edilən məbləğ, açıq miqdar və maliyyə təsdiqi gözləyən ödəniş ayrıca görünür.

### 6.3 Anbar qalığı ekranı

Mövcud `Warehouse.tsx` Qalıq/Kritik tabı genişləndirilir; yeni səhifə yaratmaq qərarı UX maketində veriləcək.

- Sütunlar: layihə, anbar, material, vahid, faktiki, rezerv, fiziki sərbəst, yolda/gözlənilən, məsul şəxsdə, son hərəkət.
- Filtrlər: layihə, anbar növü, material, status, mənfi/az qalıq.
- Sətirdən açılan hərəkət tarixçəsi `Movement` → receipt/transfer/issue source sənədinə gedir.

## 7. Server-side icazələr və sahə redaksiyası

Mövcud rol enum-u (direktor, layihə rəhbəri, sahə, anbar, təchizat, mühasib, satış) saxlanır; area-level check-i line-level authorization tamamlamalıdır.

| Command | İcazə |
|---|---|
| Tələb qaralamasi yaratmaq/redaktə | Layihəyə üzv, sahə mühəndisi və səlahiyyətli təchizat; yalnız qaralama. |
| Tələb təsdiqi/redaktəsi | Direktor; qəbul edilmiş təsdiq qərarı generic update ilə dəyişmir. |
| Alış aktı qaralaması | Təchizat və direktor; tenant və supplier/material reference serverdə yoxlanır. |
| Faktiki qəbul | Həmin şirkətin anbardar/təchizat rolu; direktor istisna səlahiyyəti. Qəbul edən və operator ayrı saxlanır. |
| Supplier borcuna maliyyə təsiri | Qəbul hadisəsindən yalnız açıq kreditor yaranır; payment təsdiqi yalnız mühasib/direktor. |
| Qiymət və borc sahəsi | Sahə/anbardar üçün yalnız işi görmək üçün vacib sahələr; unit price/net/debt/payment default gizlidir. |

Hər resource reference-in (`projectId`, `locationId`, `materialId`, `supplierId`, `lineId`, file ID) eyni tenant-a aidliyi backend-də yoxlanır. Frontend düyməni gizlətmək icazə yoxlamasını əvəz etmir.

## 8. Miqrasiya və köhnə məlumatlar

- Köhnə `PurchaseAct.status = tesdiq` qeydləri yenidən qəbul edilmir. Onların `OperationReceipt` əlaqəsi yoxdursa `legacyConfirmed` kimi işarələnməsi və stok təsirinin əl ilə uzlaşdırılması planlanır.
- Mövcud `Payable.poId` bəzən akt nömrəsi, bəzən akt ID-si ilə bağlıdır; migration ikisini də resolve edib ayrıca canonical `purchaseActId` relation yaratmalıdır.
- Mövcud təsdiqlənmiş aktın qəbul edilmiş miqdarı avtomatik receipt hadisəsi kimi yaradılmır, çünki tam sübut/miqdar məlumatı olmaya bilər. Həmin məlumatlar legacy snapshot/unknown statusda qalır.
- Köhnə `Stock`/`Movement` və `StockLot` cəmləri tenant/material/anbar üzrə reconciliation report ilə müqayisə olunur; səssiz düzəliş edilmir.
- Migration dry-run nəticəsi saylar, fərqlər, resolve olunmayan supplier/material və manual baxış tələb edən aktları çıxarır; real yazı ayrıca, versiyalı migration olacaq.

## 9. MVP qəbul ssenariləri

1. Direktor təsdiqləmədən sahə/material tələbi sifarişə və stok əməliyyatına çevrilmir.
2. Rəhbər sifarişi təsdiqdən qabaq dəyişir; audit ilkin və son dəyəri göstərir.
3. İki supplier-li aktda supplier A tam qəbul olunur, supplier B hissəli qalır; A uzlaşır və B açıq qalır.
4. 100 vahid sifarişdən 60 qəbul edilir: stok/lot/movement/payable yalnız 60 vahidə uyğun yaranır; 40 qalıq görünür.
5. Eyni `key` və body təkrar çağırışı ikinci receipt/stok/borc yaratmır; eyni key fərqli body ilə `409` verir.
6. Qəbul miqdarı qalan sifariş miqdarını aşarsa tranzaksiya tam rədd olur və heç bir cədvəl dəyişmir.
7. Mənfi və sıfır qəbul miqdarı, başqa tenant material/anbar/sətir/faylı rədd olunur.
8. Receipt uğursuz olarsa stock, lot, movement, payable, receipt və statuslar qismən yazılmır.
9. `cashPaid` məlumatı qəbul hadisəsini dayandırmır; maliyyə təsdiqlənənədək borc qalıq məbləği azaltmır.
10. Məxfi qiymət və borc sahələri anbardar/sahə roluna API cavabında qaytarılmır.
11. Qalıq hesabatı `Stock` cəmi, qəbul/transfer/məxaric hərəkətləri və rezervi bir-biri ilə uzlaşdırır.
12. Legacy təsdiqli aktı təkrar qəbul etmək mümkün deyil; unresolved legacy akt xüsusi manual uzlaşma siyahısında görünür.

## 10. İcra sırası

| Addım | Nəticə | Asılılıq |
|---|---|---|
| 1. Qısa biznes qərarları və statusların təsdiqi | Mədaxil terminləri, qalıq formulu, qəbul edən rol, düzəliş qaydası. | Bu sənəddəki 2-ci bölmə. |
| 2. Schema/API design review | Prisma relation, unique constraints, tenant scope, DTO/validation, audit və migration dry-run dizaynı. | Addım 1. |
| 3. Backend qismən qəbul command-i | Receipt tarixçəsi, line-level quantity, transaction, idempotency, payable accrual. | Addım 2. |
| 4. UI qəbul və tarixçə | Qəbul drawer/detail, qalan miqdar, supplier statusları, xəta göstərimi. | Addım 3. |
| 5. Qalıq/reconciliation paneli | Faktiki/rezerv/sərbəst/yolda göstəricilər və source drill-down. | Addım 3. |
| 6. Tələb və rəhbər təsdiqi | Server enforced submit/approve/reject/return, toplu təsdiqdə partial success. | Qalıq göstəriciləri dəqiqləşəndən sonra. |
| 7. UAT və miqrasiya dry-run | Test tenant-dan başqa, istifadəçi seçdiyi test data; production write-dan əvvəl diff və reconciliation. | Addımlar 3–6. |

Hər addım ayrıca PR/commit ölçüsündə saxlanmalıdır. Production hesabında məlumat yazan migration əvvəlcə dry-run nəticəsi ilə nəzərdən keçirilməlidir.

## 11. Hazırkı kod dilimi və sərhədlər

İlk işlək dilim aşağıdakı kod dəyişikliklərini əhatə edir:

- `PurchaseActLine.receivedQty` ilə qəbul edilmiş cəm saxlanır; akt statusu qaralama/qismən/tamamlandı/ləğv edildi vəziyyətlərini göstərə bilir.
- `PurchaseReceipt` və `PurchaseReceiptLine` hər faktiki qəbulu, anbarı, vaxtı, qəbul edəni və sətir miqdarını ayrıca tarixçəyə yazır.
- Mövcud `receive-purchase` command-i artıq sətir üzrə faktiki miqdar qəbul edir; qalıq sifariş miqdarından artıq qəbul tranzaksiyanı rədd edir.
- Hər qəbulda yalnız həmin dəfə qəbul edilən miqdar `Stock`, `Material`, `Movement`, `StockLot` və supplier borcuna təsir edir. Təkrar sorğular üçün body hash idempotent saxlanır.
- Alış aktı ekranı qalıq miqdarı və qəbul tarixçəsini göstərir. Qəbul input-u sıfırdan başlayır ki, istifadəçi faktiki miqdarı özü daxil etsin.
- Tam qəbulun geri ləğvi bütün həmin akt qəbullarının stok/lot/borc yazılışlarını yoxlayır; borc ödənibsə və ya stok istifadə edilibsə ləğv rədd olunur. Əməliyyat aktı “Ləğv” statusuna keçir.
- Reversal səbəbi və icra edən şəxs receipt tarixçəsində görünür; migration 003–007 lokal DB-yə tətbiq edilib. Başqa mühitlərin migration statusu ayrıca yoxlanmalıdır.

Bu dilim hələ tam buraxılışa hazır deyil. Əvəz mal qəbulunda stoka daxil olur, borc yaratmır və mübahisəni bağlayır; sənədli supplier krediti maliyyə təsdiqindən sonra mənfi açıq payable yaradır; qalıq miqdarı direktor səbəb və təsdiqlə bağlaya bilər. Supplier üzrə yekun bağlanma, ödəniş bölgüsü, açılış qalığı reconciliation, material tələbi/təsdiq zənciri, rol redaksiyasının tam yoxlanması və legacy dry-run növbəti mərhələdədir.

### Növbəti mərhələ: test-tenant UAT və data reconciliation

İndi hazırlanmalı olan növbəti planlama paketi:

1. **Schema və migration review:** tenant əlaqələri, unikal idempotency və indekslər, köhnə `tesdiq` aktların statusu, migration dry-run və geri dönüş.
2. **Supplier və maliyyə uzlaşması:** qəbul/borc/kredit yekun paneli, supplier üzrə qalıqlar, nağd ödəniş sənədinin maliyyəyə ötürülməsi və borcun akt/supplier üzrə yığılma qaydası.
3. **UI/permission review:** anbardar və təchizat rolunun görəcəyi qiymət/borc sahələri, qəbulun kim tərəfindən və hansı tarixlə təsdiqi, əlavə fayl/şəkil sübutu, dispute endpoint-lərin rola görə yoxlanması.
4. **Qalıq uzlaşma paketi:** `Stock`, `Movement`, `StockLot` və `Material.qty` arasındakı legacy fərqləri; qəbul edilən miqdarın hesabat və partiyada eyni mənbədən görünməsi.
5. **UAT checklist:** ilk qismən qəbul, ikinci qəbul, tamamlama, iki supplier-dən biri gecikəndə qalıq, eyni key replay, fərqli body ilə replay, over-receipt, ödənmiş borcla reversal, anbardan artıq istifadə edilmiş lotla reversal.
6. **Backlog parçalanması:** database migration, backend command, UI/history, report/reconciliation və rol redaksiyası üçün ayrıca tapşırıqlar və asılılıqlar.

Migration 003–007 yalnız konfiqurasiya olunmuş lokal `afez_db`-yə tətbiq edilib; production və müştəri tenant-a toxunulmayıb. Frontend-də 98, backend-də 83 test və typecheck uğurludur. Read-only preflight lokal seed məlumatında uyğunsuzluqlar göstərib; bu nəticələr production açılış qalığı kimi qəbul edilməməlidir. Test tenant UAT-ı, real snapshot dry-run-ı və owner imzası [növbəti plan sənədində](./constrix-warehouse-next-plan.md) izlənir.
