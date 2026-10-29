# CONSTRIX texniki tapşırıq və Excel uyğunluğu

Tarix: 29 oktyabr 2026. Mənbə: `CONSTRIX_Texniki_Tapsiriq_v1.docx`, versiya 1.0, 17.10.2026; istifadəçinin təqdim etdiyi üç Excel; cari mənbə kodu və yerli PostgreSQL bazası.

**Word sənədinin bütün tapşırıqları tamamlanmayıb.** Ekranların olması tam biznes axınının, server yoxlamalarının və istehsal inteqrasiyalarının hazır olduğunu göstərmir. Aşağıdakı qiymətləndirmə kod auditidir; ayrıca göstərilməyən maddələr üçün istehsal qəbul sınağı aparıldığı iddia edilmir. Sənəddəki AÇIQ/TƏKLİF maddələri məcburi təsdiqlənmiş biznes qaydası kimi tətbiq edilməyib.

## Əsas çatışmazlıqlar

1. Köhnə ümumi Records API-lərində tenant və obyekt filtrləri yoxdur: `backend/src/records/records.service.ts` daxilində `findAll` yalnız `take:500`, `findOne` yalnız ID ilə işləyir. `RolesGuard` rol yoxlayır, şirkət mülkiyyətini yoxlamır. Yeni platform API-lərinin bir hissəsində tenant filtrinin olması bu boşluğu bağlamır. Başqa şirkət məlumatından izolyasiya tamamlanmış sayılmır.
2. Tam açıq B2B MARKET, moderator təsdiqi, ikitərəfli qəbul komissiyası və 7/15/30 günlük borc dövrü tamamlanmayıb. `ServiceCharge` ümumi xidmət haqqıdır; qəbul ID-si və hər iki tərəfin dərəcə snapshot-u olan komissiya reyestrini əvəz etmir.
3. Tender oxuma metodu insan təsdiqindən əvvəl `scoreChecks` çağırır. Mənbə səhifəsi/bəndi, etimad və dəyişiklikdən sonra təsdiqin ləğvi bütün axın üzrə saxlanmır.
4. Müştərinin Excel şablonuna qiymətləri geri yazan və bütün format/formulları qoruyan tam iş axını yoxdur. Yeni orijinal-fayl arxivi mənbəni qoruyur, redaktə edilmiş şablon ixracını əvəz etmir.
5. SMS/e-poçt göndərmə provayderləri, ödəniş webhook-u, antivirus, PWA service worker və tam qəbul/idempotentlik axını üzrə icra sübutu yoxdur.

## Word üzrə maddə-maddə vəziyyət

| Bölmə | Vəziyyət | Kodda olan və qalan iş |
|---|---|---|
| 0 — İcra sərhədləri | Nəzərə alınıb | Açıq komissiya, vergi və provayder qərarlarına yekun biznes qaydası verilə bilməz. |
| 1 — Brauzer ERP və çox istifadəçi | Qismən | React, Nest, PostgreSQL, istifadəçi və təşkilat modelləri var; filial və obyekt səviyyəsində tam icazə sınağı yoxdur. |
| 1 — Ayrı ERP və açıq MARKET | Qismən | Daxili bazar/RFQ ekranları var. Abunəsiz, girişsiz açıq B2B məhsul axını tamam deyil. |
| 1 — Tenant/layihə/anbar/sənəd icazəsi | Tamam deyil | `TenantService` yeni platform metodlarında istifadə olunur; ümumi Records API boşluğu yuxarıda göstərilib. |
| 1 — Dəyişməz maliyyə/miqdar auditi | Qismən | AuditEntry və frontend audit hadisələri var; bütün yazmaların əvvəlki/yeni dəyəri ilə serverdə dəyişməz audit zəmanəti yoxdur. |
| 1.1 — Əsas obyektlər | Qismən | Təşkilat, layihə, material, RFQ, akt, BOQ var. Qəbul əsaslı komissiya və tam iyerarxiya/versiya əlaqələri tamam deyil. |
| 2.1 №1 — Kabinet profilə keçirilsin | Əsas UI var | Ayrı İnşaat/Kabinet menyusu yoxdur, Shell profil/şirkət girişləri mövcuddur. Rol üzrə bütün redaktə ssenariləri ayrıca qəbul testinə ehtiyac duyur. |
| 2.2 №2 — Hava İcmalda | Qismən | Dashboard hava və sahə kartları, WeatherProof və WeatherFeed var. Canlı provayder aktivliyi və dayanma qeydlərinin bütün meyarları təsdiqlənməyib. |
| 2.3 №3 — Pasport Anbar kartında | Qismən | Material/sənəd ekranları var; çox sənəd, versiya, son tarix və qorunan önbaxışın bütöv axını tamamlanmış sayılmır. |
| 2.4 №4 — Spesifikasiya | Açıq qərar | Mövcud spesifikasiya qorunur; layihə içinə köçürülmə sənəddə yekun təsdiqlənməyib. |
| 2.5 №5 — Vahid Sahə idarəetməsi | Qismən | Sahə tabları, gündəlik, briqada/texnika/işçi məlumatı var. `approveReport` smeta həcmi və xərcləri dəyişir; ölçmə/təsdiq ayrılığı tam qəbul testi tələb edir. |
| 2.5 — Çox foto, HR seçimi, əl ilə daxil etmənin auditi | Qismən | Hesabat və HR əlaqələri var; hər istisnanın server auditi və bütün foto yükləmə təhlükəsizliyi təsdiqlənməyib. |
| 3 №6 — Nakopitel → F2 → F3 | Qismən | `Forma2.tsx`, `Forma3.tsx`, `nakopitel.ts`, `ops.ts`; layihə/smeta/akt əlaqələri var. Tək modul iyerarxiyası və obyekt seçimi tam deyil. |
| 3 — Excel idxalı və önbaxış | Qismən | `smetaIo.ts` ev/bölmə/iş oxuyur və xəta qaytarır. Bütün şablonlar üçün sərbəst sütun uyğunlaşdırma və vahid normallaşdırma tamam deyil. |
| 3 — İş kodu, təsvir, vahid, müqavilə miqdarı/qiymət | Var | SmetaLine modeli; 60 ev üzrə tam baza bu yoxlamada idxal edilib. Təsdiqli dəyişikliklərin versiya reyestri ayrıca tələb olunur. |
| 3 — Əvvəlki/cari/yığılan/qalıq | Var, UI genişləndirildi | Əvvəl yalnız bəzi məbləğlər görünürdü. İndi miqdar və məbləğ sütunları UI və Nakopitel ixracında göstərilir. Mənbə snapshotları ayrıca saxlanır. |
| 3 — Eyni həcmin iki dəfə aktlaşdırılmaması | Qismən | Domain test keçir; bu, paralel server sorğularının DB tranzaksiyası ilə qorunduğunu sübut etmir. |
| 3 — Bir/neçə ev üzrə F2 | Qismən | Ev/bölmə məlumatı var; bütün seçmə və konsolidasiya ssenariləri qəbul edilməyib. |
| 3 — Bir neçə təsdiqli F2-dən F3 | Qismən | Forma3 və mənbə akt əlaqələri var; versiya/düzəliş və paralellik sınaqları qalır. |
| 3 — Baza dəyişəndə köhnə akt sabit qalsın | Qismən | Təsdiqli akt olduqda smeta idxalının bloklanması testi var. Tam təsdiqli dəyişiklik/versiya prosesi yoxdur. |
| 3 — Excel/PDF və statuslar | Qismən | İxrac/önbaxış var; sənəddəki bütün status/versiya keçidləri və çoxsəhifəli çap qəbul edilməyib. |
| 4.1 №7 — Tender fayl/link analizi | Qismən | Mətn oxuma və qayda əsaslı `tender-brief.ts` var; tam AI inteqrasiyası və etibarlı portal/link oxuma sübutu yoxdur. |
| 4.1 — Mənbə/bənd/etimad | Tamam deyil | Hər tələbin səhifə və çıxarışla daimi versiyalı saxlanması yoxdur. |
| 4.1 — İnsan təsdiqindən sonra müqayisə | Uyğunsuzluq | `PlatformService.readTender` dərhal `scoreChecks` çağırır. |
| 4.1 — HR/texnika/maliyyə ilə uyğunluq | Qismən | Faktların toplanması və skor var; mövcudluq tarixləri, tam sənəd əhatəsi və versiya təsdiqi tamam deyil. |
| 4.2 №8 — BOQ və resurs komponentləri | Qismən | BOQ, material/əmək, dolayı/üstəlik xərc, texnika və qiymət qaydaları var. Bütün işlər üçün normativ və fakt sərfi mənbəsi təsdiqlənməyib. |
| 4.2 — Marka/model/istehsalçı/mənşə sübutu | Qismən | Kataloq sahələri və resurs əlaqələri var; istehsalçı mənbəsindən yoxlanmış təklif axını tamam deyil. |
| 4.2 — Qiymət normallaşdırma və təsdiq | Qismən | Qiymət aktuallığı, təsdiq/uyğunsuzluq UI-si var; valyuta/vahid/ƏDV/bütün tarixi mənbələrin eyni server siyasəti ilə işləməsi tam deyil. |
| 4.2 — Müştəri orijinal şablonuna ixrac | Tamam deyil | Mənbə arxivi və dəqiq orijinal yükləmə əlavə edilib. Redaktə edilmiş Excel-də formul/format saxlanması ayrı işdir. |
| 4.2.1 — 60/30/60/30/15/60/30 gün | Qismən | `isStale`, qiymət qaydaları var. Hər kateqoriya üzrə sənəddəki limitlərin admin redaktəsi və bütün qiymətlərə tətbiqi ayrıca qəbul edilməlidir. |
| 4.3 №9 — Bank zəmanətləri | Qismən | GuaranteeCase, bank tərəfdaşları, nominal və sənədlər var. Bloklanmış pul/girov/komissiya/faktiki kreditin tam ayrılığı və maliyyə uzlaşması tamam deyil. |
| 4.3 — AI çıxarışı və 30/15/7/1 bildiriş | Qismən | Zəmanət hesabları/xəbərdarlıqlar var; insan təsdiqli sənəd çıxarışı və dayanıqlı bildiriş planlayıcısı sübut edilməyib. |
| 4.4 №10 — Tenderə aid sənəd yoxlaması | Qismən | TenderCheck/Approval mövcuddur. `/yoxlama` hələ şirkət üzrə ümumi reyestr xarakteri daşıyır. |
| 4.4 — Sənəd təsdiqçisi, yekun təsdiqçi, yenidən təsdiq | Qismən | Təsdiq sətirləri var; məcburi sənəd blokları, dəyişikliyin təsdiqi ləğv etməsi və faktiki təqdimetmə sübutu bütöv deyil. |
| 5 — Sahə tələbi → rəhbər təsdiqi → satınalma | Qismən | Request, PurchaseOrder, qəbul/anbar domain funksiyaları var; dəyişən rol/limitlərin server qorunması tamam deyil. |
| 5 — Qəbulun bütün rekvizitləri və sənəd arxivi | Qismən | Material, miqdar, qiymət, təchizatçı, layihə əlaqələri var; avtomobil/imzalı qaimə və tam sənəd təhlükəsizliyi qəbul edilməyib. |
| 5 — Anbardara qiymətləri gizlətmək | Tamam deyil | Ümumi API rol yoxlaması sahə səviyyəsində qiymət redaksiyasını təmin etmir. |
| 5 — Faktiki qəbuldan sonra stok | Domain səviyyəsində var | Qəbul və geri qaytarma testləri keçir; server paralellik/idempotency qəbul testi qalır. |
| 6.1 — Kassa/bank, debitor/kreditor, sənəd əlaqəsi | Qismən | Maliyyə ekranları və modelləri var. Tam mühasibat uzlaşması və bütün düzəlişlərin silməsiz əks əməliyyatı sübut edilməyib. |
| 6.1 — Zəmanət/kredit/girov/market komissiyası ayrılığı | Tamam deyil | Xüsusilə marketplace qəbul komissiyası reyestri çatışmır. |
| 6.2 — HR/davamiyyət/təyinat | Qismən | HRM ekranları, işçilər, tabel, məzuniyyət, layihə əlaqələri var; bütün məkan/rol ssenariləri qəbul edilməyib. |
| 6.3 — Tapşırıq/bildiriş mərkəzi | Qismən | Tapşırıqlar və daxili bildiriş var; tenant/layihə/anbar üzrə tam filtr və xarici kanallar tamam deyil. |
| 6.4 — İcmal/texnika/yanacaq proqnozu | Qismən | İcmal və texnika/yanacaq domain məlumatları var; kart qalığı, aylıq tarixçə və proqnozun tam real məlumat inteqrasiyası təsdiqlənməyib. |
| 7.1 №11 — Abunəsiz açıq MARKET və moderator | Tamam deyil | Təşkilat/üzvlük var; VÖEN/hüquqi sənəd moderasiyası olmadan RFQ-ni qadağan edən tam axın yoxdur. |
| 7.2 — Vahid məhsul və insanla dublikat birləşdirmə | Qismən | Kataloq var; tam moderasiya/birləşdirmə, aktuallıq və regiona görə neytral sıralama tamam deyil. |
| 7.3 — RFQ/açıq-qapalı/tam-qismən təklif | Qismən | PriceInquiry, InquiryLine, SupplierBid və seçmə var; çox təchizatçıya açıq kateqoriya/region yayımı və tam məxfilik tamam deyil. |
| 7.3 — Təchizatçıların qiymət izolyasiyası | Risk var | `incomingInquiries` `bids:true` qaytarır; tam çox təchizatçılı modeldə sahə filtri tələb olunur. |
| 7.3 — İctimai sabit qiymət olmasın | Tamam deyil | Mövcud daxili Bazar kataloqu qiymət göstərir; ayrıca ictimai RFQ-only məhsulu ilə ayrılmayıb. |
| 7.4 — RFQ/sifariş üzrə çat, fayl, bildiriş | Tamam deyil | Ayrı RFQ/sifariş söhbət tarixçəsi və fayllarının tam axını yoxdur. |
| 7.5 — Çoxmərhələli qəbul və məbləğ limiti | Qismən | Qəbul funksiyaları var; layihə/anbar/məbləğə görə elektron qəbul limiti tamam deyil. |
| 7.5 — Mübahisəli hissə komissiyadan çıxsın | Tamam deyil | Dispute modeli ümumidir; qəbul sətri və gözləyən komissiya ilə tam əlaqə yoxdur. |
| 7.6 — İkitərəfli komissiya/snapshot/əks əməliyyat | Tamam deyil | Qəbul ID-si üzrə iki borc, tarif snapshot-u və qaytarma reyestri yoxdur. |
| 7.6 — Bank təsdiqi/onlayn webhook | Tamam deyil | Abunə qəbzi qeyd etmə funksiyası marketplace komissiyasının provayder ödənişini əvəz etmir. |
| 7.6 — Aylıq hesab/7-15-30 gün məhdudiyyət | Tamam deyil | Müddətli borc, qismən ödəniş, bərpa, köhnə sifarişlərin açıq qalması üzrə tam proses yoxdur. |
| 7.7 — Daxili/e-poçt/SMS/PWA/offline | Qismən | Responsiv UI və daxili bildiriş var. E-poçt/SMS provayderi və PWA service worker tapılmadı. |
| 7.8 — Market → ERP ilkin qeyd və bir dəfə ötürmə | Qismən | Daxili sifarişlər var; müstəqil market sifarişinin idempotent ERP ötürülməsi tam deyil. |
| 7.9 — Minimum admin girişi, fayl/AI məxfiliyi | Tamam deyil | Tenant xidmətinin əhatəsi qeyri-bərabərdir; köhnə API və fayl/AI siyasəti boşluqları qalır. |
| 8 — Səlahiyyət matrisi | Qismən | `auth/access.ts`, `tenant.service.ts` var. Market moderatoru/maliyyəsi və layihə/anbar limitləri tam deyil. |
| 9 — Funksional maketlər | İstinad | Bunlar hazır ekran şəkilləri deyil. Məhsul/RFQ/qəbul ekranlarının görünməsi 7-ci bölmənin qəbulunu sübut etmir. |
| 10 — Vəziyyət maşınları | Qismən | Enum/statuslar var; hər keçidin serverdə bloklanması və yenidən təsdiq bütün modullarda eyni səviyyədə deyil. |
| 11 — Tranzaksiya/idempotency/dəyişməz audit | Tamam deyil | Bəzi tranzaksiyalar var; bütün kritik əməliyyatlar üzrə təminat yoxdur. |
| 11 — Fayl/antivirus/ölçü/giriş/versiya | Qismən | Format/məzmun qaydaları var; `scanUpload` antivirus deyil. |
| 11 — Kart məlumatı/webhook/MFA/backup | Tamam deyil | Ödəniş provayderi seçimi açıqdır; webhook, MFA və yoxlanmış bərpa planı təsdiqlənməyib. |
| 11 — Decimal/valyuta/vahid/ixrac/request ID | Qismən | DB Decimal və yuvarlaqlaşdırma var, frontend Number istifadə edir. Tam normallaşdırma, bütün ixrac və request-ID meyarları qəbul edilməyib. |
| 12 A–G — İcra mərhələləri | Tamam deyil | B/C/D/E qismən; marketplace maliyyəsi və istehsal buraxılışı üzrə boşluqlar var. |
| 13 — Açıq qərarlar | Açıq saxlanır | AI paylaşım siyasəti, real komissiyalar/prioritet, vergi, provayder, spesifikasiya yeri, kabinet dəqiq forması, GPS/biometrika və buraxılış tarixi. |
| 14 — Təhvil paketi | Qismən | Kod/sxem/testlər var; tam API/rol matrisi, təhlükəsizlik/pilot nəticələri, əməliyyat təlimatı və backup qaydası hazır deyil. |

## Minimum qəbul testləri

| Test | Audit nəticəsi |
|---|---|
| T-01 tenant RFQ/fayl izolyasiyası | Tam qəbul deyil; köhnə API filtrləri çatışmır. Yeni Excel API üçün ayrıca tenant testləri keçir. |
| T-02 moderator təsdiqindən əvvəl RFQ/təklif bloklansın | Tamam deyil. |
| T-03 təchizatçı qiymətləri bir-birindən gizlənsin | Tam çox-təchizatçı inteqrasiya testi yoxdur. |
| T-04 60/100 qəbul üçün iki komissiya | Mexanizm tamam deyil. |
| T-05 təkrar qəbul komissiya yaratmasın | Mexanizm tamam deyil. |
| T-06 5 mübahisəli vahid komissiyaya daxil olmasın | Mexanizm tamam deyil. |
| T-07 7/15/30 gün, mövcud sifariş açıq qalsın | Mexanizm tamam deyil. |
| T-08 aylıq hesab ödənmiş borcu təkrarlamasın | Mexanizm tamam deyil. |
| T-09 insan təsdiqindən sonra tender müqayisəsi | Uyğunsuzluq: readTender dərhal skorlayır. |
| T-10 zəmanət nominalı bank borcu deyil | Tam maliyyə inteqrasiya testi yoxdur. |
| T-11 F2 təkrar həcm bloklaması | Domain testi keçir; paralel server testi tələb olunur. |
| T-12 müştəri Excel formula/format saxlanması | Orijinal faylların SHA-256 yoxlanması var; dəyişdirilmiş şablon ixracı tamam deyil. |
| T-13 PWA iki dəfə qəbul klikindən dublikat olmasın | PWA/ümumi idempotent qəbul tamam deyil. |
| T-14 sahə işçisinin qəbul məbləğ limiti | Tamam deyil. |
| T-15 qəbuldan əvvəl stok artmasın | Domain qəbul/geri qaytarma testi keçir; bütün server yollarının qəbulu deyil. |

## Excel strukturu və idxal

| Mənbə | Əvvəlki vəziyyət | İndi bazaya əlavə edilən |
|---|---|---|
| alış aktı.xlsx | Xocalı aktları yox idi; UI bəzi sütunları göstərmirdi | 57 vərəq, 28 506 xana. 54 əsas akt, 2 126 material sətri; ayrıca 6 qiymət fərqi olan əlavə akt. |
| Nakopitel F2.xlsx | Xocalı bazası yox idi; cədvəl 9 sütun idi | 9 vərəq, 522 074 xana; 60 ev, 8 857 smeta sətri (7 889 iş, qalanı ev/bölmə); 3 F2 sənədi, 9 780 iş sətri. |
| AZCDG…ISCG.xlsx | BOQ bazasında yalnız 4 nümunə sətri vardı | 9 vərəq, 5 020 xana; Direct_DK və Direct_MH üzrə 58 ölçülmüş iş sətri, 43 dolayı/üstəlik xərc sətri ayrıca BOQ kitabına əlavə edilib. |

Ümumi: 75 vərəq, 555 600 dolu xana. Mənbə fayllarının orijinal binary nüsxəsi, SHA-256, bütün qeyri-boş xana dəyərləri, formullar və rəqəmlərin dəqiq mənbə mətni saxlanır. Formatlar, şəkillər, birləşdirilmiş xanalar və digər Excel obyektləri orijinal yükləmə ilə qorunur; brauzer cədvəli tam Excel renderi deyil.

`/alis-akti`, `/forma-2`, `/boq` daxilində **Excel mənbəsi** tabı bütün vərəqlər, bütün dolu sütunlar, axtarış və 50 sətirlik səhifələmə verir. Təkrar olan Ümumi/Qaralama və Nakopitel snapshot vərəqləri ayrıca yeni alış/akt öhdəliyi kimi iki dəfə yazılmır, amma mənbə tabında və DB arxivində tam qalır. AZCDG Offer_Auto, Summary, Scope_Matrix, Org_chart və Planning də tam arxivdə görünür; bunların hər biri ayrıca icra modulu kimi avtomatik çevrilməyib.

Alış aktının Ümumi tabına **nağd ödəniş, qeyd və göndərən**, Əlavə tabına **dəyər** əlavə edildi. Redaktə zamanı əvvəldən olan nağd ödənişin itməsi düzəldildi. Nakopitel ekranı və yeni ixracı **əvvəlki, yığılan, cari və qalıq miqdar/məbləğ** cütlərini göstərir.

İdxal mövcud qeydləri silmir. Aktlar qaralamadır; stok, borc, ödəniş, təsdiq və müqavilə ƏDV-si avtomatik yaradılmayıb. Naməlum tarix və ziddiyyətli hesabat ayı boş saxlanıb. Smeta/BOQ normal əməliyyat modellərinin mövcud Decimal dəqiqliyinə uyğun yuvarlaqlaşdırılır; mənbə rəqəmlərinin daha yüksək dəqiqliyi arxivdə və orijinalda qalır. Bütün F2 iş sətirləri ev/kod/ad ilə smetaya uyğunlaşdırılıb; uyğunlaşmayan sətir sayı 0-dır.

## Mənbənin özündəki problemlər

- `alış aktı.xlsx` daxilində `--.06.2026 Tapdıq (45 Ev)-+` vərəqinin günü yoxdur. Tarix təxmin edilməyib.
- `Aprel F2` daxili başlığında yanvar yazılıb. Vərəq adını hesabat ayı kimi səssiz təsdiqləmək olmaz. İdxal sənədləri mənbə adı ilə qaralama saxlanır.
- `60 ev nakopitel Aprel` vərəqində 1 xəta xanası var.
- AZCDG-də 1 504 xəta xanası var: Summary 1, Direct_DK 2, Offer_Auto 1 499, Direct_MH 2. Xətalar `#REF!`, `#DIV/0!` daxil olmaqla olduğu kimi görünür; etibarlı yekun kimi sıfırlaşdırılmır.
- AZCDG-də fərqli obyekt adları eyni faylda yer alır: Bilgəh fərdi ev və Ələt su anbarı/xətləri. Yeni layihəyə kor-koranə birləşdirilməyib, ayrıca mənbə BOQ kitabı yaradılıb.

## Yoxlama və təkrar icra

`import-source-workbooks.mjs` sabit mənbə/vərəq/sətir ID-ləri ilə əlavə edir. Təkrar icrada akt/smeta/BOQ dublikatı yaranmır. `verify-source-import.mjs` bazadakı bütün mənbə xanalarını, rəqəm mətnlərini və orijinal SHA-256 cəmlərini yoxlayır; alış aktı sahələri Decimal dəqiqliyinə uyğun tutuşdurulur. Nəticələr `verification.json` və `import-result.json` fayllarındadır.

Frontend build və Nest build uğurludur. Backend-in mənbə API tenant/səhifələmə, engine və RFQ testlərində 12 test, smeta/Nakopitel/alış domain dəstində 6 test keçdi. Bütün 75 vərəqin mənbə xanaları və 3 orijinal faylın SHA-256 cəmi bazadan yoxlanıldı. Təkrar idxalda qeydlərin sayı dəyişmədi. Mobil en 390 px ikən səhifə daşması olmadı. Nakopitelə 100 sətirlik səhifələmə və 60 ev üzrə filtr əlavə edildi. Bu yoxlamalar Word sənədinin bütün qəbul sınaqlarının keçməsi mənasına gəlmir.
