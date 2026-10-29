# Global cədvəl yoxlaması

Standart: 10 sətir; seçimlər 10/15/20/25/50/100; aşağı solda səhifələmə, aşağı sağda sətir seçimi.

44 faylda 138 cədvəl global DataTable komponentinə keçirilib. Aşağıdakı siyahı kod inventarıdır; hər səhifənin brauzerdə ayrıca yoxlanması demək deyil.

| Fayl | Cədvəl sayı |
|---|---:|
| `src/components/SourceWorkbookViewer.tsx` | 1 |
| `src/pages/Assets.tsx` | 6 |
| `src/pages/Audit.tsx` | 1 |
| `src/pages/Calc.tsx` | 1 |
| `src/pages/Catalog.tsx` | 3 |
| `src/pages/Checks.tsx` | 2 |
| `src/pages/Crm.tsx` | 3 |
| `src/pages/CrmFiles.tsx` | 1 |
| `src/pages/Dashboard.tsx` | 7 |
| `src/pages/Employment.tsx` | 2 |
| `src/pages/Finance.tsx` | 3 |
| `src/pages/FinanceAccounts.tsx` | 2 |
| `src/pages/FinanceAssets.tsx` | 1 |
| `src/pages/FinanceBank.tsx` | 1 |
| `src/pages/FinanceInvoices.tsx` | 1 |
| `src/pages/FinanceMoves.tsx` | 2 |
| `src/pages/FinancePartners.tsx` | 1 |
| `src/pages/FinancePayroll.tsx` | 3 |
| `src/pages/FinanceReports.tsx` | 4 |
| `src/pages/Flow.tsx` | 1 |
| `src/pages/Forma2.tsx` | 8 |
| `src/pages/Forma3.tsx` | 5 |
| `src/pages/Haul.tsx` | 1 |
| `src/pages/HrmAttendance.tsx` | 1 |
| `src/pages/HrmDepartments.tsx` | 1 |
| `src/pages/HrmLeave.tsx` | 1 |
| `src/pages/HrmPay.tsx` | 1 |
| `src/pages/MarketPortal.tsx` | 4 |
| `src/pages/Offer.tsx` | 5 |
| `src/pages/officialForms.tsx` | 2 |
| `src/pages/People.tsx` | 1 |
| `src/pages/platform.tsx` | 15 |
| `src/pages/Procure.tsx` | 3 |
| `src/pages/projectParts.tsx` | 1 |
| `src/pages/Projects.tsx` | 4 |
| `src/pages/PurchaseActs.tsx` | 4 |
| `src/pages/Recipes.tsx` | 1 |
| `src/pages/records.tsx` | 2 |
| `src/pages/Reports.tsx` | 5 |
| `src/pages/Site.tsx` | 4 |
| `src/pages/Supply.tsx` | 7 |
| `src/pages/Warehouse.tsx` | 5 |
| `src/pages/Weather.tsx` | 1 |
| `src/pages/Zavod.tsx` | 10 |

Nakopitel: 7889 iş sətri, ev/bölmə konteksti hər sətirdə, geniş ad sütunu və qruplanmış rəqəm başlıqları. Excel mənbəsi serverdə səhifələnir; Word/PDF ixracında bütün sətirlər saxlanır.

Yoxlama: frontend 92 test, backend mənbə səhifələməsi 10 test keçdi; frontend build/typecheck keçdi. Brauzerdə Alış aktı, Forma-2/Nakopitel və Excel mənbəsi yoxlanılıb. Tam backend build işləyən API-nin kilidlədiyi Prisma DLL üçün EPERM verdi; ayrıca backend TypeScript yoxlaması aparılıb.
