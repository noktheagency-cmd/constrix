# CONSTRIX — Növbəti plan: qismən qəbul MVP-sinin tamamlanması

**Versiya:** 0.1\
**Tarix:** 01.11.2026\
**Status:** Supplier üzrə read-only uzlaşma və stok diaqnostikası, dispute resolution və layihə təyinatı kodlanıb. Migration 003–007 lokal `afez_db`-yə tətbiq olunub; dəyişikliklər `cbc18a3`, `d97a154` və `9cf8c91` commit-ləri ilə `origin/main`-ə push edilib. Web 98/98, backend 83/83 və TypeScript yoxlamaları uğurludur. DB acceptance: transfer 5/5, market 17, akt 15 yoxlaması keçib. 29.10 tarixli, əvvəl restore-u yoxlanmış backup ayrıca müvəqqəti DB-yə bərpa edildi, migration-lar klona tətbiq edildi və read-only preflight uğurla işlədi; clone silindi. Müştəri/test tenant UI UAT-ı və qalıq fərqlərinin owner tərəfindən izahı açıqdır.\
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
- `Uzlaşdırma` tabı `medaxil`/`qebul` daxilolmalarını, `mexaric`/`cixis` çıxışlarını və `transfer` hərəkətlərini xalis hesablayır; köhnə aliasların sayını ayrıca göstərir. Naməlum tipləri sayır və `Stock − tanınan net hərəkət` residualını yalnız təxmin kimi verir. Tarixi movement sətirləri dəyişdirilmir.
- Alış aktlarında supplier üzrə qalıq, qəbul, mübahisə, pending kredit və rol icazəsi olanlarda açıq borc read-only cədvəli göstərilir. Supplier-i hüquqi/maliyyə cəhətdən bağlama və payment allocation əməliyyatı yoxdur.
- `backend/prisma/dry-runs/warehouse_migration_dry_run.sql` read-only preflight sorğularını saxlayır. 29.10 backup-ın yoxlanmış dump-ından `PurchaseAct`, `Payable`, `Material`, `Stock`, `StockLot` və `Movement` data-only çıxarılıb; preflight A–F aqreqatları read-only qaydada yenidən hesablanıb. Nəticə: 58 alış aktı qaralamadır, uyğun payable yoxdur, 12 materialda `Material.qty`/`Stock`/`StockLot` fərqi, 0 supplier alias qrupu, 0 əlaqəsiz movement və location var; tiplər `medaxil` 5, `mexaric` 3, `transfer` 2, `qebul` 2, `cixis` 1-dir. Alias mapping ilə residual 15-dir (13 müsbət, 2 mənfi), əvvəlki tam SQL preflight nəticəsi ilə uyğundur. PostgreSQL klonunu başlatmaq mümkün olmadığı üçün SQL skriptinin özünü bu dəfə DB-yə qarşı yenidən icra etmək əvəzinə onun SELECT aqreqatları verified dump data-sı üzərində hesablanıb; metod audit JSON-da göstərilib. Bu diaqnostikadır, düzəliş deyil.
- Snapshot preflight-ın yığcam nəticəsi [warehouse-snapshot-preflight-2026-10-29.json](./source-audit/warehouse-snapshot-preflight-2026-10-29.json) faylında saxlanır. Mənbə backup-ın restore yoxlaması 166 cədvəl və 26,409 sətir üzrə əvvəlcədən uğurlu olub.
- Təkrar command üçün body hash/idempotency, audit və qəbul tarixçəsi endpoint-i mövcuddur.
- UI qismən qəbul və qalan sifariş miqdarını göstərir.
- Anbar modulunda ayrıca `Mədaxil` və `Məxaric` tabları əlavə edilib; mövcud movement tarixçəsi istiqamətə görə süzülür və hər tab uyğun yeni hərəkət formasını açır. Bu yalnız mövcud mədaxil/məxaric əməliyyatlarının naviqasiya görünüşüdür; inventarizasiya, faktiki sərfiyyat, poddon və geri qaytarma workflow-larını əvəz etmir.
- Migration 003–007 lokal `afez_db`-yə tətbiq olunub. Müştəri/test/production mühitləri ayrıca seçilməyib və migration olunmayıb.
- `backend/scripts/project-transfer-acceptance.ts` təsadüfi PostgreSQL schema-sında göndərən/qəbul edən səlahiyyətini, ikinci imza qaydasını, tenant ayrılığını, deaktiv təyinatı və stok/lot/movement nəticələrini 5/5 yoxlayır; sonda schema-nı silir.
- Project transfer UAT nəticəsi təkrarlana bilən audit üçün [project-transfer-acceptance.json](./source-audit/project-transfer-acceptance.json) faylında saxlanır.
- `backend/scripts/market-acceptance.ts` real Prisma schema-sında 17 market və 15 akt acceptance yoxlamasını işlədir; qismən qəbul, mübahisə/əvəz, reversal, tenant qoruması və UI export-u əhatə edir.

### Növbəti mərhələdə qalanlar

1. Supplier read-only uzlaşma paneli var; supplier üzrə settlement/close əməliyyatı və payment allocation ayrıca maliyyə qaydası, owner təsdiqi və workflow tələb edir.
2. Açıq borc/miqdarın avtomatik bağlanma hüquqi qaydası və supplier adlarının canonical ID-yə birləşdirilməsi açıqdır.
3. Reversal tarixi/istifadəçisi/səbəbi kodda və migration olunmuş lokal DB sxemində aktivdir; test tenant UAT-ı gözləyir.
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
| 7 | P0 | UAT və data reconciliation | İzolyasiya olunmuş DB acceptance və 29.10 snapshot preflight keçib. Altı cədvəlin verified dump export-u ilə A–F aqreqatları yenilənib; alias mapping-dən sonra residual 15-dir (13+, 2−). Owner-in 12 material fərqinə və opening balance-a qərarı, eləcə də müştəri test tenant UI UAT-ı açıqdır. SQL skriptini ayrıca DB klonunda təkrar icra etmək mümkün olsa, ikinci yoxlama kimi saxlanır. | 3–6 |
| 8 | Buraxılış | Test/pilot/prod rollout | Backup, UAT imzası, unresolved fərqlər üçün qərar və rollback planı qəbul ediləndən sonra hədəf mühitdə migration statusu yoxlanır; artıq lokal DB-də tətbiq olunan migration-lar uyğun mühitə ayrıca deploy edilir. | 7 və ayrıca buraxılış təsdiqi |

**Buraxılış qapısı:** Lokal dev DB-də migration tətbiqi production/test tenant rollout-u sayılmır. 1–7 addımları, backup/rollback və owner imzası tamamlanmadan production migration və stok yaradan əməliyyat açılmır.

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
| U21 | Layihəyə göndərən təyin olunub, qəbul edən təyin olunmayıb | Göndərən transferi aça/göndərə bilir; qəbul icazəsi olmayan hesab qəbul və ya ləğv etmir. |
| U22 | Mənbə və təyinat layihəsinin müxtəlif üzvləri təsdiqləyir | Hər iki tərəfin səlahiyyəti yoxlanır; eyni hesabın iki tərəfi təsdiqləməsi rədd edilir; layihə/anbar qalıqları düzgün yenilənir. |

## 8. Növbəti icra addımları

Kod səviyyəsində read-only supplier uzlaşması, xalis tanınan movement və inferred residual görünüşü hazırdır. Web testləri 98/98, backend testləri 83/83, web build/typecheck və backend TypeScript yoxlaması keçib. Migration 003–007 lokal DB-də tətbiq edilib. DB acceptance: transfer 5/5, market 17 və akt 15 yoxlaması uğurludur. 29.10 backup-ın əvvəlki tam SQL preflight-ı uğurla tamamlanmışdı. Yenilənmiş alias qaydaları ilə altı cədvəlin `pg_restore` data-only export-u üzərində A–F aqreqatları təkrar hesablandı: 58 qaralama akt, 0 payable match, 12 material fərqi, 0 supplier alias qrupu, 15 residual (13+, 2−). SQL skriptinin özünü yeni DB klonunda işlətmək üçün PostgreSQL klonu başlatmaq mümkün olmadı; dump data-sı üzərindəki read-only nəticə əvvəlki tam run ilə uyğun gəldi. Növbəti addım test tenant UI UAT-ı, 12 material fərqi və 15 residual üçün owner qərarıdır. Müştəri məlumatında stok düzəlişi edilməməlidir.

1. İzolyasiya olunmuş test tenant və test istifadəçiləri seçmək; real əməliyyatları seed və production məlumatı üzərində aparmamaq. DB service acceptance bu addımın server tərəfini yoxlayıb; ekran axını hələ yoxlanmayıb.
2. U1–U22-ni test tenant UI/API-da icra edib nəticə, audit event, payable, stok/lot, layihə icazəsi və signer-i təsdiqləmək.
3. Supplier/təchizatçı adları, ödəniş bölgüsü və qanuni settlement qaydaları üçün maliyyə owner qərarlarını yazılı almaq.
4. Müştərinin aktual test snapshot-ını ayrıca təsdiqləmək; hazırda mövcud 29.10 backup snapshot-dır və bugünkü production vəziyyətinə bərabər sayılmır.
5. 29.10 snapshot üzrə 12 material fərqini və 15 residualı owner-lə sətir-sətir nəzərdən keçirmək, təsdiqli opening balance/mapping toplamaq; müştəri bazasında avtomatik düzəliş etməmək.
6. UAT imzası, snapshot dry-run, backup/rollback və pilot istifadəçi siyahısı qəbul ediləndən sonra hədəf mühitin migration statusunu yoxlayıb ayrıca rollout pəncərəsi təyin etmək.
