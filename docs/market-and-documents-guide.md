# Market və sənəd düzəlişləri

## Başlatma

Layihə qovluğunda `npm run dev` işlədin. `[AFEZ] READY` yazısını gözləyin. Frontend: `http://localhost:5173`, API: `.env` faylındakı port (lokalda 3002). Ctrl+C hər iki serveri dayandırır. Eyni komandanı ikinci terminalda işlətmək mövcud serveri əvəz etmir.

## Market

1. `/market` açıq kataloqdur; kataloqa baxmaq üçün ERP abunəliyi tələb olunmur. Qiymətlər sorğu ilə alınır.
2. Daxil olun, aktiv şirkəti seçin. **Şirkət və məhsullar → Profili doldur**: hüquqi ad, VÖEN, region və sənəd yükləyin. Antivirusdan keçməyən sənəd seçilmir.
3. Platforma administratoru **Moderasiya və tariflər** bölməsində şirkətin sənədlərini yoxlayır. Rədd/düzəliş qərarında səbəb tələb olunur.
4. Təchizatçı məhsul təklif edir; məhsul moderasiyadan sonra kataloqda görünür. Mövcudluq elanı region, təxmini miqdar və təminat müddətidir; zəmanətli anbar rezervi deyil.
5. Alıcı kataloqda məhsul miqdarlarını yazıb **Qiymət sorğusu** seçir. Açıq sorğu yalnız uyğun məhsul/region təchizatçılarına, qapalı sorğu seçilən təchizatçıya açılır.
6. Təchizatçı sətirlərə miqdar, vahid qiymət, ƏDV, tarix və ödəniş şərti ilə təklif verir. Sıfır miqdarlı sətir göndərilmir; qismən təklif mümkündür. Yeni təklif ayrıca versiyadır. Təchizatçı rəqib təklifləri görmür.
7. Alıcı təklifdən sifariş yaradır. Təchizatçı təsdiqləyir və sənədlə çatdırılma qeyd edir. Mal ödənişi şirkətlər arasındadır; bu düymələr bank köçürməsi etmir.
8. Alıcı qəbul və mübahisə miqdarlarını ayrıca yazır. Direktor və ya həmin layihə/anbar üçün limiti olan əməkdaş qəbul edə bilər. Komissiya yalnız qəbul edilmiş miqdardan hesablanır.
9. **ERP-yə bağla**: layihə və anbar seçilir. Sifariş yaratmaq stok/borc yaratmır; ERP qeydləri faktiki qəbulda yaranır. Eyni əməliyyat açarı təkrar yazılış yaratmır.
10. Mübahisə nəticəsində qəbul/rədd bölgüsü və sənəd qeyd olunur. Qaytarma tələbini təchizatçı təsdiqləyir; əvvəlki qəbul dəyişmir, ayrıca düzəliş və komissiya krediti saxlanır.

## Komissiya və bildiriş

- Tarif prioriteti: müqavilə → şirkət → kateqoriya → standart. Alıcı və təchizatçı tarifləri ayrıdır. Tarif yoxdursa hesablaşma gözləyir; faiz uydurulmur.
- **Hesablaşma** aylıq qalıqları, ilkin son tarixləri və bank qəbzinin yoxlama statusunu göstərir. Qəbz göndərmək borcu ödənilmiş etmir; administrator bank uzlaşdırmasını təsdiqləməlidir.
- İlkin qayda 7/15/30 gündür; administrator bunu dəyişə bilər. Məhdudiyyət yeni əməliyyatlara aiddir; mövcud sifarişlər bağlanmır.
- Backend açılan zaman və hər 15 dəqiqədə bildiriş yoxlaması işləyir. Tətbiqdaxili bildiriş yazılır; e-poçt/SMS çıxışları `awaiting_provider` statusunda saxlanır. Rəsmi provayder inteqrasiyası bu işə daxil deyil.

## F2/F3 və alış düzəlişləri

- Təsdiqlənmiş sənəd generic API ilə redaktə/silmə qəbul etmir. Qaralama redaktəsi əvvəlki və sonrakı vəziyyətlə auditə yazılır.
- Forma-3 təsdiqində mənbə F2/smeta həcmləri, dövr, qiymətlər, qalıqlar və müqavilənin maliyyə yekunları serverdə yoxlanır. Köhnəlmiş qaralamanı əvvəl yeniləyin.
- F3-ə daxil olan F2-ni düzəltmək üçün əvvəl F3-ü, sonra F2-ni səbəb yazaraq qaralamaya qaytarın. Fakturalanmış F2 əvvəl maliyyə düzəlişi tələb edir.
- Ödənilməmiş qaiməni **Əks qeyd ilə ləğv et** əməliyyatı ilkin qeydi saxlayaraq eyni məbləğdə mənfi qeyd yaradır. Ödənilmiş qaiməyə avtomatik geri ödəniş edilmir; real ödəniş uzlaşdırılmalıdır.
- Alış aktını qaytarmaq üçün mənbə partiyasının və anbarın qalığı kifayət etməlidir. Borc ödənilibsə və ya mənbə əlaqələri yoxdursa avtomatik qaytarma bloklanır. Əks əməliyyat ilkin stok/borc tarixçəsini silmir.

## Excel

- Orijinal 3 fayl bütün vərəqləri ilə **Excel mənbəsi** tabında saxlanır.
- AZCDG BOQ qiymət ixracı: qiymət mənbəsini/tarixini yoxlayın, aktual sətirləri təsdiqləyin, **Bazaya yaz**, sonra **Excel mənbəsi → Qiymətləri orijinal şablonda yüklə**.
- Yalnız uyğun orijinal sətirlərin J/K qiymət xanaları dəyişir. Başqa vərəqlər, düsturlar, üslublar, şəkillər və əlaqələr saxlanır. Excel açıldıqda hesablamanı yeniləyir. Mənbədəki əvvəlki `#REF!` və digər formula xətaları avtomatik düzəldilmiş sayılmır.
- Yeni və ya birmənalı uyğunlaşmayan sətri orijinal şablona səssiz yazmaq əvəzinə ixrac dayandırılır. Alış və Nakopitel üçün orijinalı yükləmək tam arxivi verir; J/K qiymət ixracı AZCDG-yə aiddir.

## Yoxlamaları təkrarlamaq

Backend qovluğunda:

```powershell
npm test -- --runInBand
node --env-file=.env -r ts-node/register/transpile-only scripts/market-acceptance.ts
node --env-file=.env scripts/verify-backup-restore.mjs
```

Market/F2/F3 qəbul sınağı ayrıca `market_qa_UUID` sxemində işləyir və yalnız həmin sxemi təmizləyir. Bərpa sınağı `public` sxeminin uyğun snapshot nüsxəsini `.local-backups` qovluğuna yazır, ayrıca `afez_restore_qa_UUID` bazasına bərpa edir, bütün cədvəl məzmunlarını müqayisə edir və yalnız müvəqqəti bazanı silir. `.local-backups` Git-dən çıxarılıb. Əsas bazaya bərpa əmri bu scriptdə yoxdur.
