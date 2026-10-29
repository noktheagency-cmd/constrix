import type { Extracted, FileVersion, PriceLog, ProcureState, Product, ProjectFile } from "./engine"

const BUYERS = new Set(["tikinti", "memar", "admin"])
const MAKERS = new Set(["qapi", "suse", "pvc", "fasad", "material"])

function line(id: string, row: Omit<Extracted, "id" | "flags" | "confirmed" | "spec" | "install"> & Partial<Extracted>): Extracted {
  return {
    spec: "",
    install: "",
    flags: [],
    confirmed: false,
    ...row,
    id,
  }
}

function olderWindow(companyId: string): FileVersion {
  const key = (row: string) => `demo-${companyId}-pencere-v1-${row}`
  return {
    id: `demo-${companyId}-pencere-v1`,
    name: "Yasamal-Zerdabi-12-pencere.xlsx",
    ext: "xlsx",
    size: 154112,
    at: "2026-08-18T10:00:00.000Z",
    scanNote: "6 sətir oxundu",
    rows: [
      line(key("1"), { name: "Pəncərə P-01", code: "P-01", qty: "10", width: "1400", height: "1500", profile: "Alüminium 60 mm", glass: "24 mm şəffaf", hardware: "Dönər-açılan", spec: "Otaq, mərtəbə 2-4", install: "Daxili", confirmed: true }),
      line(key("2"), { name: "Pəncərə P-02", code: "P-02", qty: "8", width: "900", height: "1400", profile: "Alüminium 60 mm", glass: "24 mm şəffaf", hardware: "Dönər", spec: "Sanitar", install: "Daxili", confirmed: true }),
      line(key("3"), { name: "Pəncərə P-03", code: "P-03", qty: "4", width: "1800", height: "2100", profile: "Termo 70 mm", glass: "32 mm enerji", hardware: "Sürüşən", spec: "Qonaq otağı", install: "Daxili", confirmed: false }),
      line(key("4"), { name: "Vitrin V-01", code: "V-01", qty: "2", width: "2400", height: "2700", profile: "Fasad dayaq", glass: "8+16+8", hardware: "Sabit", spec: "Giriş fasadı", install: "Xarici", confirmed: false }),
      line(key("5"), { name: "Pəncərə P-04", code: "P-04", qty: "3", width: "700", height: "700", profile: "Alüminium 45 mm", glass: "24 mm buzlu", hardware: "Dönər", spec: "Mətbəx", install: "Daxili", confirmed: true }),
      line(key("6"), { name: "Balkon B-01", code: "B-01", qty: "8", width: "3200", height: "1600", profile: "PVC 70 mm", glass: "32 mm enerji", hardware: "Sürüşən", spec: "Lodjiya", install: "Xarici", confirmed: false }),
    ],
  }
}

function withFormats(files: ProjectFile[], companyId: string) {
  const target = `demo-${companyId}-pencere`
  const index = files.findIndex((file) => file.id === target && !file.formats?.length)
  if (index < 0) return files
  const next = files.slice()
  next[index] = { ...files[index], formats: ["csv", "pdf"] }
  return next
}

function withHistory(files: ProjectFile[], companyId: string) {
  const target = `demo-${companyId}-pencere`
  const index = files.findIndex((file) => file.id === target && !file.versions?.length)
  if (index < 0) return files
  const next = files.slice()
  const file = files[index]
  next[index] = { ...file, at: file.at || "2026-09-28T11:20:00.000Z", versions: [olderWindow(companyId)] }
  return next
}

function demoFiles(companyId: string): ProjectFile[] {
  const key = (file: string, row: string) => `demo-${companyId}-${file}-${row}`
  return [
    {
      id: `demo-${companyId}-pencere`,
      companyId,
      name: "Yasamal-Zerdabi-12-pencere.xlsx",
      ext: "xlsx",
      size: 186432,
      at: "2026-09-28T11:20:00.000Z",
      scan: "temiz",
      scanNote: "8 sətir oxundu",
      versions: [olderWindow(companyId)],
      formats: ["csv", "pdf"],
      rows: [
        line(key("pencere", "1"), { name: "Pəncərə P-01", code: "P-01", qty: "12", width: "1400", height: "1500", profile: "Alüminium 60 mm", glass: "24 mm şəffaf", hardware: "Dönər-açılan", spec: "Otaq, mərtəbə 2-4", install: "Daxili", confirmed: true }),
        line(key("pencere", "2"), { name: "Pəncərə P-02", code: "P-02", qty: "8", width: "900", height: "1400", profile: "Alüminium 60 mm", glass: "24 mm şəffaf", hardware: "Dönər", spec: "Sanitar", install: "Daxili", confirmed: true }),
        line(key("pencere", "3"), { name: "Pəncərə P-03", code: "P-03", qty: "6", width: "1800", height: "2100", profile: "Termo 70 mm", glass: "32 mm enerji", hardware: "Sürüşən", spec: "Qonaq otağı", install: "Daxili", confirmed: true }),
        line(key("pencere", "4"), { name: "Vitrin V-01", code: "V-01", qty: "4", width: "2400", height: "2700", profile: "Fasad dayaq", glass: "8+16+8", hardware: "Sabit", spec: "Giriş fasadı", install: "Xarici", confirmed: false }),
        line(key("pencere", "5"), { name: "Pəncərə P-04", code: "P-04", qty: "3", width: "700", height: "700", profile: "Alüminium 45 mm", glass: "24 mm buzlu", hardware: "Dönər", spec: "Mətbəx", install: "Daxili", confirmed: true }),
        line(key("pencere", "6"), { name: "Balkon B-01", code: "B-01", qty: "10", width: "3200", height: "1600", profile: "PVC 70 mm", glass: "32 mm enerji", hardware: "Sürüşən", spec: "Lodjiya", install: "Xarici", flags: ["qeyri-deqiq"], confirmed: false }),
        line(key("pencere", "7"), { name: "Pəncərə P-05", code: "P-05", qty: "5", width: "1200", height: "1400", profile: "Alüminium 60 mm", glass: "24 mm şəffaf", hardware: "Dönər-açılan", spec: "Yataq", install: "Daxili", confirmed: true }),
        line(key("pencere", "8"), { name: "Pəncərə P-06", code: "P-06", qty: "2", width: "600", height: "900", profile: "", glass: "24 mm", hardware: "", spec: "Pilləkən", install: "Daxili", flags: ["oxunmadi"], confirmed: false }),
      ],
    },
    {
      id: `demo-${companyId}-qapi`,
      companyId,
      name: "Giris-ve-otaq-qapilari.csv",
      ext: "csv",
      size: 42880,
      scan: "temiz",
      scanNote: "5 sətir oxundu",
      rows: [
        line(key("qapi", "1"), { name: "Giriş qapısı G-01", code: "G-01", qty: "2", width: "1200", height: "2400", profile: "Alüminium isti", glass: "Şəffaf 8 mm", hardware: "Qapı bağlayıcı", spec: "Əsas giriş", install: "Xarici", confirmed: true }),
        line(key("qapi", "2"), { name: "Giriş qapısı G-02", code: "G-02", qty: "1", width: "1000", height: "2200", profile: "Alüminium isti", glass: "Buzlu", hardware: "Kart kilidi", spec: "Xidmət girişi", install: "Xarici", confirmed: true }),
        line(key("qapi", "3"), { name: "Otaq qapısı O-01", code: "O-01", qty: "24", width: "900", height: "2100", profile: "MDF", glass: "Yoxdur", hardware: "Standart kilid", spec: "Mənzil", install: "Daxili", confirmed: true }),
        line(key("qapi", "4"), { name: "Otaq qapısı O-02", code: "O-02", qty: "8", width: "800", height: "2100", profile: "MDF", glass: "Yoxdur", hardware: "Standart kilid", spec: "Sanitar", install: "Daxili", confirmed: false }),
        line(key("qapi", "5"), { name: "Yanğın qapısı Y-01", code: "Y-01", qty: "6", width: "1000", height: "2100", profile: "Metal EI60", glass: "Yoxdur", hardware: "Antipanik", spec: "Pilləkən", install: "Daxili", flags: ["ziddiyyet"], confirmed: false }),
      ],
    },
    {
      id: `demo-${companyId}-fasad`,
      companyId,
      name: "Fasad-A-oxu.dxf",
      ext: "dxf",
      size: 2457600,
      scan: "temiz",
      scanNote: "Ölçü oxundu, profil bir sətirde boş qaldı",
      rows: [
        line(key("fasad", "1"), { name: "Fasad paneli F-01", code: "F-01", qty: "18", width: "1500", height: "3200", profile: "Dayaz dayaq", glass: "Günəşdən qoruyan", hardware: "Sabit", spec: "A oxu", install: "Xarici", confirmed: true }),
        line(key("fasad", "2"), { name: "Fasad paneli F-02", code: "F-02", qty: "18", width: "1500", height: "3200", profile: "Dayaz dayaq", glass: "Günəşdən qoruyan", hardware: "Sabit", spec: "A oxu", install: "Xarici", confirmed: true }),
        line(key("fasad", "3"), { name: "Fasad qapısı FQ-01", code: "FQ-01", qty: "2", width: "1800", height: "2700", profile: "", glass: "8+16+8", hardware: "Avtomatik", spec: "A oxu giriş", install: "Xarici", flags: ["oxunmadi"], confirmed: false }),
        line(key("fasad", "4"), { name: "Kostyum paneli K-01", code: "K-01", qty: "40", width: "600", height: "1200", profile: "Kompozit", glass: "Yoxdur", hardware: "Gizli bərkidici", spec: "Yan fasad", install: "Xarici", confirmed: false }),
      ],
    },
    {
      id: `demo-${companyId}-pdf`,
      companyId,
      name: "Mertebe-3-4-spesifikasiya.pdf",
      ext: "pdf",
      size: 890112,
      scan: "temiz",
      scanNote: "Açıq mətn oxundu, 4 sətir",
      rows: [
        line(key("pdf", "1"), { name: "Pəncərə M3-01", code: "M3-01", qty: "16", width: "1300", height: "1500", profile: "Alüminium 60 mm", glass: "24 mm", hardware: "Dönər-açılan", spec: "3-cü mərtəbə", install: "Daxili", confirmed: true }),
        line(key("pdf", "2"), { name: "Pəncərə M4-01", code: "M4-01", qty: "16", width: "1300", height: "1500", profile: "Alüminium 60 mm", glass: "24 mm", hardware: "Dönər-açılan", spec: "4-cü mərtəbə", install: "Daxili", confirmed: true }),
        line(key("pdf", "3"), { name: "Məhəccər H-01", code: "H-01", qty: "22", width: "1100", height: "1100", profile: "Paslanmaz", glass: "8 mm temperli", hardware: "Nöqtəvi bərkitmə", spec: "Balkon", install: "Xarici", flags: ["qeyri-deqiq"], confirmed: false }),
        line(key("pdf", "4"), { name: "İşıq lenti L-01", code: "L-01", qty: "1", width: "8600", height: "600", profile: "Alüminium çərçivə", glass: "Günəşdən qoruyan", hardware: "Sabit", spec: "Dəhliz", install: "Daxili", confirmed: false }),
      ],
    },
  ]
}

function extraDemoFiles(companyId: string): ProjectFile[] {
  const examples = [
    { key: "balkon", name: "Balkon-meheccerleri-test.xlsx", ext: "xlsx", size: 98304, profile: "Paslanmaz AISI 304", rows: ["Balkon məhəccəri B-01", "Balkon məhəccəri B-02", "Pilləkən məhəccəri P-01"] },
    { key: "dam", name: "Dam-isiq-panelleri-test.csv", ext: "csv", size: 16384, profile: "Alüminium termo", rows: ["Dam işıq paneli D-01", "Dam işıq paneli D-02"] },
    { key: "giris", name: "Giris-fasadi-test.dxf", ext: "dxf", size: 524288, profile: "Fasad dayaq", rows: ["Giriş vitrin bloku G-01", "Giriş vitrin bloku G-02"] },
    { key: "ofis", name: "Ofis-bolmeleri-test.pdf", ext: "pdf", size: 262144, profile: "Şüşə bölmə", rows: ["Ofis bölməsi O-01", "Ofis bölməsi O-02", "Ofis qapısı Q-01"] },
  ]
  return examples.map((example) => ({
    id: `demo-${companyId}-ux-${example.key}`,
    companyId,
    name: example.name,
    ext: example.ext,
    size: example.size,
    at: "2026-10-28T08:00:00.000Z",
    scan: "temiz",
    scanNote: "Kitabxana görünüşü üçün test nümunəsi",
    rows: example.rows.map((name, i) => line(`demo-${companyId}-ux-${example.key}-${i + 1}`, {
      name, code: `${example.key.toUpperCase()}-${i + 1}`, qty: String((i + 1) * 2), width: "1200", height: "2100",
      profile: example.profile, glass: "8 mm temperli", hardware: "Standart", confirmed: i === 0,
    })),
  }))
}

function demoProducts(companyId: string, owner: string): { products: Product[]; prices: PriceLog[] } {
  const made: Product[] = [
    { id: `demo-${companyId}-p1`, companyId, name: "Alüminium profil 45 mm", code: "AL-45", category: "Alüminium profil", params: "Divar 1.4 mm", colors: "Ağ, antrasit, qoz", sizes: "6 m çubuq", unit: "m", price: "9.80", cost: "6.40", validUntil: "2026-12-31", minQty: "30", leadDays: "7", deliveryPrice: "40", installPrice: "", breaks: [] },
    { id: `demo-${companyId}-p2`, companyId, name: "Termo profil 60 mm", code: "TR-60", category: "Alüminium profil", params: "Termo körpü 24 mm", colors: "RAL 7016, RAL 9016", sizes: "6 m çubuq", unit: "m", price: "16.50", cost: "11.20", validUntil: "2026-12-31", minQty: "24", leadDays: "10", deliveryPrice: "40", installPrice: "", breaks: [{ id: `demo-${companyId}-p2b`, minQty: "200", size: "6 m", spec: "Anbar partiyası", delivery: "Bakı daxili", price: "15.10" }] },
    { id: `demo-${companyId}-p3`, companyId, name: "Termo profil 70 mm", code: "TR-70", category: "Alüminium profil", params: "Üç kameralı", colors: "RAL 7016", sizes: "6.5 m çubuq", unit: "m", price: "21.40", cost: "14.80", validUntil: "2026-12-31", minQty: "18", leadDays: "12", deliveryPrice: "45", installPrice: "", breaks: [] },
    { id: `demo-${companyId}-p4`, companyId, name: "Şüşə paket 24 mm", code: "SP-24", category: "Şüşə", params: "4+16+4 şəffaf", colors: "Şəffaf", sizes: "Maksimum 2400×3200", unit: "m2", price: "38.00", cost: "24.50", validUntil: "2026-11-30", minQty: "10", leadDays: "5", deliveryPrice: "25", installPrice: "8", breaks: [] },
    { id: `demo-${companyId}-p5`, companyId, name: "Şüşə paket 32 mm enerji", code: "SP-32E", category: "Şüşə", params: "Low-E, arqon", colors: "Neytral", sizes: "Maksimum 2500×3500", unit: "m2", price: "54.00", cost: "36.00", validUntil: "2026-11-30", minQty: "8", leadDays: "8", deliveryPrice: "30", installPrice: "8", breaks: [{ id: `demo-${companyId}-p5b`, minQty: "80", size: "", spec: "Layihə partiyası", delivery: "Obyektə", price: "49.50" }] },
    { id: `demo-${companyId}-p6`, companyId, name: "Dönər-açılan furnitur", code: "FR-DA", category: "Furnitur", params: "90 kq-dək qanad", colors: "Gümüş, qara", sizes: "Standart", unit: "ədəd", price: "42.00", cost: "27.00", validUntil: "2026-12-31", minQty: "20", leadDays: "6", deliveryPrice: "15", installPrice: "6", breaks: [] },
    { id: `demo-${companyId}-p7`, companyId, name: "Qapı dəsti 100 kq", code: "FR-QD", category: "Furnitur", params: "3 menteşə, kilid, bağlayıcı", colors: "Paslanmaz", sizes: "900-1200 mm qanad", unit: "dəst", price: "86.00", cost: "58.00", validUntil: "2026-12-31", minQty: "4", leadDays: "9", deliveryPrice: "15", installPrice: "18", breaks: [] },
    { id: `demo-${companyId}-p8`, companyId, name: "PVC profil 70 mm", code: "PVC-70", category: "PVC", params: "5 kamera", colors: "Ağ, qoz", sizes: "6 m", unit: "m", price: "7.60", cost: "4.90", validUntil: "2026-10-31", minQty: "40", leadDays: "14", deliveryPrice: "35", installPrice: "", breaks: [] },
    { id: `demo-${companyId}-p9`, companyId, name: "Kompozit panel 4 mm", code: "FS-K4", category: "Fasad", params: "PE nüvə, 0.3 mm üzlük", colors: "Gümüş, antrasit", sizes: "1500×4000", unit: "m2", price: "28.50", cost: "19.00", validUntil: "2026-12-31", minQty: "20", leadDays: "11", deliveryPrice: "50", installPrice: "12", breaks: [] },
    { id: `demo-${companyId}-p10`, companyId, name: "Paslanmaz məhəccər", code: "MT-MH", category: "Metal", params: "AISI 304, şüşə tutacağı ilə", colors: "Satın", sizes: "Xətti metr", unit: "m", price: "64.00", cost: "41.00", validUntil: "2026-12-31", minQty: "12", leadDays: "15", deliveryPrice: "40", installPrice: "16", breaks: [] },
    { id: `demo-${companyId}-p11`, companyId, name: "Pəncərə montajı", code: "MN-PN", category: "Montaj", params: "Açılış, köpük, kənar", colors: "", sizes: "m2", unit: "m2", price: "18.00", cost: "11.00", validUntil: "2026-12-31", minQty: "15", leadDays: "3", deliveryPrice: "", installPrice: "18", breaks: [] },
    { id: `demo-${companyId}-p12`, companyId, name: "Silikon və anker dəsti", code: "KM-SA", category: "Köməkçi", params: "Fasad silikonu, kimyəvi anker", colors: "Boz, şəffaf", sizes: "Dəst / 10 m", unit: "dəst", price: "22.00", cost: "13.50", validUntil: "2027-03-31", minQty: "10", leadDays: "2", deliveryPrice: "10", installPrice: "", breaks: [] },
  ]
  const prices: PriceLog[] = made.map((product) => ({
    id: `demo-price-${product.id}`,
    productId: product.id,
    at: "2026-09-02T09:00:00.000Z",
    from: "",
    to: product.price,
    by: owner,
  }))
  prices.push({
    id: `demo-price-${companyId}-p2-old`,
    productId: `demo-${companyId}-p2`,
    at: "2026-06-12T09:00:00.000Z",
    from: "15.90",
    to: "16.50",
    by: owner,
  })
  return { products: made, prices }
}

export function withDemo(state: ProcureState, orgs: { id: string; kind: string; name: string }[]): ProcureState {
  let files = state.files
  let products = state.products
  let prices = state.prices
  for (const org of orgs) {
    if (BUYERS.has(org.kind)) {
      if (!files.some((file) => file.companyId === org.id)) files = [...files, ...demoFiles(org.id)]
      files = withFormats(withHistory(files, org.id), org.id)
      // Extend only the existing demo collection; leave real-only libraries alone.
      if (files.some((file) => file.id === `demo-${org.id}-pencere`)) {
        const additions = extraDemoFiles(org.id).filter((file) => !files.some((saved) => saved.id === file.id))
        if (additions.length) files = [...files, ...additions]
      }
    }
    if (MAKERS.has(org.kind) && !products.some((product) => product.companyId === org.id)) {
      const made = demoProducts(org.id, org.name)
      products = [...products, ...made.products]
      prices = [...prices, ...made.prices]
    }
  }
  if (files === state.files && products === state.products) return state
  return { ...state, files, products, prices }
}
