# CONSTRIX — Növbəti plan: qismən qəbul MVP-sinin tamamlanması

**Versiya:** 0.1\
**Tarix:** 31.10.2026\
**Status:** Supplier üzrə read-only uzlaşma görünüşü və tanınan hərəkətlər üçün ledger diaqnostikası əlavə edildi; migration dry-run SQL-i hazırlandı. Migration icra edilməyib. UAT, real snapshot üzərində dry-run, rol yoxlaması və açılış qalığının müştəri ilə təsdiqi açıqdır.\
**Əlaqəli sənədlər:** [İlkin plan](./constrix-procurement-warehouse-plan.md), [MVP spesifikasiyası](./constrix-warehouse-mvp-implementation-spec.md)

## 1. Məqsəd

Kodlanmış ilk qismən qəbul dilimini müştərinin qəbul edə biləcəyi, qalıq hesabatına etibar edə biləcəyi alış-qəbul axınına çevirmək. İlk buraxılış sərhədi:

`Təsdiqlənmiş alış aktı → faktiki qəbullar → təchizatçı üzrə açıq miqdar/borc → uzlaşmış anbar qalığı → tarixçə və audit`

Bu plan anbarlararası transferi, material məsuluna təhvili, sərfiyyatı, poddon uçotunu və tam ödəniş bölgüsünü bu buraxılışa daxil etmir.

## 2. Hazırkı vəziyyət

### Kodda olan ilkin dilim

- `PurchaseReceipt` / `PurchaseReceiptLine` qəbul tarixçəsi və `PurchaseActLine.receivedQty` snapshot-u əlavə edilib.
- Qəbul sətirləri, anbar, qəbul edən və vaxt backend tranzaksiyasında yoxlanır; qəbul miqdarı artıq ola bilməz.
- Faktiki qəbul `Stock`, `Material`, `Movement`, `StockLot` və qəbul edilmiş məbləğə uyğun `Payable` yazır.
- Mübahisəli miqdar/səbəb receipt line-da saxlanır, stoka/payable-a yazılmır və açıq dispute aktın tamamlanmasına mane olur.
- Sonrakı qəbul mübahisəli miqdara əvəz kimi oturanda stok/lot/hərəkətə yazılır, yeni borc yaratmır və köhnə mübahisəni avtomatik həll edir.
- Təchizatçı krediti üçün təmiz yoxlanmış sənəd, səbəb və miqdar tələb olunur; mühasib/direktor təsdiq edənədək kreditor borcuna təsir etmir. Təsdiqdə mənfi açıq payable yaranır.
- Qalan sifariş miqdarını bağlamaq direktor sorğusu, səbəb və ayrıca direktor təsdiqi tələb edir; bağlanan miqdar stoka düşmür.
- Resolution sorğusu və qərarı audit/idempotency ilə saxlanır. Təsdiqli kredit və qalıq bağlama reversal-i bloklayır; əvəz mal olan qəbulu avtomatik reversal etmək mümkün deyil.
- Anbar `Uzlaşdırma` tabı `Material.qty`, `Stock` və `StockLot` cəmlərini material/anbar üzrə müqayisə edir; hərəkət sayı və son tarixi kontekst kimi verir.
- `Uzlaşdırma` tabı indi `medaxil`, `mexaric` və `transfer` hərəkətlərinin xalis cəmini göstərir; naməlum/istiqaməti tanınmayan hərəkətləri sayır və `Stock − tanınan net hərəkət` residualını yalnız təxmin kimi verir.
- Alış aktlarında supplier üzrə qalıq, qəbul, mübahisə, pending kredit və rol icazəsi olanlarda açıq borc read-only cədvəli göstərilir. Supplier-i hüquqi/maliyyə cəhətdən bağlama və payment allocation əməliyyatı yoxdur.
- `backend/prisma/dry-runs/warehouse_migration_dry_run.sql` read-only preflight sorğularını saxlayır; hədəf DB seçilmədiyinə görə icra olunmayıb.
- Təkrar command üçün body hash/idempotency, audit və qəbul tarixçəsi endpoint-i mövcuddur.
- UI qismən qəbul və qalan sifariş miqdarını göstərir.
- Schema üçün migration faylı hazırlanıb; database-ə tətbiq olunmayıb.

### Növbəti mərhələdə qalanlar

1. Supplier read-only uzlaşma paneli var; supplier üzrə settlement/close əməliyyatı və payment allocation ayrıca maliyyə qaydası, owner təsdiqi və workflow tələb edir.
2. Açıq borc/miqdarın avtomatik bağlanma hüquqi qaydası və supplier adlarının canonical ID-yə birləşdirilməsi açıqdır.
3. Reversal tarixi/istifadəçi/səbəbi receipt tarixçəsində görünür. Bu dəyişiklik migration tətbiq edilməyənə qədər DB-də aktiv deyil.
4. Read-only `Material.qty`/`Stock`/`StockLot` və tanınan movement net reconciliation görünüşü var; açılış qalığının təsdiqi və unsupported legacy hərəkətlərin fərqlərinin həlli qalıb.
5. Köhnə təsdiqli alış aktlarının və borcların təhlükəsiz migration/review qaydası.
6. UAT, rol redaksiyası və buraxılış yoxlama siyahısı.

### Schema/API baxışında təsdiqlənən risklər

- Receipt üçün `organizationId` və `locationId` indi `Organization`/`Location` FK-ləri ilə qorunur; tenant uyğunluğu yenə də command və read query-də ayrıca yoxlanır. Bu, mövcud nullable `Location.organizationId` sahəsindən gələn çarpaz-tenant riski aradan qaldırmır.
- `PurchaseReceiptLine.purchaseLineId` FK ilə akt sətrinə bağlanır, lakin DB özü həmin sətrin receipt-in aktına aid olduğunu yoxlamır; command bu əlaqəni yoxlamalıdır.
- `receivedQty` snapshot-u receipt sətirlərinin cəmi ilə ayrıca uzlaşdırılır; yeni qəbuldan qabaq mismatch görünsə command bloklanır. Generic CRUD-dan bu sahəni dəyişmək bloklanıb; bütün yeni yazı və reversal yolları da eyni invariantı saxlamalıdır.
- Mübahisəli miqdar sifarişin qəbul cəminə və stoka qatılmır. Açıq dispute aktı saxlayır; əvəz mal qəbulu, maliyyə təsdiqli supplier krediti və rəhbərin qalıq bağlama qərarı həmin xətti bağlaya bilər.
- `Payable.poId` akt ID-si kimi saxlanır; supplier və receipt əlaqəsi ayrıca FK ilə qorunmur. Hazırkı reversal əməliyyatı borc/lot ID-lərini `OperationReceipt.changedBooks` JSON-dan tapır. Bu dizaynın audit və bərpa tələbinə yetib-yetmədiyi review edilməlidir.
- `StockLot.qr` qlobal unique-dir; hər receipt üçün QR əməliyyat açarı ilə yaradılır. Retry eyni açarda idempotentdir, ancaq manual/legacy lotlar üçün QR qaydası ayrıca qalır.
- Reversal statusu və səbəbi `PurchaseReceipt`-də saxlanır, amma ayrıca reversal sənəd ID-si yoxdur; audit/OperationReceipt snapshot-u ilə əlaqə və rollback planı review edilməlidir.
- `PurchaseAct.status` üçün DB enum yoxdur. `qaralama`, `qismən`, `tesdiq`, `legv` keçidləri yalnız xüsusi command və generic CRUD guard-larında eyni şəkildə saxlanmalıdır.
- `records.service` anbardar/sahə rolu üçün qiymət, məbləğ, supplier və cost sahələrini redaktə edir. Bu redaction testləri receipt history, supplier bağlama və hər yeni endpoint üçün ayrıca yoxlanmalıdır.

## 3. Biznes qərarları — təklif və təsdiq vəziyyəti

Bu başlanğıc seçimləridir; müştəri tərəfindən təsdiq olunmayınca kodda sərt biznes qaydası sayılmamalıdır.

| Mövzu | Tövsiyə olunan başlanğıc qaydası | Təsdiq |
|---|---|---|
| Fiziki/sərbəst qalıq | Fiziki qalıq yalnız keçirilmiş mədaxil və təsdiqli hərəkətlərdir. Sərbəst = fiziki − aktiv rezerv. Gözlənilən alış ayrıca göstəricidir. | Açıq |
| Qismən qəbul | Hər qəbul ayrıca sənəddir; stok yalnız uyğun və faktiki qəbul edilmiş miqdara artır. Çatışmayan miqdar açıq qalır. | Təsdiq edildi |
| Bir sənəddə anbar | Bir receipt bir anbar üçündür. Eyni sifariş sətri fərqli anbarlara gəlirsə ayrı receipt yaradılır. | Təsdiq edildi |
| Supplier uzlaşması | Hər supplier-in qəbul edilmiş, qalıq və bağlanma vəziyyəti ayrıdır. Bir supplier bağlana bilər, digəri açıq qala bilər. | Açıq |
| Qüsurlu/mübahisəli mal | Mübahisəli miqdar ilkin qəbulda stoka və borca yazılmır. Əvəz malın faktiki qəbulu mübahisəni stok girişi ilə avtomatik bağlayır. | Təsdiq edildi |
| Təchizatçı krediti/qaytarması | Sənəd və səbəb tələb olunur; borcu yalnız mühasib/direktor təsdiqindən sonra azaldır. | Təsdiq edildi |
| Qalan miqdarın bağlanması | Rəhbər səbəb yazır və ayrıca təsdiq edir; stok yazılışı yaratmır. | Təsdiq edildi |
| Alış aktındakı nağd ödəniş | Məlumat xarakterlidir. Mühasib kassa/bank sənədi ilə təsdiq etməyincə borcu azaltmır. | Təsdiq edildi |
| Borcun yaranması | Qəbul zamanı yalnız qəbul edilmiş miqdarın məbləği açıq borc kimi yaranır. Hər qismən qəbulu eyni akt/supplier borcunda yığmaq, yoxsa ayrıca borc yaratmaq maliyyə owner-i ilə seçilməlidir. | Qismən təsdiq; açıq borc aggregasiya qaydası |
| Qəbulun reversal-i | Reversal ilkin receipt-i silmir; əks hərəkət və səbəb yaradır. Yalnız istifadə edilməmiş miqdar və ödənilməmiş borc tam ləğvə imkan verir; qismən reversal MVP-yə daxil deyil. | Təsdiq edildi |
| Legacy təsdiqli akt | Avtomatik qəbul edilmiş sayılmır və yenidən qəbul edilmir; manual reconciliation siyahısında görünür. | Təklif |

## 4. İcra backlog-u və asılılıqlar

| Sıra | Prioritet | İş paketi | Tamamlanma meyarı | Asılılıq |
|---:|---|---|---|---|
| 1 | P0 | Biznes qərarlarını bağla | Cədvəldəki qalıq, supplier, qüsur, borc və reversal qaydalarına owner cavabı var. | Müştəri/maliyyə/anbar owner-i |
| 2 | P0 | Schema və command review | Tenant scope, FK/index, `receivedQty` snapshot-ı ilə receipt cəmi, duplicate key, reversal modeli və migration rollback yazılı yoxlanıb. | 1 |
| 3 | P0 | Receipt dispute qərarları | **Kodlandı:** əvəz qəbul, sənədli kredit sorğusu və rəhbər qalıq bağlama təsdiqi; yalnız supplier üzrə yekun bağlanma paneli qalıb. | 1–2 |
| 4 | P0 | Stok reconciliation və read model | **Diaqnostika hazırdır:** material cəmi/Stock/StockLot, tanınan movement net, unsupported tip sayı və inferred residual görünür. Opening balance owner təsdiqi və historical fərqlərin qərarı açıqdır. | 2 |
| 5 | P1 | UI və role redaction | Anbardar faktiki qəbul üçün lazım olan sahələri görür; qiymət/borc redaktə edə bilmir; təchizatçı və maliyyə rolları öz səlahiyyətində işləyir. | 1, 3 |
| 6 | P1 | Material tələbi və rəhbər təsdiqi | Tələb qaralaması, submit, approve/reject/return, audit və təsdiqdən öncə düzəliş serverdə qorunur. | 4 |
| 7 | P0 | UAT və migration dry-run | Checklist genişləndirilib; test tenant UAT və seçilmiş DB snapshot-da dry-run hələ icra olunmayıb. Nəticə owner-ə təqdim edilir və unresolved sətirlər manual review-a ayrılır. | 3–6 |
| 8 | Buraxılış | Migration/deploy qərarı | Yalnız dry-run nəticəsi nəzərdən keçirildikdən və backup/rollback hazır olduqdan sonra tətbiq pəncərəsi seçilir. | 7 və ayrıca buraxılış təsdiqi |

**Buraxılış qapısı:** 1–7 addımları tamamlanmadan prod database migration və stok yaradan əməliyyat açılmır. Migration SQL-in mövcud olması onun tətbiqinə razılıq sayılmır.

## 5. Data/schema review checklist

- `PurchaseReceipt.organizationId`, `actId`, `locationId` eyni tenant-a aidliyi command və read endpoint-də yoxlanır; tenant sərhədi yalnız UI filtrinə arxalanmır.
- `PurchaseReceiptLine.purchaseLineId` həmin receipt-in `actId`-sinə bağlı akt sətri olmalıdır.
- `receivedQty` həmişə qəbul hadisələrinin cəminə uyğun saxlanır; ləğv/əks əməliyyat bu cəmi tarixçəni pozmadan düzəldir.
- `acceptedQty + disputedQty > 0`; mənfi və sifariş qalığından artıq miqdar rədd edilir. Qüsurlu/mübahisəli miqdar stoka yazılan `acceptedQty`-dən ayrıdır.
- `Stock`, `Material.qty`, `Movement`, `StockLot` və `Payable` eyni serializable tranzaksiyanın hissələridir.
- `OperationReceipt` təkrar command üçündür; insanın oxuduğu qəbul/reversal tarixçəsinin əvəzi deyil.
- Supplier adı mətn snapshot-u olaraq qalacaq, yoxsa canonical `Supplier` ID-si tələb olunacaq — qərar verilir. İki fərqli yazılışın borcu bölməməsi yoxlanır.
- Decimal dəqiqliyi, hissəli qəbulda məbləğin qəpik yuvarlaqlaşdırılması və son qəbulda yekun borcun alış sətri məbləğinə bərabər olması yoxlanır.
- Mövcud təsdiqli aktların `receivedQty=0` migration default-u ilə səhvən təkrar qəbul edilməməsi status/command səviyyəsində təmin edilir.
- Ləğv edilmiş receipt tarixçədə qalır və onun əks stok/borc hərəkəti ilə əlaqəsi görünür.

## 6. Migration dry-run və rollout çıxışı

Dry-run heç bir biznes qalığını dəyişməməlidir. Hesabat aşağıdakı sayları və fərqləri çıxarmalıdır:

1. Aktlar: qaralama, təsdiqli, ləğv edilmiş və receipt/operation receipt əlaqəsi olanlar.
2. Material/anbar: `Stock.qty` cəmi, `Material.qty`, müsbət `StockLot.qty` cəmi, `Movement` üzrə yığılan xalis hərəkət.
3. Borclar: akt ID-si, akt nömrəsi və supplier mətninə görə uyğunlaşan `Payable` qeydləri; eyni akt üçün mümkün təkrar borclar.
4. Həll olunmayan əlaqələr: material, anbar, supplier və receipt line-i uyğun gəlməyən sətirlər.
5. Manual qərar tələb edən fərqlər; hər fərq üçün mənbə sətir ID-si və məbləğ/miqdar göstərilir.

Rollout ardıcıllığı: backup təsdiqi → migration dry-run nəticəsinin nəzərdən keçirilməsi → schema migration → read-only reconciliation təkrarı → test aktında qəbul/reversal → məhdud istifadəçi pilotu → ümumi açılış. Hər addımın çıxışı ayrıca saxlanır.

## 7. UAT ssenariləri

| ID | Ssenari | Gözlənən nəticə |
|---|---|---|
| U1 | 100 sifariş vahidindən 60 qəbul | Qalıq 40; stock/lot/movement yalnız 60 artır; akt qismən görünür. |
| U2 | Sonradan qalan 40 qəbul | Akt tamamlanır; iki receipt tarixçədə görünür; ümumi stok 100 artır. |
| U3 | Qəbul miqdarı qalıqdan artıq | Əməliyyat tam rədd edilir; heç bir receipt/stock/payable qismən yazılmır. |
| U4 | Eyni idempotency key və eyni body təkrar | Mövcud nəticə qaytarılır; ikinci stok və borc yaranmır. |
| U5 | Eyni key, dəyişmiş sətir miqdarı | `409`; heç bir əlavə yazı yoxdur. |
| U6 | İki supplier-dən yalnız biri tam çatdırır | Tam çatdıran supplier bağlana bilir; digərinin miqdarı/hesabı açıq qalır. |
| U7 | Qüsurlu miqdarla çatdırılma | Qüsurlu miqdar stoka düşmür; səbəb və sübut saxlanır; açıq qalıq görünür. |
| U8 | `cashPaid` mənbə sahəsində doludur, maliyyə təsdiqi yoxdur | Fiziki qəbul mümkündür; borc təsdiqsiz ödənişə görə azalmır. |
| U9 | Qəbul lotundan material artıq çıxarılıb, sonra reversal | Tam reversal rədd edilir və səbəbi göstərilir; stok mənfiyə düşmür. |
| U10 | Ödənilmiş payable ilə reversal | Tam reversal bloklanır; maliyyə düzəlişi tələb olunur. |
| U11 | Warehouse rolu ilə API/UI | Qəbul yaza bilər; qiymət, borc və maliyyə sahələrini oxuya/redaktə edə bilməz. |
| U12 | Legacy təsdiqli akt, receipt əlaqəsi yoxdur | Təkrar qəbul mümkün deyil; manual reconciliation siyahısına düşür. |
| U13 | Bir tenant-ın istifadəçisi başqa tenant receipt/location/line ID-si göndərir | `404/403`; heç bir məlumat dəyişmir və həssas məlumat sızmır. |
| U14 | Eyni hissəli qəbul üçün 3 xırda decimal miqdar | Qəpik yuvarlaqlaşdırması son qəbulda cəmi alış aktı sətri məbləğinə bərabərdir. |
| U15 | 5 qəbul + 5 mübahisəli, sonra 5 əvəz mal | Əvəz 5 stoka daxil olur, payable artmır, açıq dispute həll edilir və qəbul miqdarı 10-a çatır. |
| U16 | Sənədli supplier credit pending və sonra approved | Pending vaxtı payable dəyişmir; maliyyə təsdiqindən sonra mənfi açıq payable yaranır, eyni mübahisə iki dəfə bağlana bilmir. |
| U17 | Direktor qalan miqdarı bağlama sorğusu yaradır | Pending/rejected mərhələdə stok və payable dəyişmir; təsdiqdə yalnız qalıq bağlanır, stok artmır və səbəb/audit saxlanır. |
| U18 | Anbardar/warehouse supplier reconciliation açır | Miqdar və status görünür, payable amount cavabdan və UI-dan gizlidir. |
| U19 | Transfer və naməlum movement type reconciliation | Transfer iki anbar arasında xalis sıfırdır; tanınmayan type ayrıca sayılır və opening residual kimi təqdim edilmir. |
| U20 | Hədəf tenant snapshot-da dry-run SQL | Yalnız SELECT nəticələri çıxır; DB-də row/table dəyişmir; unresolved keyfiyyət fərqləri manual review siyahısına düşür. |

## 8. Növbəti icra addımları

Kod səviyyəsində read-only supplier uzlaşması, xalis tanınan movement və inferred residual görünüşü, həmçinin read-only SQL preflight hazırdır. Frontend-də 98 test, backend-də 76 test və yeni supplier/reconciliation testləri keçib. Bu mock/unit yoxlamaları test tenant UAT-ını əvəz etmir; real test tenant və DB snapshot-da yoxlama hələ açıqdır.

1. UAT ssenarilərini test tenant/database-ə seed edib nəticələri yoxlamaq; U15–U20 daxil olmaqla resolution, rol redaksiyası və transfer hesabatını əhatə etmək.
2. SQL preflight-ı yalnız seçilmiş test/production snapshot-da `READ ONLY` rejimində işlədib CSV/nəticə çıxışını arxivləmək. Hazırda hədəf database seçilməyib və sorğular işlədilməyib.
3. Supplier adlarının eyniləşdirilməsi, borcun akt/supplier üzrə yığılması, settlement və payment allocation üçün maliyyə owner qərarını almaq; bu qərarlardan əvvəl write əməliyyatı əlavə etməmək.
4. Opening residualı rəsmi açılış qalığı kimi qəbul etməzdən əvvəl sahibin təsdiq etdiyi opening balances və unsupported legacy movement mapping-i toplamaq.
5. UAT və dry-run nəticələri qəbul ediləndən sonra ayrıca migration pəncərəsi, backup/rollback və pilot planı hazırlamaq. Migration tətbiqi ayrıca buraxılış addımı olaraq qalır.
