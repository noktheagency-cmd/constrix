# Tamamlama icrası

Bu fayl davam edən işi göstərir; yekun qəbul aktı deyil. Rəsmi xarici inteqrasiyalar bu icradan çıxarılıb.

## 31 oktyabr 2026 daxili funksiyaların tamamlanması

- Smeta idxalı: vərəq, başlıq sətri və sütun xəritəsi seçimi; sıfır qiymətin düzgün oxunması; Azərbaycan rəqəm formatı; m²/m³/kq/ədəd uyğunlaşdırması; səhv rəqəm, mənfi həcm, boş vahid və obyekt/bölmə daxilində dublikat bloklaması. Xətalı önbaxışdan qismən idxal edilmir. İcrası/gündəliyi və ya təsdiqli aktı olan smeta idxalla səssiz əvəz edilmir.
- Nakopitel/F2/F3 üçün vahid naviqasiya girişi. F2 yaradılmasında hesabat ayı və bir/neçə ev seçimi; seçilməyən evlərin billedQty-si dəyişmir. 60 ev seçimi məhdud hündürlüklü, sürüşdürülən cədvəldədir.
- Gündəlik hesabat təsdiqi və ölçmə ayrıldı. Adi təsdiq smeta/irəliləyiş/xərc dəyişmir. Ayrı ölçmə endpoint-i tenant, rol, status, müqavilə qalığı, HR saatları, texnika, yanacaq və bağlı maliyyə dövrünü yoxlayır; həcmi/irəliləyişi/xərci bir serializable tranzaksiyada yazır. Təkrar açar eyni nəticəni qaytarır; yeni açarla ikinci ölçmə bloklanır. Mövcud təsdiqli gündəliklər `legacy` işarəsi ilə təkrar ölçülmür.
- Gündəlikdə 30-a qədər real şəkil: PNG/JPEG/WebP yüklənir, antivirusdan keçir və qorunan fayl ID-ləri saxlanır. Server başqa şirkətin, karantindəki və şəkil olmayan faylı gündəliyə bağlamağı rədd edir. Göndərilmiş/təsdiqli gündəliyin məzmunu generic API ilə dəyişdirilmir; təsdiq və ölçmə yalnız xüsusi endpoint-lərdədir. Sahənin tabel, texnika və qeyd tabları seçilmiş layihəyə görə süzülür.
- BOQ-da marka/model/istehsalçı/mənşə və təsdiqləyən mənbə saxlanır. Atribut dəyişəndə yenidən təsdiq tələb olunur. “Bazaya yaz” təsdiq, sourceRow, tarix və mənbəni artıq itirmir. Tarif/region/kataloq qiyməti dəyişəndə təsdiq ləğv edilir.
- Orijinal BOQ ixracında E/F/G/J/K məhdudiyyəti çıxarılıb: istifadəçi mənbə və qiymət sütunlarını seçir. Formula üzərinə yazmaq bloklanır. Texniki atributlar seçilərsə, şablona dörd yeni sütun əlavə etməyə ayrıca icazə və başlıq sətri tələb olunur. Mövcud sütunlar yerini dəyişmir; digər ZIP üzvləri dəyişmir. Daxili marja və attributeSource çıxışa əlavə edilmir.
- İcmalda real yanacaq qeydlərindən altı aylıq tarixçə, cari ayın xərc/litr cəmi və tamamlanmış aylar üzrə proqnoz var. Cari natamam ay proqnoza daxil edilmir; müşahidə dövründə boş aylar sıfır sayılır. Məlumat yoxdursa proqnoz uydurulmur. Yanacaq kartı provayder qalığı bu hesablamaya daxil deyil.
- Market hadisələri iştirakçı şirkətlərə tətbiqdaxili bildiriş və xarici provayderi gözləyən çıxış növbəsi yaradır. Mesaj məzmunu, qiymət və ERP məxfiliyi bildiriş mətninə çıxmır. Shell bazar bildirişlərini `/market` səhifəsinə yönləndirir.
- API xətalarında serverin yaratdığı `X-Request-ID` var; gözlənilməz 500 xətası daxili məlumatı istifadəçiyə qaytarmır. İstifadəçi mesajında izləmə nömrəsi görünür.

Yoxlama: 98 frontend testi, 72 backend testi, 1 HTTP e2e testi və izolə olunmuş PostgreSQL sxemində 32 qəbul yoxlaması keçdi. TypeScript və Nest build keçdi. İki əlavə miqrasiya lokal bazaya tətbiq edildi. Brauzerdə vahid naviqasiya, F2 ay/ev seçimi və gündəlik şəkil forması yoxlandı. 390 px mobil görünüşdə səhifə eni 390 px-dir; konsolda xəta yoxdur. Qəbul JSON-u son icra vaxtını saxlayır. Bu nəticələr konkret yoxlanan axınlara aiddir; Word-dəki bütün modullar üçün istehsal qəbul aktı deyil.

Xarici inteqrasiya sərhədi dəyişməyib: tam AI/OCR/tender portalı, canlı hava, e-poçt/SMS göndərmə və onlayn ödəniş/webhook qoşulmayıb. Vergi, real komissiya tarifləri və digər açıq biznes qərarları uydurulmayıb.

## Son icra: istifadəçinin beş addımı və bildiriş paneli

1. **Market frontend/backend/DB:** `/market` açıq kataloq, aktiv şirkət, hüquqi qeydiyyat, məhsul/moderasiya, RFQ, versiyalı təklif, sifariş, sənədli çatdırılma, qismən qəbul/mübahisə/qaytarma, ERP bağlantısı, komissiya/bank qəbzi və qəbul icazəsi ekranları əlavə edildi. İzolyasiya olunmuş iki şirkətlə canlı brauzerdə RFQ → təklif → sifariş → təsdiq → çatdırılma → “Tam qəbul” yoxlandı. Main bazaya test sifarişi yazılmadı.
2. **F2/F3 və maliyyə düzəlişləri:** dar, tenant-scoped, idempotent tranzaksiya endpoint-ləri; F3 mənbə/müqavilə hesablarının yoxlanması; F3-dən asılı F2 kilidi; səbəb tələb edən qaytarma; alışda partiya/stok/borc əks qeydləri; ödənilməmiş qaimədə ilkin qeyd + mənfi əks qeyd. Ödənilmiş sənəd və istifadə edilmiş stok avtomatik geri çevrilmir; uzlaşdırma tələb edir. Generic API təsdiqli F2/F3/alışı silmir və dəyişmir.
3. **Orijinal Excel:** BOQ qiymət təsdiqi, mənbə sətri və qiymət tarixi DB-də saxlanır. Təqdim edilən AZCDG şablonunda yalnız uyğun J/K qiymət xanaları dəyişir; 37 digər ZIP üzvü bayt-bayt eyni qaldı, düsturlar saxlandı, müstəqil ZIP CRC testi keçdi. Alış/Nakopitel üçün tam orijinal arxiv yükləməsi qalır; J/K qiymət ixracı AZCDG üçündür. Mənbə formula xətaları avtomatik düzəldilmiş sayılmır.
4. **Bildiriş və antivirus:** açılışda və hər 15 dəqiqədə planlayıcı, DB kilidi/unikal açarla təkrarsız tətbiqdaxili və provayder gözləyən çıxış növbəsi. Windows Defender ilə real zərərsiz fayl yükləmə, dəyişməz versiyalar, tenant download və karantin bloklaması yoxlandı. Shell server bildirişlərini də oxuyur və 60 saniyədə yeniləyir.
5. **Qəbul/bərpa/təlimat:** 25 real PostgreSQL qəbul yoxlaması; 63 backend və 90 frontend testi keçdi. Snapshot ehtiyat nüsxəsi ayrıca test bazasına bərpa olundu; 166 cədvəlin say və məzmun checksum-ları uyğun gəldi. Təlimat: `docs/market-and-documents-guide.md`; API/icazələr: `docs/market-api.md`. Backend build, frontend typecheck/build keçdi.

**Bildiriş redesign:** sabit başlıq, say, bağlama düyməsi, növə görə ikon/rəng, real mənbə tarixləri, 440px maksimum daxili scroll, bütün bildirişlər; “klik edib keç” köməkçi yazısı yoxdur. Əsas UI-da mouse-wheel daxili scroll yoxlandı. Yeni server bildirişləri ilə panel 27 qeyd göstərdi.

Bu nəticələr yuxarıdakı konkret axınlara aiddir; bütün əvvəlki Word auditinin hər maddəsi və bütün brauzer/telefon kombinasiyaları üçün 100% yekun qəbul iddiası deyil. Rəsmi provayderlər və real bank köçürməsi bu icraya daxil deyil.

## İstifadəçi tərəfindən təsdiqlənən qərarlar

- Komissiya prioriteti: müqavilə → şirkət → kateqoriya → standart. Real faizlər admin tərəfindən təyin edilir; tarif yoxdursa hesablaşma gözləyir.
- `tenant-isolation-proposal.md` üzrə köhnə ERP modellərində tenant filtrləri; layihədən və seed prefiksindən etibarlı sahiblik; naməlum sahiblik silinmədən gizlədilir.

## İcra edilən və yoxlanan

- 58 əsas köhnə modeldə tenant sahəsi; 56 modelə yeni sahə əlavə edilib. List/read/create/update/delete aktiv şirkətə bağlanıb.
- Sərbəst relation injection və başqa şirkətin parent/child ID-ləri bloklanır. Audit redaktə/silmə API-si bağlanıb. Anbardar/sahə istifadəçisinə maliyyə sahələri qaytarılmır.
- Person direktor tapılması, işçi siyahısı, aktivlər, layihə maliyyəsində əlavə tenant boşluqları bağlanıb.
- Boş şirkətə nümunə ERP məlumatının göstərilməsi çıxarılıb.
- Tender çıxarışı insan təsdiqindən əvvəl bazayla müqayisə etmir. Mənbə hash-i, dəqiq çıxarış, versiya saxlanır. Səhifə məlum deyilsə uydurulmur.
- Tender təsdiqçisi və yekun təsdiqçi, şəxsi qərar tarixçəsi, məzmun versiyası, yenidən təsdiq və təqdimetmə sübutu hazırlanır.
- F2 təsdiqi və alış aktı qəbulu üçün ayrıca, dar tranzaksiyalı endpoint-lər əlavə edilib. Stok/material/borc/audit bir tranzaksiyadadır; təkrar açar qorunur.
- Ümumi köhnə UI sinxronizasiyasındakı PUT/PATCH uyğunsuzluğu və xətaların gizlədilməsi düzəldilib.
- PWA manifesti, yalnız statik fayl keşi və API/ödəniş/təsdiq üçün offline bloklama əlavə edilib.
- Komissiya prioriteti, Decimal hesabı, qismən qəbul/mübahisə, 7/15/30 gün və aylıq hesab üçün saf hesablama qaydaları və testlər əlavə edilib.

## Hələ yekun qəbul gözləyən işlər

### 29 oktyabr: son yoxlama

- Lokal bazada 58 köhnə model yoxlandı: 469 qeyd sahib şirkətə bağlıdır; 12 işçi və 1 audit qeydi sahibi bilinmədiyinə görə silinmədən gizlədilib. Mövcud olmayan şirkətə bağlı qeyd tapılmadı (`tenant-verification.json`).
- Market-in şirkət/məhsul moderasiyası, RFQ/təklif/sifariş, qəbul, mübahisə, qaytarma, iki tərəfli komissiya, bank qəbzinin manual təsdiqi üçün DB/API kodu əlavə edilib. Tam istifadəçi interfeysi və real DB qəbul sınaqları hələ tamamlanmayıb.
- Fayl versiyaları, imza/uzantı yoxlaması, 20 MB həddi, Office arxiv hədləri, antivirus karantini və autentifikasiyalı sənəd paylaşımı əlavə edilib. Antivirusun işləməsi ayrıca runtime yoxlaması tələb edir.
- Backend: 12 suite / 57 test keçdi. Backend və frontend build keçdi. Bu nəticələr bütün texniki tapşırığın yekun qəbulunu əvəz etmir.
- Market qaytarmasında partiya qalığı və sifarişin qəbul qalığı da tranzaksiyada azalır. Bildirişlər vaxt müqayisəsi ilə deyil, unikal açar və tranzaksiya kilidi ilə təkrardan qorunur.

- Açıq B2B Market-in tam DB/API/UI axını, moderator, RFQ/təklif/sifariş/çat, qəbul icazələri, komissiya reyestri və manual ödəniş təsdiqi.
- Bütün qeyri-kritik və digər kritik köhnə əməliyyatların serverdə tamamlanması; F2/F3 düzəlişi, satınalma qaytarılması və maliyyə əks əməliyyatları.
- Müştərinin orijinal Excel şablonuna təhlükəsiz qiymət ixracı və tam struktura aid qəbul sınaqları.
- Material sənədləri/versiyaları və fayl təhlükəsizliyinin tam tətbiqi.
- Bildiriş planlayıcısı, tətbiqdaxili kanallar və xarici provayderə bağlanmamış e-poçt/SMS çıxış növbəsi.
- Yeni tender təsdiq UI-sinin və bütün dəyişikliklərin canlı brauzer/iki şirkətli DB qəbul sınaqları.
- İstifadəçi/administrator təlimatı, API/icazə sənədi və ehtiyat nüsxənin bərpa sınağı.

Geniş dinamik əməliyyat endpoint-i və avtomatik kütləvi call-site dəyişmə skripti avtomatik təhlükəsizlik yoxlaması tərəfindən rədd edildi və tətbiq edilmədi. Əvəzinə F2 və alış qəbulu üçün konkret endpoint-lər tətbiq olunur; digər əməliyyatlar da ayrıca yoxlanaraq keçirilməlidir.
