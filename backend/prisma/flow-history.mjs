const STAGES = ["yeni", "fayl", "olcu", "hesab", "qiymet", "teklif", "tesdiq", "istehsal", "yoxlama", "dasima", "montaj", "tehvil", "zemanet"]

const ORDERS = [
  {
    key: "port-fasad",
    title: "Port Baku fasad pəncərələri",
    projectId: "seed-prj-port",
    supplier: "qapi",
    through: "zemanet",
    steps: [
      ["yeni", "2025-11-04", "Elvin Məmmədov", "48 pəncərəlik sifariş açıldı", "Port-Baku-sifaris.pdf"],
      ["fayl", "2025-11-12", "Nigar Əliyeva", "Cədvəldən 8 sətir oxundu, 2 sətir təsdiq gözləyir", "Yasamal-Zerdabi-12-pencere.xlsx"],
      ["olcu", "2025-11-20", "Rauf Hüseynov", "Sahə ölçüsü cizgi ilə üst-üstə düşdü", "olcu-akti-port.pdf"],
      ["hesab", "2025-12-02", "Günel Rzayeva", "Profil, şüşə və furnitur smetası bağlandı", "smeta-port-v3.xlsx"],
      ["qiymet", "2025-12-11", "Səbinə Əhmədova", "Üç təchizatçıdan qiymət gəldi", "qiymet-cedveli-port.xlsx"],
      ["teklif", "2025-12-18", "Kamal İbrahimov", "Kommersiya təklifi göndərildi", "teklif-KP-14.pdf"],
      ["tesdiq", "2026-01-08", "Elvin Məmmədov", "Sifariş və ödəniş qrafiki təsdiq olundu", "muqavile-14.pdf"],
      ["istehsal", "2026-01-15", "Kamal İbrahimov", "Sexə verildi, 18 iş günü", "istehsal-emri-14.pdf"],
      ["yoxlama", "2026-02-20", "Leyla Qasımova", "Şüşə paketi yoxlanıldı, cızıq yoxdur", "keyfiyyet-akti-14.pdf"],
      ["dasima", "2026-03-02", "Orxan Vəliyev", "Sumqayıtdan Yasamala şüşədaşıyanla", "yol-vereqesi-14.pdf"],
      ["montaj", "2026-03-18", "Vüsal Məlikov", "A oxu və 2-4-cü mərtəbə bağlandı", "montaj-akti-14.pdf"],
      ["tehvil", "2026-03-28", "Elvin Məmmədov", "Təhvil-təslim aktı imzalandı", "tehvil-akti-14.pdf"],
      ["zemanet", "2026-04-02", "Kamal İbrahimov", "24 ay zəmanət vərəqəsi açıldı", "zemanet-vesiqesi-14.pdf"],
    ],
  },
  {
    key: "villa-suse",
    title: "Mərdəkan villa şüşələri",
    projectId: "seed-prj-villa",
    supplier: "suse",
    through: "tehvil",
    steps: [
      ["yeni", "2026-01-14", "Vüsal Məlikov", "3 villa, vitrin və məhəccər şüşəsi", "villa-sifaris.pdf"],
      ["fayl", "2026-01-22", "Nigar Əliyeva", "DXF-dən fasad oxu oxundu", "villa-fasad.dxf"],
      ["olcu", "2026-02-03", "Rauf Hüseynov", "Bağlar küçəsində ölçü təsdiq olundu", "olcu-akti-villa.pdf"],
      ["hesab", "2026-02-16", "Günel Rzayeva", "32 mm enerji paketinin hesabı hazırdır", "smeta-villa.xlsx"],
      ["qiymet", "2026-02-24", "Səbinə Əhmədova", "Abşeron Şüşə qiyməti seçildi", "qiymet-villa.xlsx"],
      ["teklif", "2026-03-04", "Leyla Qasımova", "Kommersiya təklifi, 8 gün istehsal", "teklif-villa.pdf"],
      ["tesdiq", "2026-03-12", "Elvin Məmmədov", "Avans 40% təsdiq olundu", "muqavile-villa.pdf"],
      ["istehsal", "2026-03-18", "Leyla Qasımova", "Şüşə kəsimi başladı", "istehsal-villa.pdf"],
      ["yoxlama", "2026-04-09", "Leyla Qasımova", "Kənar və temper yoxlaması keçdi", "keyfiyyet-villa.pdf"],
      ["dasima", "2026-04-16", "Orxan Vəliyev", "Şüşədaşıyan, 38 km, gediş-gəliş", "yol-villa.pdf"],
      ["montaj", "2026-05-02", "Vüsal Məlikov", "Vitrin və məhəccər oturduldu", "montaj-villa.pdf"],
      ["tehvil", "2026-05-11", "Elvin Məmmədov", "Sahə təhvili, kiçik silikon qalığı bağlandı", "tehvil-villa.pdf"],
    ],
  },
  {
    key: "school-qapi",
    title: "Xırdalan məktəb qapıları",
    projectId: "seed-prj-school",
    supplier: "qapi",
    through: "montaj",
    steps: [
      ["yeni", "2026-05-06", "Rauf Hüseynov", "Giriş, otaq və yanğın qapıları", "mekteb-sifaris.pdf"],
      ["fayl", "2026-05-14", "Nigar Əliyeva", "CSV-də 5 sətir, yanğın qapısında ziddiyyət", "Giris-ve-otaq-qapilari.csv"],
      ["olcu", "2026-05-28", "Rauf Hüseynov", "Pilləkən ölçüsü yenidən götürüldü", "olcu-mekteb.pdf"],
      ["hesab", "2026-06-09", "Günel Rzayeva", "Antipanik dəsti hesaba əlavə olundu", "smeta-mekteb.xlsx"],
      ["qiymet", "2026-06-18", "Səbinə Əhmədova", "İki alüminium sexindən qiymət", "qiymet-mekteb.xlsx"],
      ["teklif", "2026-06-26", "Kamal İbrahimov", "EI60 qapı ayrıca sətirlə", "teklif-mekteb.pdf"],
      ["tesdiq", "2026-07-08", "Elvin Məmmədov", "Təhsil İnvest təsdiqi gəldi", "muqavile-mekteb.pdf"],
      ["istehsal", "2026-07-15", "Kamal İbrahimov", "Otaq qapıları sexdə, yanğın qapısı növbədə", "istehsal-mekteb.pdf"],
      ["yoxlama", "2026-08-20", "Kamal İbrahimov", "Bağlayıcı və kilid yoxlanıldı", "keyfiyyet-mekteb.pdf"],
      ["dasima", "2026-09-02", "Orxan Vəliyev", "Xırdalana iki reys", "yol-mekteb.pdf"],
      ["montaj", "2026-09-19", "Vüsal Məlikov", "Əsas giriş bağlandı, pilləkən davam edir", "montaj-mekteb.pdf"],
    ],
  },
  {
    key: "biz-vitrin",
    title: "Səbail biznes mərkəzi vitrini",
    projectId: "seed-prj-biz",
    supplier: "fasad",
    through: "dasima",
    steps: [
      ["yeni", "2026-04-07", "Rauf Hüseynov", "Giriş vitrini və A oxu panelləri", "biznes-sifaris.pdf"],
      ["fayl", "2026-04-16", "Nigar Əliyeva", "Fasad cizgisində bir profil sətri boş qaldı", "Fasad-A-oxu.dxf"],
      ["olcu", "2026-04-29", "Rauf Hüseynov", "Neftçilər prospektində ölçü təsdiq", "olcu-biznes.pdf"],
      ["hesab", "2026-05-13", "Günel Rzayeva", "Kompozit və şüşə ayrıca hesab", "smeta-biznes.xlsx"],
      ["qiymet", "2026-05-22", "Səbinə Əhmədova", "Gəncə fasad sexi seçildi", "qiymet-biznes.xlsx"],
      ["teklif", "2026-06-02", "Rəşad Məmmədli", "Avtomatik qapı ayrıca təklifdə", "teklif-biznes.pdf"],
      ["tesdiq", "2026-06-17", "Elvin Məmmədov", "Sifariş təsdiq, istehsal növbəsi iyul", "muqavile-biznes.pdf"],
      ["istehsal", "2026-07-06", "Rəşad Məmmədli", "Panel kəsimi başladı", "istehsal-biznes.pdf"],
      ["yoxlama", "2026-08-14", "Rəşad Məmmədli", "Üzlük qalınlığı uyğundur", "keyfiyyet-biznes.pdf"],
      ["dasima", "2026-09-08", "Orxan Vəliyev", "Gəncədən Səbailə, standart yük", "yol-biznes.pdf"],
    ],
  },
  {
    key: "gence-pvc",
    title: "Gəncə klinika pəncərələri",
    projectId: "seed-prj-gence",
    supplier: "pvc",
    through: "istehsal",
    steps: [
      ["yeni", "2026-06-03", "Nigar Əliyeva", "Palata və dəhliz pəncərələri", "klinika-sifaris.pdf"],
      ["fayl", "2026-06-12", "Nigar Əliyeva", "Spesifikasiya PDF-dən 4 sətir", "Mertebe-3-4-spesifikasiya.pdf"],
      ["olcu", "2026-06-25", "Rauf Hüseynov", "Atatürk prospektində ölçü götürüldü", "olcu-klinika.pdf"],
      ["hesab", "2026-07-07", "Günel Rzayeva", "PVC 70 mm və enerji şüşə", "smeta-klinika.xlsx"],
      ["qiymet", "2026-07-16", "Səbinə Əhmədova", "Xırdalan PVC qiyməti", "qiymet-klinika.xlsx"],
      ["teklif", "2026-07-28", "Tural Əliyev", "Ağ və qoz rəng ayrıca", "teklif-klinika.pdf"],
      ["tesdiq", "2026-08-11", "Elvin Məmmədov", "Səhiyyə fondu təsdiqi", "muqavile-klinika.pdf"],
      ["istehsal", "2026-08-19", "Tural Əliyev", "Profil kəsimi sexdə", "istehsal-klinika.pdf"],
    ],
  },
  {
    key: "sum-fasad",
    title: "Sumqayıt anbar fasadı",
    projectId: "seed-prj-sum",
    supplier: "fasad",
    through: "tesdiq",
    steps: [
      ["yeni", "2026-07-02", "Vüsal Məlikov", "Lojistik parkın giriş fasadı", "sumqayit-sifaris.pdf"],
      ["fayl", "2026-07-10", "Nigar Əliyeva", "Panel siyahısı oxundu", "sumqayit-fasad.xlsx"],
      ["olcu", "2026-07-23", "Rauf Hüseynov", "Hacı Zeynalabdin qəsəbəsində ölçü", "olcu-sumqayit.pdf"],
      ["hesab", "2026-08-04", "Günel Rzayeva", "Kompozit panel və anker dəsti", "smeta-sumqayit.xlsx"],
      ["qiymet", "2026-08-14", "Səbinə Əhmədova", "İki fasad təchizatçısı", "qiymet-sumqayit.xlsx"],
      ["teklif", "2026-08-26", "Rəşad Məmmədli", "11 gün istehsal, obyektə çatdırılma", "teklif-sumqayit.pdf"],
      ["tesdiq", "2026-09-09", "Elvin Məmmədov", "Sifariş təsdiq, icazə gecikməsi qeyd olundu", "muqavile-sumqayit.pdf"],
    ],
  },
  {
    key: "yasamal-olcu",
    title: "Yasamal Zərdabi 12 əlavə pəncərə",
    projectId: "seed-prj-port",
    supplier: "qapi",
    through: "olcu",
    steps: [
      ["yeni", "2026-08-18", "Nigar Əliyeva", "Əlavə 6 pəncərə, əvvəlki faylın davamı", "Yasamal-Zerdabi-12-pencere.xlsx"],
      ["fayl", "2026-09-02", "Nigar Əliyeva", "Köhnə versiya ilə müqayisə, say artdı", "pencere-v2.xlsx"],
      ["olcu", "2026-09-28", "Rauf Hüseynov", "2-4-cü mərtəbə təsdiq, balkon hələ açıqdır", "olcu-zerdabi.pdf"],
    ],
  },
  {
    key: "lenkeran-yeni",
    title: "Lənkəran sahil pəncərə sorğusu",
    projectId: "",
    supplier: "material",
    through: "yeni",
    steps: [
      ["yeni", "2026-10-06", "Səbinə Əhmədova", "Sorğu açıldı, ölçü hələ gəlməyib", "lenkeran-sorgu.pdf"],
    ],
  },
]

function throughIndex(stage) {
  const index = STAGES.indexOf(stage)
  if (index < 0) throw new Error(`Mərhələ tanınmadı: ${stage}`)
  return index
}

const STAGE_NOTE = {
  yeni: ["Elvin Məmmədov", "Sifariş açıldı", "sifaris.pdf"],
  fayl: ["Nigar Əliyeva", "Layihə faylı oxundu", "olculer.xlsx"],
  olcu: ["Rauf Hüseynov", "Sahə ölçüsü təsdiq olundu", "olcu-akti.pdf"],
  hesab: ["Günel Rzayeva", "Hesablama bağlandı", "smeta.xlsx"],
  qiymet: ["Səbinə Əhmədova", "Təchizatçı qiyməti seçildi", "qiymet.xlsx"],
  teklif: ["Kamal İbrahimov", "Kommersiya təklifi açıldı", "teklif.pdf"],
  tesdiq: ["Elvin Məmmədov", "Sifariş təsdiq olundu", "muqavile.pdf"],
  istehsal: ["Kamal İbrahimov", "İstehsala verildi", "istehsal-emri.pdf"],
  yoxlama: ["Leyla Qasımova", "Hazır məhsul yoxlanıldı", "keyfiyyet-akti.pdf"],
  dasima: ["Orxan Vəliyev", "Yük yola çıxdı", "yol-vereqesi.pdf"],
  montaj: ["Vüsal Məlikov", "Montaj davam edir", "montaj-akti.pdf"],
  tehvil: ["Elvin Məmmədov", "Təhvil aktı imzalandı", "tehvil-akti.pdf"],
  zemanet: ["Kamal İbrahimov", "Zəmanət vərəqəsi açıldı", "zemanet.pdf"],
}

async function fillSparse(prisma) {
  const flows = await prisma.orderFlow.findMany({
    where: { OR: [{ id: { startsWith: "hist-flow-" } }, { id: "seed-flow-1" }] },
    include: { events: true },
  })
  let filled = 0
  for (const flow of flows) {
    const end = STAGES.indexOf(flow.stage)
    if (end < 0) continue
    const needed = STAGES.slice(0, end + 1)
    const have = new Set(flow.events.map((event) => event.stage))
    if (needed.every((stage) => have.has(stage))) continue
    const last = flow.events.slice().sort((a, b) => a.date - b.date).at(-1)
    const endDate = last?.date ?? flow.createdAt
    if (flow.id.startsWith("hist-flow-")) {
      await prisma.orderEvent.deleteMany({ where: { flowId: flow.id } })
      await prisma.orderEvent.createMany({
        data: needed.map((stage, index) => {
          const date = new Date(endDate)
          date.setUTCDate(date.getUTCDate() - (needed.length - 1 - index) * 3)
          const [person, note, docs] = STAGE_NOTE[stage]
          return { id: `${flow.id}-${stage}`, flowId: flow.id, stage, person, date, note, docs }
        }),
      })
    } else {
      const missing = needed.filter((stage) => !have.has(stage))
      await prisma.orderEvent.createMany({
        data: missing.map((stage) => {
          const index = needed.indexOf(stage)
          const date = new Date(endDate)
          date.setUTCDate(date.getUTCDate() - (needed.length - 1 - index))
          const [person, note, docs] = STAGE_NOTE[stage]
          return { id: `${flow.id}-${stage}`, flowId: flow.id, stage, person, date, note, docs }
        }),
      })
    }
    filled += 1
  }
  return filled
}

export async function seedFlowHistory(prisma) {
  const orgs = await prisma.organization.findMany({ select: { id: true } })
  const partners = await prisma.organization.findMany({ select: { id: true, kind: true } })
  const projects = new Set((await prisma.project.findMany({ select: { id: true } })).map((row) => row.id))
  const byKind = new Map()
  for (const partner of partners) {
    if (!byKind.has(partner.kind)) byKind.set(partner.kind, partner.id)
  }
  const carrierId = byKind.get("logistika") ?? null
  const installerId = byKind.get("montaj") ?? null
  let written = 0
  for (const org of orgs) {
    for (const order of ORDERS) {
      const id = `flow-${org.id}-${order.key}`
      const end = throughIndex(order.through)
      const steps = order.steps.filter((step) => throughIndex(step[0]) <= end)
      const first = steps[0]
      const data = {
        organizationId: org.id,
        projectId: order.projectId && projects.has(order.projectId) ? order.projectId : null,
        supplierId: byKind.get(order.supplier) ?? null,
        carrierId: end >= throughIndex("dasima") ? carrierId : null,
        installerId: end >= throughIndex("montaj") ? installerId : null,
        title: order.title,
        stage: order.through,
        createdAt: new Date(`${first[1]}T12:00:00.000Z`),
      }
      await prisma.orderFlow.upsert({
        where: { id },
        update: data,
        create: { id, ...data },
      })
      await prisma.orderEvent.deleteMany({ where: { flowId: id } })
      await prisma.orderEvent.createMany({
        data: steps.map((step) => ({
          id: `flow-ev-${org.id}-${order.key}-${step[0]}`,
          flowId: id,
          stage: step[0],
          date: new Date(`${step[1]}T12:00:00.000Z`),
          person: step[2],
          note: step[3],
          docs: step[4],
        })),
      })
      written += 1
    }
  }
  await fillSparse(prisma)
  return written
}
