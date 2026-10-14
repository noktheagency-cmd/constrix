import type { ReactNode } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import type { Area } from "./domain/types"
import { PrefsProvider, usePrefs } from "./i18n"
import Shell from "./Shell"
import { StoreProvider, useStore } from "./store"
import { Empty, PageHead, useTitle } from "./ui"
import Forma2 from "./pages/Forma2"
import Forma3Page from "./pages/Forma3"
import FinanceReports from "./pages/FinanceReports"
import Audit from "./pages/Audit"
import Assets from "./pages/Assets"
import Crm from "./pages/Crm"
import CrmFiles from "./pages/CrmFiles"
import Dashboard from "./pages/Dashboard"
import Finance from "./pages/Finance"
import FinanceAccounts from "./pages/FinanceAccounts"
import FinanceAssets from "./pages/FinanceAssets"
import FinanceBank from "./pages/FinanceBank"
import FinanceInvoices from "./pages/FinanceInvoices"
import FinanceMoves from "./pages/FinanceMoves"
import FinancePartners from "./pages/FinancePartners"
import FinancePayroll from "./pages/FinancePayroll"
import HrmAttendance from "./pages/HrmAttendance"
import HrmDepartments from "./pages/HrmDepartments"
import HrmLeave from "./pages/HrmLeave"
import HrmPay from "./pages/HrmPay"
import People from "./pages/People"
import PersonPage from "./pages/Person"
import Recipes from "./pages/Recipes"
import Sexler from "./pages/Sexler"
import Zavod from "./pages/Zavod"
import ProjectDetail from "./pages/ProjectDetail"
import PhaseDetail from "./pages/PhaseDetail"
import Projects from "./pages/Projects"
import Reports from "./pages/Reports"
import Site from "./pages/Site"
import Supply from "./pages/Supply"
import Settings from "./pages/Settings"
import Warehouse from "./pages/Warehouse"
import { AdminPage, BoqPage, CabinetPage, CashflowPage, CoopPage, ETenderPage, GuaranteePage, MarketPage, PassportPage, RegistryPage, SchedulePage, SpecPage, SubscribePage, TemplatesPage } from "./pages/platform"
import { ChecksPage } from "./pages/Checks"
import { WeatherPage } from "./pages/Weather"
import { EmploymentPage } from "./pages/Employment"
import { InsurancePage } from "./pages/records"
import { CompanyCreatePage } from "./company-onboard"
import { CatalogDetail, CatalogPage } from "./pages/Catalog"
import { CalcPage } from "./pages/Calc"
import { OfferPage } from "./pages/Offer"
import { LogisticsPage } from "./pages/Haul"
import { FlowPage } from "./pages/Flow"
import { CompanyPage, FilesPage, PlatformPage, TariffPage } from "./pages/Procure"

function Gate({ area, children }: { area: Area; children: ReactNode }) {
  const { allowed } = useStore()
  const { t } = usePrefs()
  if (!allowed(area)) {
    return <Empty title={t("gate.title")} text={t("gate.text")} />
  }
  return children
}

function Missing() {
  const { t } = usePrefs()
  useTitle(t("missing.title"))
  return <PageHead kicker={t("missing.kicker")} title={t("missing.title")} text={t("missing.text")} />
}

export default function App() {
  return (
    <PrefsProvider>
      <StoreProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Shell />}>
            <Route index element={<Gate area="dashboard"><Dashboard /></Gate>} />
            <Route path="kabinet" element={<Gate area="dashboard"><CabinetPage /></Gate>} />
            <Route path="qrafik" element={<Gate area="projects"><SchedulePage /></Gate>} />
            <Route path="hava" element={<Gate area="weather"><WeatherPage /></Gate>} />
            <Route path="spesifikasiya" element={<Gate area="spec"><SpecPage /></Gate>} />
            <Route path="pasport" element={<Gate area="spec"><PassportPage /></Gate>} />
            <Route path="e-tender" element={<Gate area="tender"><ETenderPage /></Gate>} />
            <Route path="yoxlama" element={<Gate area="tender"><ChecksPage /></Gate>} />
            <Route path="boq" element={<Gate area="boq"><BoqPage /></Gate>} />
            <Route path="qarantiya" element={<Gate area="guarantee"><GuaranteePage /></Gate>} />
            <Route path="mesgulluq" element={<Gate area="people"><EmploymentPage /></Gate>} />
            <Route path="sigorta" element={<Gate area="finance"><InsurancePage /></Gate>} />
            <Route path="bazar" element={<Gate area="supply"><MarketPage /></Gate>} />
            <Route path="qapi-pencere" element={<Navigate to="/hesablama" replace />} />
            <Route path="sirket" element={<Gate area="procure"><CompanyPage /></Gate>} />
            <Route path="sirket/yeni" element={<Gate area="procure"><CompanyCreatePage /></Gate>} />
            <Route path="layihe-fayl" element={<Gate area="procure"><FilesPage /></Gate>} />
            <Route path="kataloq" element={<Gate area="procure"><CatalogPage /></Gate>} />
            <Route path="kataloq/:id" element={<Gate area="procure"><CatalogDetail /></Gate>} />
            <Route path="hesablama" element={<Gate area="procure"><CalcPage /></Gate>} />
            <Route path="dasima" element={<Gate area="procure"><LogisticsPage /></Gate>} />
            <Route path="teklif" element={<Gate area="procure"><OfferPage /></Gate>} />
            <Route path="sifaris-merhele" element={<Gate area="procure"><FlowPage /></Gate>} />
            <Route path="tarif" element={<Gate area="procure"><TariffPage /></Gate>} />
            <Route path="platforma" element={<Gate area="procure"><PlatformPage /></Gate>} />
            <Route path="pul-axini" element={<Gate area="finance"><CashflowPage /></Gate>} />
            <Route path="partnyorlar" element={<Gate area="finance"><RegistryPage /></Gate>} />
            <Route path="emekdasliq" element={<Gate area="club"><CoopPage /></Gate>} />
            <Route path="abune" element={<Gate area="club"><SubscribePage /></Gate>} />
            <Route path="sablonlar" element={<Gate area="club"><TemplatesPage /></Gate>} />
            <Route path="admin" element={<Gate area="audit"><AdminPage /></Gate>} />
            <Route path="sahe" element={<Gate area="site"><Site /></Gate>} />
            <Route path="gundelik" element={<Gate area="reports"><Reports /></Gate>} />
            <Route path="sifarisci" element={<Gate area="clients"><Crm /></Gate>} />
            <Route path="forma-2" element={<Gate area="acts"><Forma2 /></Gate>} />
            <Route path="forma-3" element={<Gate area="acts"><Forma3Page /></Gate>} />
            <Route path="senedler" element={<Gate area="crm"><CrmFiles /></Gate>} />
            <Route path="layiheler" element={<Gate area="projects"><Projects /></Gate>} />
            <Route path="layiheler/:id/merhele/:phase" element={<Gate area="projects"><PhaseDetail /></Gate>} />
            <Route path="layiheler/:id" element={<Gate area="projects"><ProjectDetail /></Gate>} />
            <Route path="maliyye" element={<Gate area="finance"><Finance /></Gate>} />
            <Route path="emeliyyatlar" element={<Gate area="finance"><FinanceMoves /></Gate>} />
            <Route path="hesablar" element={<Gate area="finance"><FinanceAccounts /></Gate>} />
            <Route path="qaimeler" element={<Gate area="finance"><FinanceInvoices /></Gate>} />
            <Route path="emek-haqqi" element={<Gate area="finance"><FinancePayroll /></Gate>} />
            <Route path="vesaitler" element={<Gate area="finance"><FinanceAssets /></Gate>} />
            <Route path="bank" element={<Gate area="finance"><FinanceBank /></Gate>} />
            <Route path="terefler" element={<Gate area="finance"><FinancePartners /></Gate>} />
            <Route path="hesabatlar" element={<Gate area="finance"><FinanceReports /></Gate>} />
            <Route path="aktivler" element={<Gate area="assets"><Assets /></Gate>} />
            <Route path="zavod" element={<Gate area="production"><Zavod /></Gate>} />
            <Route path="reseptler" element={<Gate area="production"><Recipes /></Gate>} />
            <Route path="sexler" element={<Gate area="production"><Sexler /></Gate>} />
            <Route path="istehsalat" element={<Navigate to="/zavod" replace />} />
            <Route path="anbar" element={<Gate area="warehouse"><Warehouse /></Gate>} />
            <Route path="techizat" element={<Gate area="supply"><Supply /></Gate>} />
            <Route path="isciler" element={<Gate area="people"><People /></Gate>} />
            <Route path="isciler/:id" element={<Gate area="people"><PersonPage /></Gate>} />
            <Route path="heyet" element={<Navigate to="/isciler" replace />} />
            <Route path="davamiyyet" element={<Gate area="people"><HrmAttendance /></Gate>} />
            <Route path="mezuniyyet" element={<Gate area="people"><HrmLeave /></Gate>} />
            <Route path="odenisler" element={<Gate area="people"><HrmPay /></Gate>} />
            <Route path="sobeler" element={<Gate area="people"><HrmDepartments /></Gate>} />
            <Route path="tarixce" element={<Gate area="audit"><Audit /></Gate>} />
            <Route path="ayarlar" element={<Settings />} />
            <Route path="*" element={<Missing />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
    </PrefsProvider>
  )
}
