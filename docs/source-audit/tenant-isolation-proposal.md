# Tenant izolyasiyası üçün konkret dəyişiklik

Bu dəyişiklik yalnız `afez` layihəsinin PostgreSQL sxeminə və server API-lərinə aiddir. Məqsəd eyni ID və ya URL vasitəsilə başqa şirkətin ERP məlumatına çıxışı bağlamaqdır.

Təsirlənən köhnə API resursları: users, crews, leads, deals, tasks, files, activities, invoices, expenses, payables, suppliers, quotes, smetas, contracts, acts, forma3, reports, documents, changes, locations, materials, stocks, movements, shipments, purchase-orders, purchase-acts, requests, recipes, plants, work-orders, assets, drivers, trips, fuels, fleet-docs, gear, gear-events, services, people, offices, departments, terminals, attendance, leaves, hr-payments, hr-moves, payrolls, journal, audit, periods, companies, complexes, buildings, units, buyers, sale-contracts; əlavə olaraq clients və projects.

Təklif olunan icra:

1. Birbaşa şirkət sahəsi olmayan əsas modellərə nullable `organizationId` və indeks əlavə edilir. Heç bir qeyd silinmir.
2. Mövcud `organizationId` dəyişdirilmir. Etibarlı `projectId` varsa layihənin mövcud şirkəti götürülür. `seed-` prefiksli demo qeydləri yalnız mövcud `seed-org-afez` şirkətinə bağlanır.
3. Sahibi bu iki qayda ilə məlum olmayan köhnə qeydlər hər hansı şirkətə təxminlə verilməyəcək. Onlar bazada qalır, adi ERP API-lərində gizlədilir; ayrıca sahiblik uzlaşdırılması tələb edir. Bu səbəbdən əvvəllər hamıya görünən bəzi qeydlər UI-dan itə bilər.
4. Hər list/read/create/update/delete aktiv şirkət kontekstinə bağlanır. Sorğu body-sində başqa şirkət ID-si, başqa şirkətin parent/child ID-si və relation injection qəbul edilmir.
5. Məxfi maliyyə/qiymət sahələri anbardar/briqadirə qaytarılmır. Audit qeydlərinin redaktə və silinməsi qadağan olunur. Yeni rol və xarici istifadəçiyə giriş verilmir.
6. İki şirkətli mənfi sınaqlar: siyahı, ID ilə oxuma, dəyişmə, silmə, saxta organizationId, başqa şirkətin əlaqəli ID-si və child sətri.

Bu sənəd baxış üçündür; dəyişiklik ayrıca təsdiqlənənədək tətbiq edilmir.
