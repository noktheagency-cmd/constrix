# Market / sənəd API qeydləri

Sessiya: mövcud `/api/auth/login` cookie autentifikasiyası. Aktiv şirkət serverdə hesabın üzvlüyündən götürülür; body-də şirkət göndərmək səlahiyyət yaratmır. Yalnız `GET /api/market/catalog` anonimdir.

## Əsas endpoint-lər

| Endpoint | İcazə / nəticə |
|---|---|
| GET market/workspace | Aktiv şirkətin layihə/anbarları; əməkdaşlar və qəbul icazələri yalnız direktora |
| POST market/company | Direktor; hüquqi profil moderasiyaya göndərilir |
| POST market/items | Təsdiqlənmiş şirkət; məhsul moderasiyaya göndərilir |
| POST market/items/:id/listing | Direktor/satınalma; təsdiqli məhsula mövcudluq elanı |
| POST market/rfqs | Direktor/satınalma; təsdiqli şirkət və borc məhdudiyyəti yoxlanır |
| GET market/cases?kind=rfq və ya order | Yalnız şirkətin tərəf olduğu/uyğun dəvət edildiyi sənədlər |
| GET market/cases/:id | Alıcı təklifləri müqayisə edir; təchizatçı yalnız öz təkliflərini görür |
| POST market/rfqs/:id/bids | Təchizatçı; versiyalı, qismən təklif |
| POST market/rfqs/:id/bids/:bidId/select | Alıcı; son etibarlı versiyadan sifariş |
| POST market/orders/:id/confirm | Yalnız sifarişin təchizatçısı |
| POST market/orders/:id/deliveries | Təchizatçı; miqdar və sənəd yoxlanır |
| POST market/orders/:id/receipts | Alıcı; direktor və ya layihə/anbar/məbləğ icazəsi |
| POST market/orders/:id/erp | Alıcı direktor/satınalma; yalnız öz layihə/anbarı |
| POST market/orders/:id/returns | Alıcının icazəli əməkdaşı; qəbul qalığı daxilində |
| POST market/orders/:id/returns/:returnId/confirm | Təchizatçı; stok/borc/komissiya əks qeydləri atomikdir |
| POST market/orders/:id/disputes/:disputeId/resolve | Alıcının icazəli əməkdaşı; qəbul+rəd mübahisə miqdarına bərabərdir |
| POST market/cases/:id/messages | Tərəflər; RFQ yazışması təchizatçı üzrə gizlidir |
| GET market/finance?month=YYYY-MM | Direktor/mühasib; yalnız öz şirkətinin hesablaşması |
| POST market/charges/:id/payments | Direktor/mühasib; bank qəbzini yoxlamaya göndərir |
| POST market/payments/:id/review | Platforma administratoru; borc yalnız təsdiqdə azalır |
| GET/POST market/moderation, tariffs, policy | Platforma administratoru; adi şirkət admin ola bilməz |
| GET market/notifications/status | Platforma administratoru; planlayıcı vəziyyəti |
| POST market/notifications/run | Platforma administratoru; manual yoxlama; təkrarsız |

Yuxarıdakı yollar `/api/` prefiksi ilə işləyir. Anbardar/sahə görünüşündə qiymət, ƏDV, maliyyə nəticələri və kommersiya yazışması gizlənir.

## Atomik əməliyyat açarı

RFQ yaratma, təklif, sifariş seçimi, çatdırılma, qəbul, qaytarma və maliyyə təsdiqi body-də `key` tələb edir. UUID uyğundur. Şəbəkə xətasından sonra **eyni body + eyni key** ilə təkrar yoxlayın. Eyni açarı başqa məzmun və ya hesabla göndərmək 409 qaytarır. Sorğunun uğursuz olduğuna baxmadan yeni key yaratmaq düzgün deyil. Serializasiya konflikti zamanı server eyni açarla daxili təkrar edir.

Qəbul body nümunəsi:

```json
{"key":"generated-uuid-value","proof":"clean-owned-file-id","lines":[{"lineId":"order-line-id","accepted":"60.000","disputed":"5.000"}]}
```

## Fayllar

`POST /api/blob-files`: `application/octet-stream`; `x-file-name` URI-encoded ad, `x-file-kind` (`commercial`, `certificate`, `project`, `hr`), `x-upload-key` UUID, versiya üçün `x-parent-id`. Maksimum 20 MB. Magic/uzantı və Office arxiv hədləri yoxlanır. Antivirus unavailable/error olduqda karantin; `clean` olmadan əlavə və yükləmə yoxdur.

`GET /api/blob-files/:id/download` autentifikasiyalıdır, sahiblik/rol/tərəf yoxlaması və baxış auditi var. Versiya əvvəlki faylın baytlarını dəyişmir. `POST :id/rescan` yalnız səlahiyyətli sahib şirkət üçündür.

## Sənəd düzəlişləri

`POST /api/act-workflows/:id/{approve-f2,return-f2,approve-f3,return-f3,receive-purchase,return-purchase,return-invoice}`. Hamısı `key`, qaytarmalar əlavə `reason` tələb edir; alış qəbulu `locationId` tələb edir. Generic PATCH/DELETE təsdiqlənmiş F2/F3/alış sənədini dəyişmir. Geri qaytarmada ilkin snapshot və əks qeydlər saxlanır; ödənilmiş maliyyə qeydinə avtomatik pul geri köçürülmür.

`POST /api/platform/source-workbooks/:id/prices` body `{ "boqId": "owned-boq-id" }`: AZCDG mənbəsinə təsdiqli və aktual DB qiymətlərini yazılmış XLSX qaytarır. Başqa şirkətin mənbə/BOQ-si, qeyri-müəyyən mənbə sətri, tarixsiz/köhnə qiymət və düstur xanasının üstündən yazılması bloklanır.
