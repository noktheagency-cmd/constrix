# CONSTRIX — Növbəti plan: qismən qəbul MVP-sinin tamamlanması

**Versiya:** 0.1\
**Tarix:** 01.11.2026\
**Status:** Supplier üzrə read-only uzlaşma və stok diaqnostikası, dispute resolution və layihə təyinatı kodlanıb. Migration 003–012 lokal `afez_db`-yə tətbiq olunub. Material məsuluna təhvil/sərfiyyat və ayrıca layihə təsdiqi, eləcə də tara üçün ayrıca qəbul, məsul imzası, qaytarma, son tarix, gecikmə xəbərdarlığı, sənədli itki/zədə aktı kodlanıb. İzolyasiya olunmuş acceptance: market 17, akt 15, transfer 5, material custody 4, tara 3, supplier goods return 3, supplier closure/payment 2 yoxlaması keçib. Supplier reconciliation, anbar reconciliation və tenant isolation unit suite-ləri 13/13 keçib. İzolyasiya olunmuş UI UAT-da U34–U36 keçib: supplier miqdar uzlaşması sübut istinadı ilə bağlandı və payable dəyişmədi; 75 ₼ payment 50 ₼ + 25 ₼ iki borca bölündü, mühasib təsdiqindən sonra bir borc tam, digəri qismən ödənildi. UAT zamanı payload-da çatışmayan `amount` sahəsi tapılıb və düzəldilib. U21–U33 üçün DB/API acceptance var; U1–U33 üçün tam ekran UAT hələ açıqdır. 29.10 qalıq fərqlərinin owner qərarı və rollout təsdiqi də açıqdır. Windows PostgreSQL xidməti `STOPPED` göründüyünə görə restartdan sonrakı avtomatik bərpa yoxlanmalıdır. `qebul`/`cixis` mapping-i və Mədaxil/Məxaric tabları artıq push edilib. 29.10 backup preflight auditı var.\
**Əlaqəli sənədlər:** [İlkin plan](./constrix-procurement-warehouse-plan.md), [MVP spesifikasiyası](./constrix-warehouse-mvp-implementation-spec.md)

## 1. Məqsəd

Kodlanmış ilk qismən qəbul dilimini müştərinin qəbul edə biləcəyi, qalıq hesabatına etibar edə biləcəyi alış-qəbul axınına çevirmək. İlk buraxılış sərhədi:

`Təsdiqlənmiş alış aktı → faktiki qəbullar → təchizatçı üzrə açıq miqdar/borc → uzlaşmış anbar qalığı → tarixçə və audit`

Bu qismən qəbul buraxılışının əhatəsindən kənarda material məsuluna təhvil/sərfiyyat və qaytarılan tara alt-dilimləri ayrıca hazırlanır; geri qaytarılan mallar və tam ödəniş bölgüsü hələ bu icraya daxil deyil.

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
- Məsul şəxsə təhvil üçün `MaterialHandover` cədvəli və API hazırlanıb. Layihə təyinatında `canHoldMaterials` icazəsi var; təhvil verən və alan fərqli imza atır. Sərfiyyat/qaytarma sorğusunu yalnız təhvili qəbul etmiş məsul şəxs yaradır; layihə rəhbəri və ya təyin edilmiş `canReviewMaterialUsage` nəzarətçisi ayrıca təsdiq edir. Sərfiyyat təsdiqi Stock/Material/StockLot və `mexaric` movement yazır; qaytarma təsdiqi məsul balansını azaldır, fiziki stock-u dəyişmir. `remainingQty` ilə qalıq izlənir və paralel rezerv/transfer yolları bu balansı qoruyur. Warehouse UI-da məsul şəxslər, imza, sorğu və təsdiq növbəsi var. Migration 008–009 lokal `afez_db`-yə tətbiq olunub; test tenant UI UAT-ı qalır. Layihə sərfiyyatının pul dəyəri `Project.spent`-ə avtomatik yazılmır.
- Qaytarılan tara ayrıca `ReturnablePackagingCase`/`ReturnablePackagingEvent` reyestrindədir. Layihə təyinatında `canHoldReturnablePackaging` ayrıdır; anbar qəbul yaradır, məsul şəxs imzalayır, qaytarma anbarçı və təchizatçı nümayəndəsi/imzalı sənəd ilə bağlanır. Son tarix hər qəbulda verilir, vahid müddət avtomatik seçilmir. İtki/zədə üçün sübut istinadı və rəhbər qərarı lazımdır; məsuliyyət qeydi qalır və Payable avtomatik yaranmır. Tara Material/Stock-dan ayrıdır. Migration 010 lokal `afez_db`-yə tətbiq olunub, acceptance 3/3; ekran UAT-ı qalır.
- Migration 003–009 lokal `afez_db`-yə tətbiq olunub. Müştəri/test/production mühitləri ayrıca seçilməyib və migration olunmayıb.
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
| 3 | P0 | Receipt dispute və supplier bağlanması | **Kodlandı:** əvəz qəbul, sənədli kredit sorğusu, rəhbər qalıq bağlama təsdiqi və supplier üzrə ayrıca miqdar uzlaşmasının direktor tərəfindən sənədlə bağlanması. | 1–2 |
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
| U23 | Məsul şəxs 10 vahid qəbul edir, 4 vahid sərfiyyat sorğusu yaradır | Təsdiqədək stok, lot, movement və custody balansı dəyişmir; eyni custody üzrə artıq pending sorğu yaradıla bilmir. |
| U24 | Sərfiyyatı eyni istifadəçi təsdiqləməyə çalışır və ya təyinatsız istifadəçi təsdiqləyir | API əməliyyatı rədd edir; bütün qalıqlar və audit əvvəlki kimi qalır. |
| U25 | Sərfiyyat layihə rəhbəri/təyin edilmiş nəzarətçi tərəfindən təsdiqlənir | Stock, Material, FIFO StockLot və `mexaric` movement eyni tranzaksiyada azalır; custody qalığı eyni miqdarda azalır. |
| U26 | Qaytarma sorğusu təsdiqlənir və sorğu rədd edilir | Təsdiqli qaytarma yalnız custody balansını azaldır; rədd edilən sərfiyyat/qaytarma stok və custody qalığını dəyişmir, səbəb/audit saxlanır. |
| U27 | Tara qəbulu və məsula təhvil | Tara material stokuna qarışmır; təyin olunmuş məsul şəxs ayrı imza atır; son tarix həmin sənəddə saxlanır. |
| U28 | Tara qaytarılması | Qalıq yalnız anbar və təchizatçı nümayəndəsinin adı/imzalı sənəd qeydə alınandan sonra azalır. |
| U29 | Tara itkisi/zədəsi | Sübut istinadsız akt rədd edilir; rəhbər təsdiqində məsuliyyət qeydi/audit qalır, anbar materialı və Payable dəyişmir. |
| U30 | Təchizatçıya qaytarmada legacy partiya | Mənbə alış qəbulu/partiya əlaqəsi olmayan köhnə lot seçimdən və API qaytarmasından bloklanır; manual reconciliation tələb olunur. |
| U31 | Qaytarma qaralaması və direktor təsdiqi | Eyni lot üzrə açıq qaytarma rezervi ikinci sənəddə ikiqat miqdarı bloklayır; qaralamanı yaradan şəxs təsdiqləmir. |
| U32 | Təchizatçıya fiziki təhvil | Təsdiqli sənəd anbar stokunu, material cəmini və lotu eyni miqdarda azaldır; imza/sənəd nömrəsi olmadan supplier-accepted statusu yaranmır. |
| U33 | Supplier credit maliyyə təsdiqi | Təchizatçı imzası və maliyyə qərarı olmadan payable yaranmır; təsdiqdə mənfi açıq payable ilkin alış aktına bağlanır. |
| U34 | Supplier üzrə miqdar uzlaşmasının bağlanması | Yalnız direktor, qəbul/öhdəlik cəmi uzlaşan, sifariş qalığı, mübahisə və pending kredit qalmayan supplier-i sənəd istinadı ilə ayrıca bağlayır; payable dəyişmir. |
| U35 | Bir ödənişin bir neçə borca bölgüsü | FIFO təklifi ən köhnə müsbət borclardan başlayır; mühasib məbləği düzəldə bilər; bir supplier-in bir neçə açıq borcuna bölünür; draft mərhələsində borc dəyişmir. |
| U36 | Ödəniş təsdiqi və qismən bağlanma | Maliyyə təsdiqi zamanı hər payable qalıq yoxlanır; tam ödənən borc `odenilib`, qismən ödənən açıq qalıqla qalır; hər bölgü və təsdiq auditdə saxlanır. |

## 8. Növbəti icra addımları

Kod səviyyəsində supplier üzrə miqdar uzlaşmasının bağlanması və finance payment allocation axını hazırdır. Web typecheck, izolyasiya olunmuş generated Prisma client ilə backend TypeScript yoxlaması və Prisma schema validation keçib. Migration 003–012 lokal DB-də tətbiq edilib. DB acceptance: transfer 5/5, market 17 və akt 15; custody 4/4; tara 3/3; supplier goods return 3/3; supplier closure/payment 2/2 keçib. Hədəf Jest suite-ləri `purchase-supplier-reconciliation`, `warehouse-reconciliation.service` və `tenant-isolation` 13/13 keçdi; iki test mock-u yeni `PurchaseSupplierClosure` delegate-ini əhatə etmədiyindən yeniləndi. Əlavə `act-workflows.spec.ts` və `purchase-supplier-reconciliation.spec.ts` hədəf Jest run-ı 10/10 keçdi: eyni alış qəbulu idempotency replay, eyni açarla dəyişmiş miqdarın rəddi, anbardarın qəbulu, təsdiqsiz `cashPaid`-in borcu azaltmaması və anbar rolunda payable məbləğinin gizli qalması yoxlanıldı. U11 icazə testi `receivePurchase` tenant sahəsinin `catalog` əvəzinə `warehouse` olmalı olduğunu göstərdi; service yoxlaması düzəldildi. UI typecheck də keçdi. İzolyasiya olunmuş UI UAT-da U34–U36 manual yoxlanıb. Firma A UAT uzlaşması qəbz/uzlaşma istinadı ilə bağlanıb; 80 ₼ borc bağlanışdan sonra da dəyişməyib. 75 ₼ payment qaralaması iki borca 50/25 bölünüb; draft zamanı qalıqlar dəyişməyib; Günel Rzayeva təsdiq etdikdən sonra bir payable 0 ₼/`odenilib`, digəri 15 ₼/`acik` qalıb, −10 ₼ kredit dəyişməyib. İlk UI cəhdi API payload-da ümumi `amount` olmadığından rədd edildi; [SupplierPaymentPanel.tsx](../src/pages/SupplierPaymentPanel.tsx)-də sahə əlavə olundu və UAT təkrarında qaralama/təsdiq uğurla tamamlandı. Bu turn-də izolyasiya olunmuş UI UAT-da U1–U3, U7, U14, U15 və U17 də yoxlanıldı: AA-001 üzrə 60+40 qəbul; AA-002-də 11 vahid artıq qəbulun yazısız rəddi və sonra 1 vahidin uğurlu qəbulu; AA-003-də 5 qəbul + 5 mübahisəli miqdar və 5 əvəz vahidi; AA-004-də səbəbli 10 vahid qalıq bağlamasının direktor təsdiqi; AA-005-də üç 1 vahidlik decimal qəbul. Qalıq, stok, lot/movement və borc dəyərləri DB-dən tutuşdurulub. UAT zamanı alış aktı xətt ID-lərinin fərqli aktlarda təkrarlanması və `qismən` statusunun tərcüməsiz görünməsi aşkar edilərək düzəldildi: [purchaseActs.ts](../src/domain/purchaseActs.ts) unikal ID yaradır, [i18n.tsx](../src/i18n.tsx) statusu az/en/ru dillərində göstərir. Ətraflı nəticə: [purchase-receipt-ui-acceptance.json](source-audit/purchase-receipt-ui-acceptance.json). UI UAT-ın bu sessiya üçün test sxemi `afez_partial_receipt_ui_uat_20261101` idi; serverlər dayandırılıb və müvəqqəti sxem silinib. Real supplier ödənişi və xarici sistem yazısı edilməyib. Supplier miqdar uzlaşması maliyyə hesablaşmasından ayrıdır və mənbə qəbulu/öhdəlik cəmini yoxlayır. Standart `prisma generate` lokal `query_engine-windows.dll.node` faylını yeniləyərkən Windows `EPERM` xətası verdi; source schema və kod typecheck-i müvəqqəti ayrı client output-u ilə yoxlanıb, standart client output refresh-i hələ açıqdır. 29.10 backup-ın əvvəlki tam SQL preflight-ı uğurla tamamlanmışdı. Yenilənmiş alias qaydaları ilə altı cədvəlin `pg_restore` data-only export-u üzərində A–F aqreqatları təkrar hesablandı: 58 qaralama akt, 0 payable match, 12 material fərqi, 0 supplier alias qrupu, 15 residual (13+, 2−). SQL skriptinin özünü yeni DB klonunda işlətmək üçün PostgreSQL klonu başlatmaq mümkün olmadı; dump data-sı üzərindəki read-only nəticə əvvəlki tam run ilə uyğun gəldi. Backend acceptance-da U6, U9–U13, U16 və U18–U20 bağlandı: supplier-lərin müstəqil uzlaşması, istifadə edilmiş və ödənilmiş stokun reversal bloklaması, receipt-siz legacy aktın manual uzlaşdırma siyahısı, tenant sərhədi, sənədli supplier krediti, anbar məxfilik və movement residual qaydaları yoxlanıldı. 29.10 snapshot preflight-ı read-only-dir. Açıq iş U1–U33 UI UAT-ının qalan ekran ssenariləri, müştəri owner-in 12 material fərqi və 15 residual üçün yazılı qərarı, aktual snapshot təsdiqi və rollout qəbuludur. Müştəri məlumatında stok düzəlişi edilməməlidir.

1. İzolyasiya olunmuş test tenant və test istifadəçiləri seçmək; real əməliyyatları seed və production məlumatı üzərində aparmamaq. U6, U9–U13, U16, U18–U20 və U21–U36 DB/API acceptance izolyasiya olunmuş sxemlərdə aparılıb; U34–U36 və U1–U3/U7/U14/U15/U17 UI UAT yoxlanıb.
2. U1–U33 ekran UAT-ında qalan halları davam etdirmək; U4–U5 idempotency isə backend unit suite-də yoxlanıb.
3. Supplier/təchizatçı adları, ödəniş bölgüsü və qanuni settlement qaydaları üçün maliyyə owner qərarlarını yazılı almaq.
4. Müştərinin aktual test snapshot-ını ayrıca təsdiqləmək; hazırda mövcud 29.10 backup snapshot-dır və bugünkü production vəziyyətinə bərabər sayılmır.
5. 29.10 snapshot üzrə 12 material fərqini və 15 residualı owner-lə sətir-sətir nəzərdən keçirmək, təsdiqli opening balance/mapping toplamaq; müştəri bazasında avtomatik düzəliş etməmək.
6. UAT imzası, snapshot dry-run, backup/rollback və pilot istifadəçi siyahısı qəbul ediləndən sonra hədəf mühitin migration statusunu yoxlayıb ayrıca rollout pəncərəsi təyin etmək.

## 9. 2026-11-02 UAT follow-up

Bu sessiyada U6 ekran ssenarisi izolyasiya olunmuş tenant-da yoxlanıldı: bir aktda Supplier A 5/5 qəbul edilərək 5/0 qalıqla uzlaşdı, Supplier B isə 5 vahid açıq qaldı; supplier-lərin borcları qarışmadı. U23–U26 da real test rolları ilə UI-dan yoxlanıldı: direktor 4 vahidi təhvilə verdi, Rauf qəbul imzası atdı və 2 vahid sərfiyyat + 1 vahid qaytarma sorğusu yaratdı, layihə rəhbəri Nigar hər ikisini təsdiqlədi. DB nəticəsi: `Stock=StockLot=Material=3`, custody qalığı `1`, bir təsdiqli `consume` və bir təsdiqli `return`; gözləyən custody sorğusu qalmadı. Qalıq/reversal, pending kredit və maliyyə məxfiliyi üzrə U9–U13, U16, U18–U20 backend acceptance nəticələri əvvəlki bölmədəki kimi keçib.

Warehouse UI smoke zamanı `RolesGuard`-ın yeni custom routes üçün mapping-i yox idi və Məsul şəxslər paneli 403 qaytarırdı. `material-handovers`, `returnable-packaging` və `supplier-goods-returns` marşrutları `backend/src/auth/access.ts`-də uyğun warehouse/site/projects sahələrinə bağlandı; build-dən sonra UI-də director → custodian → PM handover axını keçdi, tara və supplier return ekranları artıq role-guard xətası vermədən açıldı.

Bu run bütün U1–U33 ekran UAT-ını bağlamır. Açıq ekran halları: U4–U5, U8–U13, U16, U18–U22 və U27–U33. Backend acceptance/UAT sübutu UI ekran yoxlamasını əvəz etmir. İzolyasiya olunmuş `afez_remaining_ui_uat_20261101` sxemi silindi, local test API/Vite prosesləri dayandırıldı. Müştəri mühitinə yazı, migration deploy, push və release edilməyib.

Owner-asılı buraxılış gate-ləri dəyişməyib: 29.10 snapshot-ın 12 material fərqi və 15 residualı üçün sətir-sətir owner qərarı; aktual snapshot-ın təsdiqi; UAT imzası; backup/rollback və pilot siyahısı; ayrıca rollout pəncərəsi.

## 10. 2026-11-02 qalan texniki işlərin təkrar yoxlanması

Bu tarixdə ayrıca disposable PostgreSQL sxemlərində acceptance skriptləri yenidən icra edildi: layihələrarası transfer 5/5, məsul şəxsdə material/custody 4/4, tara 3/3, təchizatçıya qaytarma 3/3, supplier uzlaşması və çoxborclu ödəniş 3/3. Hədəf Jest dəsti 12/12 keçdi; Nest build və frontend TypeScript yoxlaması uğurludur. Hər acceptance skripti öz sxemini yaratdı və sildi. Əlavə local UI sxemi də yalnız disposable sınaq üçün açılıb, panel smoke yoxlamasından sonra silinib; API/Vite dayandırılıb. Müştəri bazasına və xarici sistemə yazı edilməyib.

UI-da `Məsul şəxslər`, `Qaytarılan tara` və `Təchizatçıya qaytarma` panelləri real local tətbiqdə açıldı; formlar, cədvəllər, rol icazəsi və boş vəziyyətlər göründü. Bunlar UI smoke yoxlamalarıdır, tam istifadəçi axınını əvəz etmir. `purchase-receipt-ui-acceptance.json` qalan UI ssenarilərini açıq saxlayır; U4/U5 unit/API, digər qalıqlar backend acceptance ilə yoxlanıb, amma bunlar tam U1–U33 ekran UAT imzası deyil.

**Hələ texniki tərəfdən bağlanmayan:** U1–U33 üçün qeydiyyatda göstərilən qalan ssenarilərin tam UI e2e icrası və müştəri test tenant-da imzalı UAT. **Xarici owner qərarı tələb edən:** 29.10 snapshot-dakı 12 material/stock-lot fərqinin və 15 anbar residualının sətir-sətir izahı/təsdiqi, aktual snapshot-ın müştəri tərəfindən verilməsi, backup/rollback və pilot imzası, rollout vaxtı. Mövcud preflight yalnız sayları saxlayır; bu workspace-də owner-in hər sətri imzalaması üçün təsdiqli cari qalıq mapping-i və imza yoxdur. Bu qərarlar əvəzinə qalıq və stok yazılışı yaratmaq təhlükəsiz/əsaslı deyil. Production migration, push və release edilməyib.

## 11. 2026-11-02 UI UAT davamı və snapshot sətirləri

Layihələrarası transferin tam UI axını U21–U22 üçün yoxlanıldı: UAT Port layihəsinə göndərən təyin olunmuş Rauf 5 kisə imzaladı; UAT Sahə layihəsinə qəbul edən təyin olunmuş Nigar sənədi açıb qəbul imzası verdi. UI uğur mesajı və yenilənmiş `Təhvil alındı` statusu göstərdi. İzolyasiya sxemində sənəd `received` oldu, imza edənlər fərqli hesablar idi, mənbə Stock/StockLot 20-dən 15-ə, hədəf 0-dan 5-ə dəyişdi və 5 vahid transfer movement yazıldı. İlk yükləmədə Nigarın siyahısı köhnə cache göstərirdi; səhifə yenilənəndən sonra sənədlər göründü.

U27 üzrə UI-da 2 Poddon `UAT Supplier`-dən Port layihəsinin anbarına son tarix 2026-12-02 ilə qeydə alındı və Rauf qəbul imzası verdi. U28 üçün 2 vahid qaytarma sorğusu göndərildi və UI onu `təsdiq gözləyir` kimi saxladı. Supplier nümayəndəsinin imzalı qaytarma sənədi daxil edilmədən bu sorğu tamamlanmayıb. U29 itki/zədə, U30–U33 supplier qaytarması və kredit axınlarının UI e2e-si ayrıca tamamlanmayıb; onların DB/API acceptance nəticələri UI imzası sayılmır. UAT test hesabı üçün lokal login rate-limit aktivləşdiyindən bu sessiyada direktor hesabına yenidən keçib supplier imzası və son təsdiqi yoxlamaq mümkün olmadı.

29.10 dump-ın read-only sətir preflight-ı yenidən çıxarıldı və [purchase-receipt-ui-acceptance.json](source-audit/purchase-receipt-ui-acceptance.json)-a material/Stock/StockLot fərqləri və 15 location residualı ilə yazıldı. Dump SHA-256 əvvəlki auditlə eynidir. Sətirlər `seed-org-afez` və `seed-*` ID-lərindən ibarətdir; bunlar müştəri tərəfindən doğrulanmış qalıq deyil və production düzəlişinə əsas ola bilməz. JSON-da hər sətir owner qərarı gözləyir; hazırkı snapshot provenance-i müştəri ilə tutuşdurulmalıdır.

İşlək buraxılış qapıları: test tenant-da qalan UI ssenarilərinin davamı və müştərinin yazılı UAT imzası; sətir-sətir real qalıq/mənbə sənədi və owner qərarı; müştərinin aktual snapshot-ı; backup/rollback təsdiqi, pilot siyahısı və rollout vaxtı. İstifadəçinin ümumi davam icazəsi test və kod işinə tətbiq olundu; konkret fiziki qalıq rəqəmlərini və ya tarixi/rollout təsdiqini əvəz etmir.

## 12. 2026-11-02 UAT təkrarı: qəbul/reversal və anbar uzlaşdırma UI-si

Yeni `afez_uat_remaining_20261102` disposable sxemində Kamran (warehouse rolu) ilə Uzlaşdırma paneli açıldı. UI qiymət və payable məbləğini göstərmədi; 5 vahidlik transfer mərkəzi anbarda −5 və sahə anbarında +5 kimi ayrıldı, naməlum hərəkət ayrıca sayıldı və tanınan hərəkət xalisinə daxil edilmədi. Hər iki sətirdə Stock/lot fərqi 0 idi. Bu U18 məxfilik və U19 transfer/naməlum tip davranışının ekran yoxlamasıdır; U20-nin tarixi snapshot dry-run yoxlaması ayrıca read-only preflight olaraq qalır.

Həmin disposable sxemdə U8 üzrə 5 vahidlik alış qəbulu UI-dan yazıldı. Mənbədəki `cashPaid=20 AZN` borcu azaltmadı; DB-də qəbul və payable 50 AZN oldu. U9-da qəbul partiyasından 1 vahid istifadəyə çıxarılandan sonra tam reversal UI tərəfindən sərbəst partiya qalığı çatmadığı üçün bloklandı. U10-da test payable ödənilmiş vəziyyətə gətiriləndə UI maliyyə uzlaşdırması tələb edib reversal-i blokladı. U12-də linked receipt-i olmayan köhnə təsdiqli aktın reversal cəhdi manual maliyyə uzlaşdırması mesajı ilə dayandı və yenidən qəbul yaranmadı. Legacy aktın reyestr sətrində bu xəbərdarlıq əvvəlcədən görünmədiyi üçün onun görünən indikatoru ayrıca UX işi olaraq qalır.

U11 zamanı warehouse rolu ilə alış aktı reyestri boş göründü. `TenantDataService`-də `purchase-acts` oxu icazəsi `warehouse` qrupuna keçirildi; `RecordsService` anbardarın create/update/delete yazısını yenə qadağan edir və kommersiya sahələrini redaktə edir. Əlavə tenant-role test suite-i 10/10 keçdi. Lakin Nest watch yeni build-i işə salarkən Windows `taskkill` child-process icazə xətası aldı; mövcud UI-da aktlar açılmadı. Buna görə U11-in icazə unit testi keçib, təmiz backend restart-dan sonra UI yoxlaması isə açıqdır. Dəyişiklik user data-ya tətbiq edilməyib.

Yenilənmiş ssenari statusları və sübutlar [purchase-receipt-ui-acceptance.json](source-audit/purchase-receipt-ui-acceptance.json)-dadır. Bu təkrarda U8–U10, U12 və U18–U19 UI-da keçdi. U4–U5 UI replay, U11 təmiz restart-dan sonra, U13 full UI, U16 full UI və U20 target snapshot UI qalıb. U28 əvvəlki test sxemində supplier imzası gözləyir; U29–U33 tam ekran axınları da açıqdır. Müştərinin imzalı UAT-ı, 12 fərq/15 residual üçün owner-in sətir qərarları və aktual snapshot, backup/rollback, pilot, rollout pəncərəsi owner/customer təsdiqi tələb etdiyindən dəyişməyib.

## 13. 2026-11-02 tamamlanan UI UAT və ilkin dosyenin status icmalı

Disposable `afez_uat_ui_followup_20261102` sxemində U11, U16 və U28–U33 ekran işləri tamamlandı. U11: watch prosesi əvəzinə bir dəfəlik build-dən təmiz restart edildi; warehouse rolu akt siyahısını gördü, kommersiya məbləğləri gizli qaldı. U16: sintetik sübut faylı ilə supplier-credit sorğusu UI-dan göndərildi və rəhbər təsdiqindən sonra 2 disputed vahid həll olunaraq −10 AZN payable yarandı. U28: 2 Poddon üçün sintetik təchizatçı nümayəndəsi və sənəd istinadı daxil edildi; saldo bağlandı. U29: sintetik itki aktı rəhbər tərəfindən UI-da təsdiqləndi; qalıq 0 oldu və avtomatik payable yaranmadı.

U30–U33: qaytarma forması yalnız qəbul sətrinə bağlı partiyanı göstərdi, əlaqəsiz legacy partiya görünmədi; 1 vahidlik qaralama yaradıldı; 2 vahidlik əlavə rezerv cəhdi partiya qalığını aşdığı üçün bloklandı. Müxtəlif istifadəçilərlə direktor təsdiqi, anbardan çıxış, sintetik supplier imzası/sənədi və ayrı direktorun maliyyə krediti təsdiqi yerinə yetirildi. Maliyyə təsdiqində −5 AZN açıq payable yarandı; 1 vahid stock/lot/material yalnız dispatch zamanı azaldı. Bütün adlar/sənəd nömrələri və əlavə edilmiş sübutlar sintetik UAT məlumatıdır; müştəri/vendor imzası deyil.

U4–U5 eyni əməliyyat açarının UI-dan təkrar göndərilməsi kimi yoxlanıla bilmir: adi forma hər submit-də yeni təsadüfi idempotency açarı yaradır və replay idarəsi göstərmir. Same-key/same-body və changed-body halları backend unit testləri ilə əhatə olunub. U13 foreign-tenant ID normal UI selector-ları ilə qurula bilmir və backend acceptance ilə yoxlanıb. U20 tarixi dump-ı UI-a yükləyən read-only ekran yoxdur; dump üzrə ayrıca read-only preflight sübutu saxlanır. Buna görə bu üç hal UI UAT imzası kimi təqdim edilmir. Cari status [purchase-receipt-ui-acceptance.json](source-audit/purchase-receipt-ui-acceptance.json)-dadır; `overallUatComplete=false` saxlanır.

İlkin `CONSTRIX_31_10_2026_Techizat_Anbar_Dosye_v1.md` üzrə texniki qəbul axınlarının əksəriyyəti kodlanıb və acceptance/UAT sübutu var: qismən mədaxil və borc, tədarükçü üzrə ayrılıq, uzlaşma/credit/closure, transfer imzaları, custody/sərfiyyat, tara və goods-return maliyyə mərhələləri. Dosye bütöv şəkildə tamamlanmış sayılmır: inventarizasiya və tam anbar iyerarxiyası/məsul təyinatı, planlaşdırılmış material tələbatının smeta/QRP ilə end-to-end əlaqəsi, bütün ekranlar üzrə müştəri UAT imzası və production rollout ayrıca bağlanmalıdır. 29.10 dump-dakı 12 material fərqi və 15 residual üçün sətir-sətir owner qərarı, aktual snapshot, backup/rollback, pilot və rollout pəncərəsi xarici gate olaraq qalır. Açıq biznes qərarları: tara qaytarma müddətinin standartı, supplier return kreditinin hüquqi/maliyyə modeli, hissəli ödəniş qrafiki/xəbərdarlıqları. Barkod/QR məcburi tələb kimi təsdiqlənməyib. Production migration/deploy və müştəri datasına düzəliş edilməyib.

## 14. 2026-11-02 anbar strukturu və inventarizasiya

`202611020013_warehouse_counts` migration lokal `afez_db.public` bazasına backup-dan sonra tətbiq edildi. Backup: `backend/.local-backups/warehouse-before-20261102.dump`. Mövcud anbarların parent/məsul sahələri nullable saxlandı; real məsullar və sayım miqdarları avtomatik doldurulmadı.

Anbar strukturu panelində direktor kök/alt anbar, növ, layihə və şirkətin direktor/anbardar üzvlərindən məsul seçir. Dövr, foreign-tenant parent/məsul və layihə uyğunsuzluğu bloklanır. Mövcud anbarın layihəsi dəyişdirilmir; ümumi locations API ilə hierarchy/məsul qaydalarını keçmək və anbar silmək bağlanıb.

İnventarizasiya panelində təyin edilmiş anbardar və ya direktor material üzrə faktiki sayımı, səbəb və akt istinadını göndərir. Boş sətirlər sayımın əhatəsinə daxil deyil. Göndərmə stok yaratmır. Başqa direktorun təsdiqi fərqi Stock/Material/StockLot/Movement və auditə bir serializable tranzaksiyada yazır; rədd stok dəyişmir. Stok/partiya snapshot-u dəyişibsə, mövcud stok/lot/material fərqi varsa və ya aktiv rezerv/transfer/custody/supplier-return varsa düzəliş bloklanır. Artım ayrıca izlənən inventar partiyasıdır; azalma mövcud partiyalardan silinir. Payable yaranmır. Eyni qərarın replay-i ikinci stok yazısı yaratmır.

Disposable DB acceptance 6/6 keçdi: hierarchy/tenant/rol, pending və müstəqil qərar, azalma/replay, artım/payable ayrılığı, stale/self/reject/miqdar validasiyası, aktiv rezerv bloklaması və atomik rollback/sıfır sayım. Sübut: `source-audit/warehouse-control-acceptance.json`. Frontend/backend TypeScript və backend compile keçdi. Brauzerdə struktur və inventarizasiya formaları/boş hallar açıldı; bu UI smoke-dur, tam çoxrollu ekran E2E və müştəri UAT imzası deyil. 29.10 fərqləri bu migration ilə düzəldilmədi. Fiziki sayım, mövcud anbarların real məsulları və müştəri qəbulu açıqdır.

## 15. 2026-11-02 layihə material tələbatı və qəbul uzlaşması

Layihələr → Material tələbatı və Anbar → Plan tələbatı ekranları əlavə edildi. Smeta material sətri birbaşa plan yaradır; iş həcmi mühəndisin material/iş əmsalı ilə hesablanır. QRP və hazır mühəndis hesabı CSV/XLSX/XLS ilk vərəqindən `materialId, qty, unit, sourceRef` sütunları ilə idxal olunur; `sourceKind` və `coefficient` əlavə sütunlardır. İdxal faylının SHA-256 istinadı saxlanır; original faylın binary-si bu paneldə arxivləşdirilmir. Material/vahid uyğunluğu açıqdır, avtomatik qeyri-müəyyən ad və vahid çevrilməsi yoxdur.

Plan pending versiya kimi saxlanır, başqa direktorun təsdiqindən sonra qüvvəyə minir. Yeni təsdiqli versiya əvvəlkini superseded edir və tarixçə qalır. Mənbə smeta və ya vahid dəyişibsə plan stale göstərilir; köhnəlmiş mənbə ilə pending plan təsdiqlənmir. Plan heç bir stok və payable yaratmır.

Qalan təminat ehtiyacı canlı receipt tarixçəsindən hesablanır: plan − faktiki qəbul + fiziki göndərilmiş supplier-return − tamamlanmış layihələrarası xalis transfer. Mübahisəli miqdar təminat deyil; əvəz mal faktiki qəbulda sayılır; reversal qəbuldan çıxır. Artıq təminat ayrıca göstərilir. Təsdiqli custody sərfiyyatı ayrıca göstəricidir və satınalma ehtiyacını ikinci dəfə yaratmır. Hər hesab exact project/material ID və tenant üzrə aparılır; material/vahid uyğunlaşdırması olmayan qəbul ayrıca xəbərdarlıqdır.

İzolə DB acceptance 8/8 keçdi: üç mənbəli plan, real partial receipt/replacement, artıq qəbul/reversal, supplier-return/finance ayrılığı, ayrıca təsdiqli sərfiyyat göstəricisi, stale/revision tarixçəsi, tenant/rol/vahid/dublikat qoruması və digər layihə/transfer təcridi. Sübut: `source-audit/project-material-plan-acceptance.json`.

Tam UI axını disposable sxemdə keçirildi: planner smeta 10 + mühəndis 20×2 + QRP 5 daxil etdi; ayrı direktor 55 vahid planı təsdiqlədi; alış aktında 20 qəbul + 5 mübahisəli vahid UI-dan yazıldı; Anbar plan ekranı 55 plan / 20 qəbul / 35 qalan ehtiyac göstərdi. Bu sintetik testdir, müştərinin imzalı UAT-ı deyil. Fayl chooser ilə original QRP yüklənməsi bu UI run-da ayrıca icra edilməyib. Sübut: `source-audit/project-material-plan-ui-acceptance.json`. Disposable sxem və fixture helper təmizləndi.

`202611020014_project_material_plans` migration backup-dan sonra yalnız lokal `afez_db.public`-ə tətbiq edildi; 32 migration up-to-date-dir. Backup: `backend/.local-backups/project-material-plan-before-20261102.dump`. Frontend TypeScript və backend compile keçdi. Mövcud layihələrə uydurma plan rəqəmləri yazılmadı; real mənbələrin idxalı və müştəri qəbul imzası xarici gate olaraq qalır.

## 16. 2026-11-02 rəhbər sifariş paneli və qarışıq toplu təsdiq UAT-ı

Təchizat → Rəhbər paneli əlavə edildi və direktor üçün əsas tabdır. Layihə, sifarişçi, tarix aralığı, təcililik və status filtrləri var. Sifarişdə material, miqdar, qeyd, təcililik, tələb tarixi və anbar bölgüsü təsdiqdən əvvəl dəyişir. Təsdiq zamanı mənbə request.updatedAt yenidən yoxlanır; əvvəlki/yeni dəyərlər və bölgü auditdə saxlanır.

Sərbəst miqdar physical − aktiv rezerv − gözləyən/yolda transfer − məsul şəxsdə balans − pending supplier-return ilə hesablanır. Ümumi və həmin layihənin anbarlarından bölgü təklif edilir; rəhbər miqdarları dəyişir. Donor layihə üzrə fiziki/rezerv/sərbəst və təsdiqli planın qalan ehtiyacı göstərilir; donor stoku birbaşa request bölgüsündən götürülmür, ayrıca səbəbli və imzalı layihələrarası transfer axınına yönləndirilir. Qaralama alış qalığı və yolda transfer gözlənilən mədaxil kimi ayrıca göstərilir, sərbəst stoka əlavə edilmir.

Toplu qərar hər sifariş üçün ayrıca tranzaksiyadır: problemsizlər keçir, bloklananlar səbəblə problemli siyahıda və seçilmiş vəziyyətdə qalır. Eyni sifarişin bölgüsündə son sətrin konflikti əvvəlki rezerv yazılarını da rollback edir. Başqa sifarişin uğurlu qərarı saxlanır. Replay eyni rezervi ikinci dəfə yaratmır. Təsdiq yalnız rezerv yaradır; physical stock, lot, movement və payable dəyişmir. Təmin olunmayan hissə satınalma gözləyir.

Tam sintetik UI UAT keçdi: filtrlər tətbiq edildi; A anbarında physical 10 − rezerv 1 − transfer 2 − custody 1 − return 1 = free 5, B-də free 3 göstərildi. Donorda physical 20 / reserve 2 / free 18 / plan need 12 görünürdü. Sistem A5+B2 təklif etdi, direktor A4+B3 seçdi. İki sifarişin toplu təsdiqi 1 uğurlu / 1 problemli nəticə verdi; qty=0 sifarişi pending və seçilmiş qaldı. Həmin sifariş UI-da başqa materiala (Gravel), 3 kg, kritik təcililik, tarix və qeyd ilə düzəldilib ayrıca təsdiqləndi; 1 kg rezerv / 2 kg təminat gözləyir göstərildi. Səbəbli return/reject də UI-dan keçdi. Persisted DB qərarları, bölgülər, before/after audit və stok/borcun dəyişməməsi yoxlandı. Sübut: `source-audit/director-request-board-ui-acceptance.json`.

Disposable DB acceptance 7/7, frontend TypeScript və backend compile keçdi. Sübut: `source-audit/director-request-board-acceptance.json`. Test sxemləri və müvəqqəti helper təmizləndi. `202611020015_director_request_board` migration backup-dan sonra yalnız lokal `afez_db.public` bazasına tətbiq edildi. Backup: `backend/.local-backups/director-request-board-before-20261102.dump`. Mövcud sifarişlərə real təcililik/tarix uydurulmadı; default normal və nullable tarix saxlanır. Bu ekran sübutu müştərinin rəsmi UAT imzası deyil; production rollout/owner qalıq gate-ləri əvvəlki kimi qalır.
