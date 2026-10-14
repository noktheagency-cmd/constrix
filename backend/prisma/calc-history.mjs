const RULE = { kgPerM: 1.35, wastePercent: 6, glassDeductMm: 36, glassWastePercent: 8 }

const JOBS = [
  {
    key: "port",
    title: "Port Baku yaşayış pəncərəsi",
    projectId: "seed-prj-port",
    at: "2026-09-04T09:20:00.000Z",
    width: 1400,
    height: 1500,
    count: 12,
    sections: 2,
    opening: "doner",
    color: "RAL 7016",
    profileNote: "Xəzər 60",
    glassKind: "Paket",
    glassThickness: "24",
    hardware: "Dönər-əyilən",
    installKind: "Montaj",
    address: "Yasamal, Zərdabi prospekti",
    profileRate: 12.4,
    glassRate: 92,
    hardwareRate: 46,
    laborRate: 18,
    installRate: 22,
    packRate: 4,
    transport: 180,
    extra: 0,
    vat: 18,
    profit: 10,
    profitMode: "faiz",
    produceDays: 12,
    haulDays: 2,
    installDays: 5,
  },
  {
    key: "biz",
    title: "Xəzər Business Center ofis bloku",
    projectId: "seed-prj-biz",
    at: "2026-09-18T11:05:00.000Z",
    width: 1800,
    height: 2100,
    count: 8,
    sections: 3,
    opening: "surusken",
    color: "RAL 9006",
    profileNote: "Anod",
    glassKind: "Paket",
    glassThickness: "32",
    hardware: "Sürüşkən",
    installKind: "Montaj",
    address: "Səbail, Neftçilər prospekti",
    profileRate: 11.8,
    glassRate: 88,
    hardwareRate: 52,
    laborRate: 20,
    installRate: 28,
    packRate: 5,
    transport: 240,
    extra: 40,
    vat: 18,
    profit: 12,
    profitMode: "faiz",
    produceDays: 10,
    haulDays: 1,
    installDays: 4,
  },
  {
    key: "villa",
    title: "Abşeron Villa balkon qapısı",
    projectId: "seed-prj-villa",
    at: "2026-09-29T14:40:00.000Z",
    width: 900,
    height: 2200,
    count: 6,
    sections: 1,
    opening: "doner",
    color: "RAL 8017",
    profileNote: "Ağac örtük",
    glassKind: "Paket",
    glassThickness: "24",
    hardware: "Dönər",
    installKind: "Montaj",
    address: "Mərdəkan, Bağlar küçəsi",
    profileRate: 13.2,
    glassRate: 96,
    hardwareRate: 64,
    laborRate: 24,
    installRate: 30,
    packRate: 6,
    transport: 160,
    extra: 0,
    vat: 18,
    profit: 15,
    profitMode: "marja",
    produceDays: 8,
    haulDays: 1,
    installDays: 3,
  },
  {
    key: "klinika",
    title: "Gəncə klinika sabit vitrin",
    projectId: "seed-prj-gence",
    at: "2026-10-06T08:15:00.000Z",
    width: 2400,
    height: 1800,
    count: 4,
    sections: 2,
    opening: "sabit",
    color: "RAL 9016",
    profileNote: "Xəzər 60",
    glassKind: "Paket",
    glassThickness: "28",
    hardware: "",
    installKind: "Montaj",
    address: "Gəncə, Atatürk prospekti",
    profileRate: 12.4,
    glassRate: 110,
    hardwareRate: 0,
    laborRate: 16,
    installRate: 26,
    packRate: 5,
    transport: 320,
    extra: 80,
    vat: 18,
    profit: 10,
    profitMode: "faiz",
    produceDays: 6,
    haulDays: 2,
    installDays: 3,
  },
  {
    key: "mekteb",
    title: "Xırdalan məktəb sinif pəncərəsi",
    projectId: "seed-prj-school",
    at: "2026-10-11T16:30:00.000Z",
    width: 1200,
    height: 1400,
    count: 20,
    sections: 2,
    opening: "asqili",
    color: "RAL 5012",
    profileNote: "Xəzər 60",
    glassKind: "Paket",
    glassThickness: "24",
    hardware: "Aşqı",
    installKind: "Montaj",
    address: "Xırdalan, Heydər Əliyev prospekti",
    profileRate: 10.5,
    glassRate: 78,
    hardwareRate: 38,
    laborRate: 14,
    installRate: 18,
    packRate: 3,
    transport: 260,
    extra: 0,
    vat: 18,
    profit: 8,
    profitMode: "faiz",
    produceDays: 14,
    haulDays: 1,
    installDays: 6,
  },
  {
    key: "otel",
    title: "Nizami otel lobbi qapısı",
    projectId: "seed-prj-biz",
    at: "2026-10-12T10:10:00.000Z",
    width: 1100,
    height: 2400,
    count: 2,
    sections: 1,
    opening: "doner",
    color: "RAL 9005",
    profileNote: "Termo 70",
    glassKind: "Paket",
    glassThickness: "32",
    hardware: "Qapı dəsti",
    installKind: "Montaj",
    address: "Nəsimi, Nizami küçəsi",
    profileRate: 18.9,
    glassRate: 128,
    hardwareRate: 86,
    laborRate: 32,
    installRate: 40,
    packRate: 8,
    transport: 90,
    extra: 25,
    vat: 18,
    profit: 14,
    profitMode: "faiz",
    produceDays: 7,
    haulDays: 1,
    installDays: 2,
  },
  {
    key: "giris",
    title: "Port Baku ofis giriş qapısı",
    projectId: "seed-prj-port",
    at: "2026-10-13T09:00:00.000Z",
    width: 1600,
    height: 2600,
    count: 3,
    sections: 2,
    opening: "doner",
    color: "RAL 7016",
    profileNote: "Xəzər 60",
    glassKind: "Paket",
    glassThickness: "28",
    hardware: "Dönər",
    installKind: "Montaj",
    address: "Yasamal, Zərdabi prospekti",
    profileRate: 14.2,
    glassRate: 110,
    hardwareRate: 74,
    laborRate: 28,
    installRate: 36,
    packRate: 6,
    transport: 140,
    extra: 0,
    vat: 18,
    profit: 12,
    profitMode: "faiz",
    produceDays: 9,
    haulDays: 1,
    installDays: 3,
  },
  {
    key: "teras",
    title: "Mərdəkan teras sürüşkən sistemi",
    projectId: "seed-prj-villa",
    at: "2026-07-14T13:25:00.000Z",
    width: 3000,
    height: 2200,
    count: 2,
    sections: 3,
    opening: "surusken",
    color: "Anod",
    profileNote: "Anod 50",
    glassKind: "Paket",
    glassThickness: "32",
    hardware: "Sürüşkən",
    installKind: "Montaj",
    address: "Mərdəkan, Bağlar küçəsi",
    profileRate: 16.4,
    glassRate: 128,
    hardwareRate: 74,
    laborRate: 30,
    installRate: 42,
    packRate: 8,
    transport: 210,
    extra: 60,
    vat: 18,
    profit: 16,
    profitMode: "faiz",
    produceDays: 11,
    haulDays: 1,
    installDays: 4,
  },
  {
    key: "sumqayit",
    title: "Sumqayıt poliklinika pəncərəsi",
    projectId: "seed-prj-sum",
    at: "2026-08-22T08:40:00.000Z",
    width: 1500,
    height: 1600,
    count: 16,
    sections: 2,
    opening: "asqili",
    color: "RAL 9016",
    profileNote: "PVC 70",
    glassKind: "Paket",
    glassThickness: "24",
    hardware: "Aşqı",
    installKind: "Montaj",
    address: "Sumqayıt, Hacı Zeynalabdin",
    profileRate: 7.8,
    glassRate: 78,
    hardwareRate: 34,
    laborRate: 12,
    installRate: 16,
    packRate: 3,
    transport: 280,
    extra: 0,
    vat: 18,
    profit: 9,
    profitMode: "faiz",
    produceDays: 16,
    haulDays: 2,
    installDays: 7,
  },
  {
    key: "vitrin",
    title: "Gəncə ticarət mərkəzi vitrini",
    projectId: "seed-prj-gence",
    at: "2026-10-02T15:10:00.000Z",
    width: 2000,
    height: 2400,
    count: 5,
    sections: 2,
    opening: "sabit",
    color: "RAL 9006",
    profileNote: "Fasad 50",
    glassKind: "Paket",
    glassThickness: "32",
    hardware: "",
    installKind: "Montaj",
    address: "Gəncə, Atatürk prospekti",
    profileRate: 15.6,
    glassRate: 118,
    hardwareRate: 0,
    laborRate: 22,
    installRate: 34,
    packRate: 7,
    transport: 360,
    extra: 90,
    vat: 18,
    profit: 11,
    profitMode: "faiz",
    produceDays: 10,
    haulDays: 2,
    installDays: 4,
  },
]

function quote(job) {
  const bays = Math.max(1, Math.floor(job.sections))
  const count = job.count
  const lengthMm = job.width * count * 2 + job.height * count * 2 + (bays > 1 ? job.height * count * (bays - 1) : 0)
  const lengthM = lengthMm / 1000
  const weightKg = lengthM * RULE.kgPerM
  const wasteM = lengthM * RULE.wastePercent / 100
  const glassArea = (job.width / 1000) * (job.height / 1000) * count
  const paneW = job.width / bays - RULE.glassDeductMm
  const paneH = job.height - RULE.glassDeductMm
  const cutArea = paneW > 0 && paneH > 0 ? (paneW / 1000) * (paneH / 1000) * bays * count : 0
  const glassQty = cutArea * (1 + RULE.glassWastePercent / 100)
  const profileQty = lengthM + wasteM
  const hardwareQty = job.opening === "sabit" ? 0 : count
  const lines = [
    ["Alüminium profil", "m", profileQty, job.profileRate],
    ["Şüşə", "m2", glassQty, job.glassRate],
    ["Furnitur və aksesuar", "dest", hardwareQty, job.hardwareRate],
    ["İstehsal əməkhaqqı", "eded", count, job.laborRate],
    ["Qablaşdırma", "eded", count, job.packRate],
    ["Montaj", "eded", job.installKind ? count : 0, job.installKind ? job.installRate : 0],
    ["Daşınma", "sifaris", 1, job.transport],
    ["Əlavə xərc", "sifaris", 1, job.extra],
  ].map(([name, unit, qty, rate], sort) => ({
    sort,
    name,
    unit,
    qty,
    rate,
    amount: qty * rate,
    note: "",
  }))
  const cost = lines.reduce((sum, line) => sum + line.amount, 0)
  const profit = job.profitMode === "marja" ? cost / (1 - job.profit / 100) - cost : cost * job.profit / 100
  const sale = cost + profit
  const vat = sale * job.vat / 100
  return {
    lengthM,
    weightKg,
    wasteM,
    glassArea,
    cutArea,
    cost,
    profit,
    vat,
    sale,
    gross: sale + vat,
    lines,
  }
}

async function ruleFor(prisma, orgId) {
  const existing = await prisma.tradeRule.findFirst({
    where: { organizationId: orgId, trade: "qapi", confirmed: true },
  })
  if (existing) return existing
  return prisma.tradeRule.upsert({
    where: { id: `hist-rule-${orgId}` },
    update: { confirmed: true, system: "Xəzər 60", kgPerM: RULE.kgPerM, wastePercent: RULE.wastePercent, glassDeductMm: RULE.glassDeductMm, glassWastePercent: RULE.glassWastePercent },
    create: {
      id: `hist-rule-${orgId}`,
      organizationId: orgId,
      trade: "qapi",
      system: "Xəzər 60",
      confirmed: true,
      kgPerM: RULE.kgPerM,
      wastePercent: RULE.wastePercent,
      glassDeductMm: RULE.glassDeductMm,
      glassWastePercent: RULE.glassWastePercent,
    },
  })
}

const OFFER_PRODUCTS = [
  ["seed-prd-termo", "seed-org-alum", "Termo profil 70 mm", "TR-70", "Alüminium sistemləri", "m", 18.9, 12.4, "Termo körpü 24 mm", "RAL 7016, RAL 9016", "6.5 m çubuq", 24, 12],
  ["seed-prd-anod", "seed-org-alum", "Anod profil 50 mm", "AN-50", "Alüminium sistemləri", "m", 14.2, 9.1, "Anod örtük", "Gümüş, tünd", "6 m çubuq", 30, 8],
  ["seed-prd-fasad-pr", "seed-org-fasad", "Fasad profil 50 mm", "FS-50", "Fasad sistemləri", "m", 15.6, 10.4, "Üzlüklü dayaq", "RAL 9006", "6 m", 18, 11],
  ["seed-prd-slide", "seed-org-alum", "Sürüşkən furnitur dəsti", "FRN-S", "Qapı və pəncərələr", "dest", 74, 48, "200 kq-dək qanad", "Gümüş", "Standart", 6, 9],
  ["seed-prd-glass32", "seed-org-glass", "Şüşə paket 32 mm enerji", "GL-32E", "Şüşə", "m2", 128, 86, "Low-E, arqon", "Neytral", "Maksimum 2500×3500", 8, 8],
]

async function ensureOfferCatalog(prisma, orgIds) {
  for (const [id, organizationId, name, code, category, unit, price, cost, params, colors, sizes, minQty, leadDays] of OFFER_PRODUCTS) {
    if (!orgIds.has(organizationId)) continue
    const data = {
      organizationId,
      name,
      code,
      category,
      unit,
      price,
      cost,
      params,
      colors,
      sizes,
      minQty,
      leadDays,
      validUntil: new Date("2027-06-01"),
    }
    await prisma.catalogProduct.upsert({ where: { id }, update: data, create: { id, ...data } })
  }
}

const FLOW_STAGES = ["teklif", "qiymet", "tesdiq", "istehsal", "yoxlama", "dasima", "montaj", "tehvil", "hesab", "yeni"]
const STAGE_ORDER = ["yeni", "fayl", "olcu", "hesab", "qiymet", "teklif", "tesdiq", "istehsal", "yoxlama", "dasima", "montaj", "tehvil", "zemanet"]
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

function stageTrail(stage, endAt) {
  const end = STAGE_ORDER.indexOf(stage)
  const steps = STAGE_ORDER.slice(0, (end < 0 ? 0 : end) + 1)
  return steps.map((item, index) => {
    const date = new Date(endAt)
    date.setUTCDate(date.getUTCDate() - (steps.length - 1 - index) * 3)
    const [person, note, docs] = STAGE_NOTE[item]
    return { stage: item, person, date, note, docs }
  })
}

export async function seedCalcHistory(prisma) {
  const orgRows = await prisma.organization.findMany({ select: { id: true } })
  const orgIds = new Set(orgRows.map((row) => row.id))
  await ensureOfferCatalog(prisma, orgIds)
  const profiles = await prisma.catalogProduct.findMany({
    where: { unit: "m", category: { in: ["Alüminium sistemləri", "Qapı və pəncərələr", "Fasad sistemləri"] } },
    select: { id: true },
    take: 8,
  })
  const orgs = orgRows
  const projects = new Set((await prisma.project.findMany({ select: { id: true } })).map((row) => row.id))
  let written = 0
  for (const org of orgs) {
    const rule = await ruleFor(prisma, org.id)
    for (const [index, job] of JOBS.entries()) {
      const id = `hist-${org.id}-${job.key}`
      const math = quote(job)
      const projectId = org.id === "seed-org-afez" && projects.has(job.projectId) ? job.projectId : null
      const data = {
        organizationId: org.id,
        projectId,
        ruleId: rule.id,
        trade: "qapi",
        title: job.title,
        widthMm: job.width,
        heightMm: job.height,
        count: job.count,
        sections: job.sections,
        opening: job.opening,
        color: job.color,
        profileNote: job.profileNote,
        glassKind: job.glassKind,
        glassThickness: job.glassThickness,
        hardware: job.hardware,
        installKind: job.installKind,
        address: job.address,
        profileUnit: "m",
        profileRate: job.profileRate,
        glassRate: job.glassRate,
        hardwareRate: job.hardwareRate,
        laborRate: job.laborRate,
        installRate: job.installRate,
        packRate: job.packRate,
        transport: job.transport,
        extra: job.extra,
        vatPercent: job.vat,
        profitPercent: job.profit,
        profitMode: job.profitMode,
        glassConfirmed: true,
        lengthM: math.lengthM,
        weightKg: math.weightKg,
        wasteM: math.wasteM,
        glassArea: math.glassArea,
        cutArea: math.cutArea,
        cost: math.cost,
        profitAmount: math.profit,
        vatAmount: math.vat,
        sale: math.sale,
        gross: math.gross,
        blocked: [],
        createdAt: new Date(job.at),
      }
      const lines = math.lines.map((line, sort) => ({ id: `${id}-l${sort}`, ...line }))
      const schedule = {
        id: `${id}-sch`,
        produceDays: job.produceDays,
        haulDays: job.haulDays,
        installDays: job.installDays,
        weatherDays: 0,
        totalDays: job.produceDays + job.haulDays + job.installDays,
        startOn: new Date(job.at),
      }
      const exists = await prisma.calcJob.findUnique({ where: { id } })
      if (exists) {
        await prisma.calcCostLine.deleteMany({ where: { jobId: id } })
        await prisma.jobSchedule.deleteMany({ where: { jobId: id } })
        await prisma.calcJob.update({
          where: { id },
          data: { ...data, lines: { create: lines }, schedule: { create: schedule } },
        })
      } else {
        await prisma.calcJob.create({
          data: { id, ...data, lines: { create: lines }, schedule: { create: schedule } },
        })
      }
      await prisma.calcJobProduct.deleteMany({ where: { jobId: id } })
      if (profiles.length) {
        await prisma.calcJobProduct.createMany({
          data: profiles.map((product) => ({ jobId: id, productId: product.id })),
        })
      }
      const stage = FLOW_STAGES[index % FLOW_STAGES.length]
      const flowData = {
        title: job.title,
        stage,
        projectId,
        supplierId: orgIds.has("seed-org-alum") ? "seed-org-alum" : null,
        carrierId: orgIds.has("seed-org-log") ? "seed-org-log" : null,
        installerId: orgIds.has("seed-org-montaj") ? "seed-org-montaj" : null,
      }
      const flowId = `hist-flow-${org.id}-${job.key}`
      const trail = stageTrail(stage, job.at).map((step) => ({
        id: `hist-ev-${org.id}-${job.key}-${step.stage}`,
        ...step,
      }))
      const flow = await prisma.orderFlow.findUnique({ where: { jobId: id }, include: { events: true } })
      if (flow) {
        await prisma.orderFlow.update({ where: { id: flow.id }, data: flowData })
        const covered = new Set(flow.events.map((event) => event.stage))
        const complete = trail.every((step) => covered.has(step.stage))
        if (!complete) {
          await prisma.orderEvent.deleteMany({ where: { flowId: flow.id } })
          await prisma.orderEvent.createMany({ data: trail.map((step) => ({ ...step, flowId: flow.id })) })
        }
      } else {
        await prisma.orderFlow.create({
          data: {
            id: flowId,
            organizationId: org.id,
            jobId: id,
            ...flowData,
            events: { create: trail },
          },
        })
      }
      written += 1
    }
  }
  return written
}
