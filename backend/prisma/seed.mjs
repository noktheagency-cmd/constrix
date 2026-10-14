import { readFileSync } from "node:fs"
import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"
import { bulk } from "./bulk.mjs"
import { seedCalcHistory } from "./calc-history.mjs"
import { seedHaulHistory } from "./haul-history.mjs"

const prisma = new PrismaClient()
const day = (value) => new Date(value)
const templateCatalog = JSON.parse(readFileSync(new URL("../../src/template-catalog.json", import.meta.url), "utf8"))

const WIPE = [
  "phaseProcedure",
  "forma3",
  "leaveRequest",
  "hrPayment",
  "hrMove",
  "terminal",
  "trip",
  "fuelFill",
  "fleetDoc",
  "gearEvent",
  "gear",
  "serviceJob",
  "recipe",
  "changeOrder",
  "crmTask",
  "crmFile",
  "crmActivity",
  "closedPeriod",
  "weatherProof",
  "defectAct",
  "siteIncident",
  "projectPhoto",
  "stockLot",
  "dispute",
  "approvalChain",
  "jobOpening",
  "priceInquiry",
  "notice",
  "laborTariff",
  "machineTariff",
  "rentalOffer",
  "haulQuote",
  "orderFlow",
  "calcJob",
  "projectFile",
  "tradeRule",
  "shareConsent",
  "tenderCase",
  "boqBook",
  "workSchedule",
  "cashPlan",
  "legalTemplate",
  "materialPassport",
  "guaranteeCase",
  "coopRequest",
  "talent",
  "weatherDay",
  "project",
  "client",
  "financePartner",
  "smeta",
  "contract",
  "act",
  "invoice",
  "expense",
  "payable",
  "purchaseOrder",
  "materialRequest",
  "movement",
  "stock",
  "material",
  "shipment",
  "location",
  "dailyReport",
  "attendance",
  "person",
  "crew",
  "department",
  "office",
  "asset",
  "driver",
  "plant",
  "workOrder",
  "payroll",
  "supplier",
  "quote",
  "lead",
  "deal",
  "auditEntry",
  "journalEntry",
  "document",
]

async function wipe() {
  await prisma.jobWeatherHold.deleteMany({ where: { weatherDayId: { startsWith: "seed-" } } })
  await prisma.organizationMember.deleteMany({
    where: {
      OR: [
        { id: { startsWith: "seed-" } },
        {
          account: {
            email: {
              in: [
                "elvin@afez.az",
                "nigar@afez.az",
                "rauf@afez.az",
                "kamran@afez.az",
                "sebine@afez.az",
                "gunel@afez.az",
                "aysel@afez.az",
                "admin@afez.az",
              ],
            },
          },
        },
      ],
    },
  })
  await prisma.organization.deleteMany({ where: { id: { startsWith: "seed-" } } })
  for (const name of WIPE) {
    await prisma[name].deleteMany({ where: { id: { startsWith: "seed-" } } })
  }
}

async function main() {
  await wipe()
  const passwordHash = await bcrypt.hash("Afez2026!", 10)
  await prisma.account.upsert({
    where: { email: "admin@afez.az" },
    update: {
      name: "Platforma inzibatçısı",
      role: "director",
      title: "Platforma inzibatçısı",
      initials: "Pİ",
      passwordHash,
    },
    create: {
      email: "admin@afez.az",
      userId: "U-ADMIN",
      name: "Platforma inzibatçısı",
      role: "director",
      title: "Platforma inzibatçısı",
      initials: "Pİ",
      passwordHash,
    },
  })
  const accounts = await prisma.account.findMany({
    where: {
      email: {
        in: [
          "elvin@afez.az",
          "nigar@afez.az",
          "rauf@afez.az",
          "kamran@afez.az",
          "sebine@afez.az",
          "gunel@afez.az",
          "aysel@afez.az",
          "admin@afez.az",
        ],
      },
    },
  })
  const byEmail = Object.fromEntries(accounts.map((row) => [row.email, row]))

  const orgs = [
    ["seed-org-afez", "tikinti", "AZ-AFEZ-01", "Sənaye Xidmətləri Tikinti Qrupu", "1700123451", "Elvin Məmmədov", "Yasamal, Zərdabi prospekti 12", "Bakı və Abşeron", 86],
    ["seed-org-alum", "qapi", "AZ-ALUM-02", "Xəzər Alüminium Sistemləri", "1700456123", "Kamal İbrahimov", "Binəqədi sənaye zonası", "Bakı və Abşeron, Gəncə-Qazax", 42],
    ["seed-org-glass", "suse", "AZ-SUSE-03", "Abşeron Şüşə", "2000789012", "Leyla Qasımova", "Sumqayıt Sənaye Parkı", "Bakı və Abşeron, Aran", 28],
    ["seed-org-pvc", "pvc", "AZ-PVC-04", "Qafqaz PVC Profil", "1800333444", "Tural Əliyev", "Xırdalan istehsal sahəsi", "Bakı və Abşeron", 35],
    ["seed-org-fasad", "fasad", "AZ-FASAD-05", "Fasad Konstruksiya", "1300900111", "Rəşad Məmmədli", "Gəncə, Kəpəz", "Gəncə-Qazax", 24],
    ["seed-org-boya", "material", "AZ-BOYA-06", "Azər Boya İstehsalat", "1200566778", "Sevinc Hüseynova", "Sumqayıt Kimya Parkı", "Bakı və Abşeron, Lənkəran-Astara", 60],
    ["seed-org-metal", "material", "AZ-METAL-07", "Kür Armatur və İnert", "1600147258", "Elşən Qarayev", "Yevlax anbarı", "Aran, Gəncə-Qazax", 48],
    ["seed-org-montaj", "montaj", "AZ-MONT-08", "Sahə Montaj", "1500222333", "Vüsal Məlikov", "Bakı, Nərimanov", "Bakı və Abşeron", 70],
    ["seed-org-log", "logistika", "AZ-LOG-09", "Şüşədaşıma Lojistik", "1900888999", "Orxan Vəliyev", "Ələt logistika mərkəzi", "Bakı və Abşeron, Aran", 18],
    ["seed-org-arch", "memar", "AZ-MEM-10", "Xətt Layihə Bürosu", "1000111222", "Aygün Əlizadə", "Bakı", "Bakı və Abşeron", 12],
    ["seed-org-admin", "admin", "AZ-ADMIN-00", "Platforma idarəsi", "9900000001", "Platforma inzibatçısı", "Bakı", "Bütün regionlar", 4],
  ]
  for (const [id, kind, code, name, voen, director, address, regions, staff] of orgs) {
    await prisma.organization.create({
      data: {
        id,
        kind,
        code,
        name,
        voen,
        phone: "+994 12 000 00 00",
        email: `${id.replace("seed-org-", "")}@afez.az`,
        director,
        legalAddress: address,
        actualAddress: address,
        capacity: kind === "tikinti" ? "Yaşayış, kommersiya, sənaye" : "İstehsal və təchizat",
        warehouse: "Mərkəzi anbar",
        regions,
        warranty: "24 ay",
        staffCount: staff,
        directions: kind,
        permits: "Fəaliyyət şəhadətnaməsi qovluqdadır",
        equipmentPark: kind === "logistika" ? "Şüşədaşıyan və standart yük" : "Öz parkı",
        turnoverNote: "Son ilin dövriyyəsi sənədlə təsdiqlənir",
        bankDetails: "ABB, AZ00AIIB00000000000000000000",
        warehousePolicy: { create: { id: `${id}-wh`, method: id === "seed-org-metal" ? "fifo" : "orta" } },
      },
    })
  }

  const seats = [
    ["elvin@afez.az", "seed-org-afez", "direktor", "Elvin Məmmədov"],
    ["nigar@afez.az", "seed-org-afez", "layihe", "Nigar Əliyeva"],
    ["rauf@afez.az", "seed-org-afez", "sahe", "Rauf Hüseynov"],
    ["kamran@afez.az", "seed-org-afez", "anbardar", "Kamran Əliyev"],
    ["sebine@afez.az", "seed-org-afez", "satinalma", "Səbinə Əhmədova"],
    ["gunel@afez.az", "seed-org-afez", "muhasib", "Günel Rzayeva"],
    ["aysel@afez.az", "seed-org-afez", "satis", "Aysel Həsənova"],
    ["admin@afez.az", "seed-org-admin", "direktor", "Platforma inzibatçısı"],
  ]
  for (const [email, organizationId, seatRole, name] of seats) {
    const account = byEmail[email]
    if (!account) continue
    await prisma.organizationMember.create({
      data: { id: `seed-seat-${email}`, organizationId, accountId: account.id, name, seatRole },
    })
  }

  await prisma.orgSubscription.create({
    data: {
      id: "seed-sub-afez",
      organizationId: "seed-org-afez",
      packageId: "pkg-pesekar",
      status: "aktiv",
      startedOn: day("2026-09-01"),
      endsOn: day("2027-09-01"),
    },
  })
  await prisma.orgSubscription.create({
    data: {
      id: "seed-sub-admin",
      organizationId: "seed-org-admin",
      packageId: "pkg-korporativ",
      status: "aktiv",
      startedOn: day("2026-09-01"),
      endsOn: day("2027-09-01"),
    },
  })
  await prisma.serviceCharge.create({
    data: {
      id: "seed-charge-afez",
      organizationId: "seed-org-afez",
      planId: "plan-abune",
      amount: 450,
      invoice: "Qeyd-2026-09",
      status: "qeyd",
    },
  })
  await prisma.orgSubscription.create({
    data: {
      id: "seed-sub-alum",
      organizationId: "seed-org-alum",
      packageId: "pkg-baslangic",
      status: "aktiv",
      startedOn: day("2026-08-01"),
      endsOn: day("2027-08-01"),
    },
  })

  const clients = [
    ["seed-cli-xezer", "Xəzər Holdinq", "İnşaat", "Lalə Məmmədova", "+994 50 410 20 30", "lale@xezer.az", "Bakı", "2024"],
    ["seed-cli-sumqayit", "Sumqayıt Sənaye Parkı", "Sənaye", "Rəşid Quliyev", "+994 50 511 22 10", "info@ssp.az", "Sumqayıt", "2025"],
    ["seed-cli-gence", "Gəncə Səhiyyə Fondu", "Səhiyyə", "Könül Əliyeva", "+994 22 256 00 11", "fond@gence.az", "Gəncə", "2026"],
    ["seed-cli-caspian", "Caspian Estates", "Yaşayış", "Nicat Əhmədov", "+994 50 300 14 14", "nicat@caspian.az", "Bakı", "2025"],
    ["seed-cli-tehsil", "Təhsil İnvest", "Təhsil", "Aysel Quliyeva", "+994 12 440 19 19", "ayse@tehsilinvest.az", "Abşeron", "2026"],
  ]
  for (const [id, name, sector, contact, phone, email, city, since] of clients) {
    await prisma.client.create({ data: { id, name, sector, contact, phone, email, city, since } })
  }

  const projects = [
    ["seed-prj-port", "Port Baku Residence", "seed-cli-xezer", "Xəzər Holdinq", "Yasamal", "Bakı", "Həsən bəy Zərdabi prospekti", "Fasad", 78, 24500000, 18640000, "2025-03-12", "2026-11-30", "Nigar Əliyeva", 86, "aktiv", "Yaşayış", 18, 42600, ""],
    ["seed-prj-biz", "Xəzər Business Center", "seed-cli-xezer", "Xəzər Holdinq", "Səbail", "Bakı", "Neftçilər prospekti", "Karkas", 41, 18200000, 6940000, "2025-11-04", "2027-04-15", "Rauf Hüseynov", 64, "aktiv", "Kommersiya", 22, 31800, ""],
    ["seed-prj-sum", "Sumqayıt Lojistik Park", "seed-cli-sumqayit", "Sumqayıt Sənaye Parkı", "Sumqayıt", "Sumqayıt", "Hacı Zeynalabdin qəsəbəsi", "Karkas", 63, 11400000, 8020000, "2025-06-02", "2026-12-20", "Vüsal Məlikov", 48, "gecikir", "Sənaye", 2, 28400, "İcazə 11 gün gecikir"],
    ["seed-prj-gence", "Gəncə Şəhər Klinikası", "seed-cli-gence", "Gəncə Səhiyyə Fondu", "Kəpəz", "Gəncə", "Atatürk prospekti", "Bünövrə", 18, 9600000, 1480000, "2026-05-18", "2027-09-01", "Nigar Əliyeva", 32, "aktiv", "Dövlət", 6, 14200, ""],
    ["seed-prj-villa", "Abşeron Villa Qrupu", "seed-cli-caspian", "Caspian Estates", "Mərdəkan", "Bakı", "Bağlar küçəsi", "Tamamlama", 91, 7800000, 7210000, "2025-01-20", "2026-10-15", "Vüsal Məlikov", 22, "tehvil", "Yaşayış", 3, 6400, ""],
    ["seed-prj-school", "Xırdalan Məktəb Kompleksi", "seed-cli-tehsil", "Təhsil İnvest", "Xırdalan", "Abşeron", "Heydər Əliyev prospekti", "Torpaq", 6, 4200000, 180000, "2026-09-01", "2027-08-30", "Rauf Hüseynov", 12, "plan", "Təhsil", 4, 8100, ""],
  ]
  for (const row of projects) {
    const [id, name, clientId, clientName, district, city, address, phase, progress, budget, spent, start, end, manager, crew, status, type, floors, area, note] = row
    await prisma.project.create({
      data: {
        id,
        name,
        clientId,
        clientName,
        district,
        city,
        address,
        phase,
        progress,
        budget,
        spent,
        start,
        end,
        manager,
        crew,
        status,
        type,
        floors,
        area,
        note,
        organizationId: "seed-org-afez",
        phases: {
          create: ["Torpaq", "Bünövrə", "Karkas", "Fasad", "Tamamlama", "Təhvil"].map((item, sort) => ({
            id: `${id}-ph-${sort}`,
            name: item,
            sort,
            done: item !== phase && ["Torpaq", "Bünövrə", "Karkas", "Fasad", "Tamamlama", "Təhvil"].indexOf(item) < ["Torpaq", "Bünövrə", "Karkas", "Fasad", "Tamamlama", "Təhvil"].indexOf(phase),
            current: item === phase,
          })),
        },
        notes: {
          create: [{ id: `${id}-note`, date: "2026-10-08", text: `${name}: sahə qeydi toxum məlumatıdır.` }],
        },
      },
    })
  }

  await prisma.smeta.create({
    data: {
      id: "seed-smeta-port",
      projectId: "seed-prj-port",
      version: 3,
      status: "tesdiq",
      lines: {
        create: [
          ["Fasad sistemi", "m2", 4200, 186, 2100, 1800, 0.4],
          ["Alüminium pəncərə", "eded", 640, 420, 120, 0, 1.5],
          ["Şüşə paket 24 mm", "m2", 1860, 95, 400, 0, 0.2],
          ["B30 beton", "m3", 980, 148, 980, 900, 1.1],
          ["Armatur A500", "ton", 210, 1120, 180, 160, 8],
        ].map(([name, unit, qty, unitPrice, doneQty, billedQty, laborHours], sort) => ({
          id: `seed-smeta-port-${sort}`,
          sort,
          code: `B.${sort + 1}`,
          name,
          unit,
          qty,
          unitPrice,
          doneQty,
          billedQty,
          laborHours,
        })),
      },
    },
  })
  await prisma.project.update({ where: { id: "seed-prj-port" }, data: { smetaId: "seed-smeta-port" } })

  await prisma.contract.create({
    data: {
      id: "seed-ctr-port",
      projectId: "seed-prj-port",
      client: "Xəzər Holdinq",
      number: "MQ-2408",
      signed: "2025-03-01",
      value: 24500000,
      advancePct: 15,
      retentionPct: 5,
      vat: 18,
      schedule: {
        create: [
          { id: "seed-ctr-port-1", sort: 1, title: "Avans", due: "2025-03-15", share: 0.15, status: "odenib" },
          { id: "seed-ctr-port-2", sort: 2, title: "Karkas", due: "2026-02-01", share: 0.4, status: "odenib" },
          { id: "seed-ctr-port-3", sort: 3, title: "Fasad", due: "2026-11-01", share: 0.35, status: "gozleyir" },
          { id: "seed-ctr-port-4", sort: 4, title: "Təhvil", due: "2026-12-15", share: 0.1, status: "gozleyir" },
        ],
      },
    },
  })
  await prisma.act.create({
    data: {
      id: "seed-act-port",
      number: "AKT-09",
      projectId: "seed-prj-port",
      project: "Port Baku Residence",
      client: "Xəzər Holdinq",
      contractNumber: "MQ-2408",
      period: "2026-09",
      date: "2026-09-30",
      net: 860000,
      vat: 154800,
      gross: 1014800,
      status: "tesdiq",
      lines: {
        create: [{ id: "seed-act-port-1", sort: 1, smetaLineId: "seed-smeta-port-0", code: "B.1", name: "Fasad alt konstruksiya", unit: "m2", unitPrice: 1343.75, qty: 640, cumulativeQty: 1800 }],
      },
    },
  })
  await prisma.invoice.createMany({
    data: [
      { id: "seed-inv-1", client: "Xəzər Holdinq", project: "Port Baku Residence", amount: 1014800, issued: "2026-09-30", due: "2026-10-30", status: "gozleyir", net: 860000, vat: 154800, actId: "seed-act-port" },
      { id: "seed-inv-2", client: "Xəzər Holdinq", project: "Xəzər Business Center", amount: 420000, issued: "2026-08-31", due: "2026-09-30", status: "gecikir", net: 355932, vat: 64068 },
    ],
  })
  await prisma.expense.createMany({
    data: [
      { id: "seed-exp-1", category: "Material", vendor: "Kür Armatur və İnert", project: "Port Baku Residence", amount: 235000, date: "2026-09-18", status: "tesdiq" },
      { id: "seed-exp-2", category: "İşçilik", vendor: "Öz heyət", project: "Port Baku Residence", amount: 96000, date: "2026-09-30", status: "tesdiq" },
      { id: "seed-exp-3", category: "Texnika", vendor: "Sahə Montaj", project: "Xəzər Business Center", amount: 18400, date: "2026-10-02", status: "gozleyir" },
      { id: "seed-exp-4", category: "Nəqliyyat", vendor: "Şüşədaşıma Lojistik", project: "Abşeron Villa Qrupu", amount: 6200, date: "2026-10-06", status: "tesdiq" },
    ],
  })

  await prisma.location.createMany({
    data: [
      { id: "seed-loc-merkez", name: "Mərkəzi anbar", kind: "merkez" },
      { id: "seed-loc-port", name: "Port Baku sahə anbarı", kind: "sahe", projectId: "seed-prj-port" },
      { id: "seed-loc-temp", name: "Müvəqqəti meydança", kind: "meydanca", projectId: "seed-prj-biz" },
    ],
  })
  const materials = [
    ["seed-mat-arm", "Armatur A500 Ø16", "ton", 48, 20, "Mərkəzi anbar", 1120],
    ["seed-mat-sem", "Sement CEM II 42.5", "ton", 86, 30, "Mərkəzi anbar", 168],
    ["seed-mat-boya", "Fasad boyası ağ", "kq", 2400, 500, "Port Baku sahə anbarı", 4.8],
    ["seed-mat-suse", "Şüşə paket 24 mm", "m2", 180, 40, "Müvəqqəti meydança", 95],
    ["seed-mat-profil", "Alüminium profil 60 mm", "m", 920, 200, "Mərkəzi anbar", 11.5],
  ]
  for (const [id, name, unit, qty, min, location, price] of materials) {
    await prisma.material.create({ data: { id, name, unit, qty, min, location, price } })
  }
  await prisma.stock.createMany({
    data: [
      { id: "seed-stk-1", materialId: "seed-mat-arm", locationId: "seed-loc-merkez", qty: 32 },
      { id: "seed-stk-2", materialId: "seed-mat-arm", locationId: "seed-loc-port", qty: 16 },
      { id: "seed-stk-3", materialId: "seed-mat-sem", locationId: "seed-loc-merkez", qty: 86 },
      { id: "seed-stk-4", materialId: "seed-mat-boya", locationId: "seed-loc-port", qty: 2400 },
      { id: "seed-stk-5", materialId: "seed-mat-suse", locationId: "seed-loc-temp", qty: 180 },
    ],
  })
  await prisma.movement.createMany({
    data: [
      { id: "seed-mov-1", material: "Armatur A500 Ø16", type: "qebul", qty: 20, unit: "ton", project: "Port Baku Residence", date: "2026-09-18", by: "Kamran Əliyev", materialId: "seed-mat-arm", locationId: "seed-loc-merkez" },
      { id: "seed-mov-2", material: "Armatur A500 Ø16", type: "cixis", qty: 8, unit: "ton", project: "Port Baku Residence", date: "2026-09-22", by: "Kamran Əliyev", materialId: "seed-mat-arm", locationId: "seed-loc-port", note: "4-cü mərtəbə" },
      { id: "seed-mov-3", material: "Fasad boyası ağ", type: "qebul", qty: 800, unit: "kq", project: "Port Baku Residence", date: "2026-10-01", by: "Kamran Əliyev", materialId: "seed-mat-boya", locationId: "seed-loc-port" },
    ],
  })
  await prisma.stockLot.createMany({
    data: [
      { id: "seed-lot-1", organizationId: "seed-org-afez", materialId: "seed-mat-arm", locationId: "seed-loc-merkez", code: "MAT-ARMATUR", batch: "A500-0918", qty: 20, unitCost: 1105, qr: "QR-AZ-ARMATUR-0918" },
      { id: "seed-lot-2", organizationId: "seed-org-afez", materialId: "seed-mat-arm", locationId: "seed-loc-merkez", code: "MAT-ARMATUR", batch: "A500-1002", qty: 12, unitCost: 1140, qr: "QR-AZ-ARMATUR-1002" },
      { id: "seed-lot-3", organizationId: "seed-org-afez", materialId: "seed-mat-boya", locationId: "seed-loc-port", code: "MAT-BOYA", batch: "AG-440", qty: 2400, unitCost: 4.2, expiresOn: day("2027-06-01"), qr: "QR-AZ-BOYA-440" },
    ],
  })
  await prisma.supplier.createMany({
    data: [
      { id: "seed-sup-metal", name: "Kür Armatur və İnert", category: "Armatur", city: "Yevlax", rating: "4.6", terms: "30 gün", contact: "+994 50 600 11 22" },
      { id: "seed-sup-boya", name: "Azər Boya İstehsalat", category: "Boya", city: "Sumqayıt", rating: "4.4", terms: "avans 20%", contact: "+994 50 600 33 44" },
      { id: "seed-sup-alum", name: "Xəzər Alüminium Sistemləri", category: "Qapı-pəncərə", city: "Bakı", rating: "4.8", terms: "14 gün", contact: "+994 50 600 55 66" },
    ],
  })
  await prisma.purchaseOrder.createMany({
    data: [
      { id: "seed-po-1", supplier: "Kür Armatur və İnert", item: "Armatur A500 Ø16", qty: 20, unit: "ton", amount: 22400, status: "qebul", eta: "2026-09-18", materialId: "seed-mat-arm", receivedQty: 20 },
      { id: "seed-po-2", supplier: "Azər Boya İstehsalat", item: "Fasad boyası ağ", qty: 800, unit: "kq", amount: 3840, status: "yolda", eta: "2026-10-18", materialId: "seed-mat-boya", receivedQty: 0 },
    ],
  })
  await prisma.payable.createMany({
    data: [
      { id: "seed-pay-1", supplier: "Kür Armatur və İnert", poId: "seed-po-1", amount: 22400, status: "aciq", date: "2026-09-18" },
      { id: "seed-pay-2", supplier: "Azər Boya İstehsalat", poId: "seed-po-2", amount: 3840, status: "gozleyir", date: "2026-10-08" },
    ],
  })

  const products = [
    ["seed-prd-profil", "seed-org-alum", "Alüminium profil 60 mm", "PRF-60", "Alüminium sistemləri", "m", 12.4, 8.1, "2027-03-01", 50, 10],
    ["seed-prd-furn", "seed-org-alum", "Dönər furnitur dəsti", "FRN-D", "Qapı və pəncərələr", "dest", 46, 28, "2027-03-01", 10, 7],
    ["seed-prd-glass", "seed-org-glass", "Şüşə paket 24 mm", "GL-24", "Şüşə", "m2", 92, 61, "2027-02-01", 20, 5],
    ["seed-prd-glass-old", "seed-org-glass", "Köhnə 6 mm şüşə", "GL-6-OLD", "Şüşə", "m2", 28, 16, "2025-12-01", 10, 4],
    ["seed-prd-pvc", "seed-org-pvc", "PVC profil 70 mm", "PVC-70", "Qapı və pəncərələr", "m", 7.8, 4.9, "2027-04-01", 100, 12],
    ["seed-prd-panel", "seed-org-fasad", "Kompozit fasad paneli", "FAS-4", "Fasad sistemləri", "m2", 64, 41, "2027-01-15", 30, 14],
    ["seed-prd-boya", "seed-org-boya", "Fasad boyası ağ", "BOY-AG", "Boya və kimyəvi materiallar", "kq", 4.8, 2.7, "2027-06-01", 200, 3],
    ["seed-prd-astar", "seed-org-boya", "Beton astarı", "AST-1", "Boya və kimyəvi materiallar", "kq", 3.2, 1.8, "2027-06-01", 100, 3],
    ["seed-prd-arm", "seed-org-metal", "Armatur A500 Ø16", "ARM-16", "Armatur", "ton", 1140, 980, "2026-12-31", 5, 6],
    ["seed-prd-sem", "seed-org-metal", "Sement CEM II 42.5", "SEM-425", "Sement", "ton", 172, 141, "2026-11-30", 10, 2],
    ["seed-prd-beton", "seed-org-metal", "B30 beton", "BET-B30", "Beton", "m3", 148, 112, "2026-12-15", 8, 1],
  ]
  for (const [id, organizationId, name, code, category, unit, price, cost, validUntil, minQty, leadDays] of products) {
    await prisma.catalogProduct.create({
      data: {
        id,
        organizationId,
        name,
        code,
        category,
        unit,
        price,
        cost,
        validUntil: day(validUntil),
        minQty,
        leadDays,
        params: category,
        colors: unit === "kq" ? "ağ" : "",
        sizes: code,
      },
    })
  }
  await prisma.priceBreak.createMany({
    data: [
      { id: "seed-brk-1", productId: "seed-prd-arm", minQty: 20, price: 1105, spec: "A500", delivery: "Bakı" },
      { id: "seed-brk-2", productId: "seed-prd-arm", minQty: 50, price: 1070, spec: "A500", delivery: "Bakı" },
      { id: "seed-brk-3", productId: "seed-prd-profil", minQty: 200, price: 11.6, size: "60", delivery: "obyekt" },
      { id: "seed-brk-4", productId: "seed-prd-boya", minQty: 1000, price: 4.35, delivery: "Bakı" },
    ],
  })
  await prisma.priceChange.createMany({
    data: [
      { id: "seed-pch-1", productId: "seed-prd-arm", fromPrice: 1090, toPrice: 1140, byName: "Elşən Qarayev" },
      { id: "seed-pch-2", productId: "seed-prd-boya", fromPrice: 4.4, toPrice: 4.8, byName: "Sevinc Hüseynova" },
    ],
  })
  await prisma.tradeRule.create({
    data: {
      id: "seed-rule-alum",
      organizationId: "seed-org-alum",
      trade: "qapi",
      system: "Xəzər 60",
      confirmed: true,
      kgPerM: 1.35,
      wastePercent: 6,
      glassDeductMm: 36,
      glassWastePercent: 8,
    },
  })
  await prisma.tradeRule.create({
    data: {
      id: "seed-rule-fasad",
      organizationId: "seed-org-fasad",
      trade: "fasad",
      system: "Kompozit 4 mm",
      confirmed: true,
      panelKgPerM2: 5.6,
      wastePercent: 7,
    },
  })
  await prisma.tradeRule.create({
    data: {
      id: "seed-rule-dam",
      organizationId: "seed-org-fasad",
      trade: "dam",
      system: "Sendviç örtük",
      confirmed: false,
      coverPerM2: 1.08,
      overlapMm: 150,
    },
  })

  await prisma.projectFile.create({
    data: {
      id: "seed-file-boq",
      organizationId: "seed-org-afez",
      projectId: "seed-prj-port",
      name: "port-baku-hecimler.csv",
      ext: "csv",
      size: 240,
      scan: "temiz",
      rows: {
        create: [
          { id: "seed-row-1", sort: 1, name: "Fasad işi", qty: "500", spec: "kompozit", flags: [], confirmed: true },
          { id: "seed-row-2", sort: 2, name: "Beton", qty: "120", spec: "B30", flags: [], confirmed: true },
          { id: "seed-row-3", sort: 3, name: "Boru xətti", qty: "2000", spec: "ölçü təsdiq gözləyir", flags: ["qeyri-deqiq"], confirmed: false },
        ],
      },
    },
  })
  await prisma.projectFile.create({
    data: {
      id: "seed-file-dwg",
      organizationId: "seed-org-arch",
      projectId: "seed-prj-port",
      name: "fasad-cizgi.dwg",
      ext: "dwg",
      size: 1800000,
      scan: "temiz",
      scanNote: "Çertyoj qəbul olundu, oxunuş təsdiq gözləyir",
      rows: {
        create: [{ id: "seed-row-dwg", sort: 1, name: "fasad-cizgi.dwg", flags: ["oxunmadi"], confirmed: false }],
      },
    },
  })

  await prisma.calcJob.create({
    data: {
      id: "seed-job-win",
      organizationId: "seed-org-alum",
      projectId: "seed-prj-port",
      ruleId: "seed-rule-alum",
      trade: "qapi",
      title: "Port Baku yaşayış pəncərəsi 1400x1500",
      widthMm: 1400,
      heightMm: 1500,
      count: 12,
      sections: 2,
      opening: "doner",
      color: "RAL 7016",
      profileNote: "Xəzər 60",
      glassKind: "paket",
      glassThickness: "24",
      hardware: "dönər",
      installKind: "montaj",
      address: "Yasamal, Zərdabi",
      profileUnit: "m",
      profileRate: 12.4,
      glassRate: 92,
      hardwareRate: 46,
      laborRate: 18,
      installRate: 22,
      packRate: 4,
      transport: 180,
      extra: 0,
      vatPercent: 18,
      profitPercent: 10,
      profitMode: "faiz",
      glassConfirmed: true,
      lengthM: 87.6,
      weightKg: 118.26,
      wasteM: 5.256,
      glassArea: 25.2,
      cutArea: 22.4,
      cost: 4120,
      profitAmount: 412,
      vatAmount: 815.76,
      sale: 4532,
      gross: 5347.76,
      blocked: [],
      lines: {
        create: [
          { id: "seed-cost-1", sort: 1, name: "Alüminium profil", unit: "m", qty: 92.856, rate: 12.4, amount: 1151.41 },
          { id: "seed-cost-2", sort: 2, name: "Şüşə", unit: "m2", qty: 24.192, rate: 92, amount: 2225.66 },
          { id: "seed-cost-3", sort: 3, name: "Furnitur", unit: "dest", qty: 12, rate: 46, amount: 552 },
          { id: "seed-cost-4", sort: 4, name: "İstehsal və montaj", unit: "eded", qty: 12, rate: 40, amount: 480 },
          { id: "seed-cost-5", sort: 5, name: "Daşınma", unit: "sifaris", qty: 1, rate: 180, amount: 180 },
        ],
      },
      schedule: {
        create: {
          id: "seed-jsch-win",
          produceDays: 12,
          haulDays: 2,
          installDays: 5,
          weatherDays: 1,
          totalDays: 20,
          startOn: day("2026-10-20"),
          endOn: day("2026-11-09"),
        },
      },
    },
  })
  await prisma.haulQuote.create({
    data: {
      id: "seed-haul-1",
      organizationId: "seed-org-log",
      fromPlace: "Binəqədi istehsal",
      toPlace: "Yasamal, Zərdabi",
      km: 18,
      weightKg: 1400,
      volumeM3: 6,
      glassWidthMm: 1364,
      glassHeightMm: 1464,
      vehicle: "suse",
      capacityKg: 3500,
      maxGlassMm: 3200,
      roundTrip: true,
      loadCost: 40,
      waitCost: 20,
      tariffPerKm: 1.8,
      speedKmDay: 40,
      days: 1,
      fit: "uygun",
      cost: 124.8,
    },
  })
  await prisma.orderFlow.create({
    data: {
      id: "seed-flow-1",
      organizationId: "seed-org-afez",
      projectId: "seed-prj-port",
      jobId: "seed-job-win",
      supplierId: "seed-org-alum",
      carrierId: "seed-org-log",
      installerId: "seed-org-montaj",
      title: "Port Baku pəncərə sifarişi",
      stage: "istehsal",
      events: {
        create: [
          { id: "seed-ev-1", stage: "yeni", person: "Səbinə Əhmədova", date: day("2026-10-01"), note: "Layihə açıldı" },
          { id: "seed-ev-2", stage: "hesab", person: "Nigar Əliyeva", date: day("2026-10-03"), note: "Hesab təsdiqləndi" },
          { id: "seed-ev-3", stage: "tesdiq", person: "Elvin Məmmədov", date: day("2026-10-06"), note: "Sifariş təsdiqi" },
          { id: "seed-ev-4", stage: "istehsal", person: "Kamal İbrahimov", date: day("2026-10-08"), note: "İstehsala verildi" },
        ],
      },
    },
  })

  await prisma.tenderCase.create({
    data: {
      id: "seed-tender-school",
      organizationId: "seed-org-afez",
      projectId: "seed-prj-school",
      number: "SAT-2026-1142",
      buyer: "Abşeron Rayon Təhsil Şöbəsi",
      subject: "Xırdalan məktəb kompleksinin tikintisi",
      price: 4200000,
      deadline: day("2026-10-15T18:00:00"),
      task: "Texniki tapşırıq qovluqdadır",
      contractDraft: "Müqavilə layihəsi yüklənib",
      qualification: "Oxşar iş 3 il",
      similar: "Abşeron Villa Qrupu",
      bondDays: 90,
      performDays: 360,
      checks: {
        create: [
          ["Şirkət qeydiyyat sənədləri", "uygun"],
          ["VÖEN", "uygun"],
          ["İcazələr", "el"],
          ["Maliyyə hesabatları", "catismir"],
          ["Oxşar müqavilələr", "uygun"],
          ["Smeta və qiymət təklifi", "gozleyir"],
          ["İş qrafiki", "el"],
        ].map(([name, fit], index) => ({ id: `seed-tcheck-${index}`, name, fit })),
      },
      approvals: {
        create: [
          { id: "seed-tapp-1", role: "smeta", status: "tesdiq" },
          { id: "seed-tapp-2", role: "layihe", status: "gozleyir" },
          { id: "seed-tapp-3", role: "direktor", status: "gozleyir" },
        ],
      },
    },
  })
  await prisma.tenderCase.create({
    data: {
      id: "seed-tender-gence",
      organizationId: "seed-org-afez",
      projectId: "seed-prj-gence",
      number: "SAT-2026-0988",
      buyer: "Gəncə Səhiyyə Fondu",
      subject: "Şəhər klinikasının tikinti-quraşdırma işləri",
      price: 9600000,
      deadline: day("2026-10-22T18:00:00"),
      bondDays: 120,
      performDays: 480,
      checks: { create: [{ id: "seed-tcheck-g", name: "Texnika sənədləri", fit: "catismir" }] },
    },
  })
  await prisma.notice.createMany({
    data: [
      { id: "seed-nt-1", organizationId: "seed-org-afez", kind: "tender", text: "Xırdalan məktəbinin bitməsinə 3 gün qalıb", dueOn: day("2026-10-15") },
      { id: "seed-nt-2", organizationId: "seed-org-afez", kind: "sened", text: "Maliyyə hesabatı çatışmır", dueOn: day("2026-10-15") },
      { id: "seed-nt-3", organizationId: "seed-org-afez", kind: "teminat", text: "İştirak təminatı paketi hazırdır, bank qərarı gözlənilir", dueOn: day("2026-10-14") },
      { id: "seed-nt-4", organizationId: "seed-org-alum", kind: "abune", text: "Başlanğıc paketinin sonuna 10 ay qalıb", dueOn: day("2027-08-01"), read: true },
    ],
  })

  await prisma.boqBook.create({
    data: {
      id: "seed-boq-school",
      organizationId: "seed-org-afez",
      projectId: "seed-prj-school",
      profit: 10,
      profitMode: "faiz",
      vat: 18,
      management: "Nigar Əliyeva",
      sheets: { create: [{ id: "seed-sheet-1", sort: 1, name: "Əsas həcmlər" }] },
      lines: {
        create: [
          { id: "seed-bl-1", sheet: "Əsas həcmlər", sort: 1, name: "Fasad işi", unit: "m2", qty: 500, material: 64, labor: 18 },
          { id: "seed-bl-2", sheet: "Əsas həcmlər", sort: 2, name: "Beton B30", unit: "m3", qty: 120, material: 148, labor: 22 },
          { id: "seed-bl-3", sheet: "Əsas həcmlər", sort: 3, name: "Boru xətti", unit: "m", qty: 2000, material: 9.5, labor: 3.2 },
          { id: "seed-bl-4", sheet: "Əsas həcmlər", sort: 4, name: "Fasad boyası", unit: "kq", qty: 1800, material: 4.8, labor: 0.6 },
        ],
      },
      costs: {
        create: [
          { id: "seed-bc-1", kind: "indirect", sort: 1, name: "Sahənin təşkili", amount: 12000 },
          { id: "seed-bc-2", kind: "overhead", sort: 2, name: "İnzibati xərc", amount: 8000 },
          { id: "seed-bc-3", kind: "extra", sort: 3, name: "Risk ehtiyatı", amount: 5000 },
        ],
      },
      duties: { create: [{ id: "seed-bd-1", work: "Fasad", party: "Fasad Konstruksiya" }] },
      staff: {
        create: [
          { id: "seed-bs-1", role: "Fasad ustası", count: 6 },
          { id: "seed-bs-2", role: "Betonçu", count: 4 },
        ],
      },
      gear: { create: [{ id: "seed-bg-1", name: "Qaldırıcı platforma", count: 1, insurance: 900 }] },
    },
  })

  await prisma.workSchedule.create({
    data: {
      id: "seed-sch-port",
      organizationId: "seed-org-afez",
      projectId: "seed-prj-port",
      bondDay: 2,
      tasks: {
        create: [
          { id: "seed-task-1", sort: 1, name: "Hazırlıq", startDay: 1, endDay: 5, actualEnd: 5 },
          { id: "seed-task-2", sort: 2, name: "Fasad alt konstruksiya", startDay: 6, endDay: 20, actualEnd: 23, dependsOn: "seed-task-1" },
          { id: "seed-task-3", sort: 3, name: "Pəncərə montajı", startDay: 18, endDay: 30, dependsOn: "seed-task-2" },
          { id: "seed-task-4", sort: 4, name: "Boya", startDay: 28, endDay: 36, dependsOn: "seed-task-3" },
        ],
      },
    },
  })
  await prisma.cashPlan.create({
    data: {
      id: "seed-cash-port",
      organizationId: "seed-org-afez",
      projectId: "seed-prj-port",
      inflow: 1014800,
      advance: 3675000,
      equity: 800000,
      loan: 0,
      days30: 420000,
      days60: 760000,
      days90: 1100000,
    },
  })
  await prisma.cashPlan.create({
    data: {
      id: "seed-cash-biz",
      organizationId: "seed-org-afez",
      projectId: "seed-prj-biz",
      inflow: 0,
      advance: 1800000,
      equity: 400000,
      loan: 250000,
      days30: 190000,
      days60: 340000,
      days90: 510000,
    },
  })

  await prisma.priceInquiry.create({
    data: {
      id: "seed-rfq-arm",
      organizationId: "seed-org-afez",
      supplierId: "seed-org-metal",
      title: "300 ton armatur A500",
      status: "cavablandi",
      lines: { create: [{ id: "seed-rfq-arm-1", name: "Armatur A500 Ø16", unit: "ton", qty: 300, spec: "A500" }] },
      bids: {
        create: [
          { id: "seed-bid-1", organizationId: "seed-org-metal", unitPrice: 1095, qty: 300, leadDays: 6, delivery: 1800, payment: "30 gün", validUntil: day("2026-11-15"), quality: "uyğunluq sertifikatı", status: "secildi", score: 78 },
          { id: "seed-bid-2", organizationId: "seed-org-metal", unitPrice: 1040, qty: 120, leadDays: 28, delivery: 0, payment: "100% avans", validUntil: day("2026-10-30"), quality: "", status: "verildi", score: 41 },
        ],
      },
    },
  })
  await prisma.priceInquiry.create({
    data: {
      id: "seed-rfq-boya",
      organizationId: "seed-org-afez",
      supplierId: "seed-org-boya",
      title: "Fasad boyası 1.8 ton",
      status: "aciq",
      lines: { create: [{ id: "seed-rfq-boya-1", name: "Fasad boyası ağ", unit: "kq", qty: 1800, spec: "xarici" }] },
    },
  })

  const professions = [
    ["Fəhlə", 35, 900, 8],
    ["Betonçu", 45, 1100, 12],
    ["Armaturçu", 48, 1200, 14],
    ["Fasad ustası", 55, 1400, 16],
    ["Qaynaqçı", 50, 1300, 15],
    ["Elektrik", 46, 1250, 13],
    ["Santexnik", 44, 1180, 13],
    ["Dam örtüyü ustası", 52, 1350, 15],
    ["Mexanizator", 40, 1000, 0],
    ["Mühəndis", 0, 1800, 0],
    ["Sahə rəisi", 0, 2000, 0],
  ]
  for (const [profession, daily, monthly, perUnit] of professions) {
    await prisma.laborTariff.create({
      data: {
        id: `seed-labor-${profession}`,
        organizationId: "seed-org-afez",
        profession,
        region: "Bakı və Abşeron",
        daily: daily || null,
        monthly,
        perUnit: perUnit || null,
        unit: perUnit ? "m2" : "ay",
        updatedOn: day("2026-10-01"),
      },
    })
  }
  const machines = [
    ["Ekskavator", "saat", 85, 18],
    ["Avtokran", "novbe", 420, 40],
    ["Beton nasosu", "gun", 650, 0],
    ["Yük maşını", "gun", 160, 35],
    ["Qaldırıcı platforma", "gun", 180, 12],
    ["Generator", "saat", 22, 6],
  ]
  for (const [category, rateUnit, rate, fuel] of machines) {
    await prisma.machineTariff.create({
      data: {
        id: `seed-mach-${category}`,
        organizationId: "seed-org-montaj",
        category,
        region: "Bakı və Abşeron",
        rateUnit,
        rate,
        fuel: fuel || null,
        operator: true,
        minDays: 1,
        updatedOn: day("2026-10-01"),
      },
    })
    await prisma.rentalOffer.create({
      data: {
        id: `seed-rent-${category}`,
        organizationId: "seed-org-montaj",
        category,
        brand: "Sahə",
        model: category,
        year: 2021,
        place: "Bakı",
        rateUnit,
        rate,
        operator: true,
        fuelNote: fuel ? "Yanacaq ayrıca" : "Daxildir",
        delivery: 80,
      },
    })
  }

  await prisma.office.create({ data: { id: "seed-off-1", name: "Baş ofis", city: "Bakı", address: "Yasamal, Zərdabi 12" } })
  await prisma.department.createMany({
    data: [
      { id: "seed-dep-1", name: "İdarəetmə", code: "IDR", leadId: "seed-per-elvin", site: "Baş ofis" },
      { id: "seed-dep-2", name: "Sahə", code: "SAH", leadId: "seed-per-rauf", site: "Port Baku" },
      { id: "seed-dep-3", name: "Anbar", code: "ANB", leadId: "seed-per-kamran", site: "Mərkəzi anbar" },
    ],
  })
  const people = [
    ["seed-per-elvin", "Elvin Məmmədov", "Əməliyyat direktoru", "İdarəetmə", "Baş ofis", "ofis", "ofisde", "seed-dep-1", 4500],
    ["seed-per-nigar", "Nigar Əliyeva", "Layihə rəhbəri", "İdarəetmə", "Port Baku", "sahe", "sahede", "seed-dep-1", 2800],
    ["seed-per-rauf", "Rauf Hüseynov", "Sahə mühəndisi", "Sahə", "Xəzər Business Center", "sahe", "sahede", "seed-dep-2", 1900],
    ["seed-per-kamran", "Kamran Əliyev", "Anbar müdiri", "Anbar", "Mərkəzi anbar", "anbar", "anbarda", "seed-dep-3", 1400],
    ["seed-per-gunel", "Günel Rzayeva", "Mühasib", "İdarəetmə", "Baş ofis", "ofis", "ofisde", "seed-dep-1", 1600],
    ["seed-per-usta", "Elşən Qarayev", "Fasad ustası", "Sahə", "Port Baku", "sahe", "sahede", "seed-dep-2", 1200],
  ]
  for (const [id, name, role, crew, site, placeKind, status, departmentId, salary] of people) {
    await prisma.person.create({
      data: {
        id,
        name,
        role,
        crew,
        site,
        placeKind,
        status,
        phone: "+994 50 200 00 00",
        email: `${id}@afez.az`,
        departmentId,
        pin: id.slice(-4),
        hired: "2024-03-01",
        salary,
        card: id.toUpperCase(),
      },
    })
  }
  await prisma.crew.create({ data: { id: "seed-crew-1", name: "Fasad briqadası", site: "Port Baku Residence", size: 12, lead: "Elşən Qarayev", present: 11 } })
  await prisma.attendance.createMany({
    data: [
      { id: "seed-att-1", personId: "seed-per-usta", date: "2026-10-10", inAt: "08:05", outAt: "17:40", mark: "geldi", terminalId: "", hours: 9 },
      { id: "seed-att-2", personId: "seed-per-rauf", date: "2026-10-10", inAt: "07:50", outAt: "18:10", mark: "geldi", terminalId: "", hours: 9.5, note: "yağış fasiləsi" },
    ],
  })
  await prisma.payroll.create({
    data: {
      id: "seed-payr-09",
      date: "2026-09-30",
      total: 13400,
      status: "tesdiq",
      lines: {
        create: people.map((person, sort) => ({
          id: `seed-pl-${sort}`,
          sort,
          personId: person[0],
          name: person[1],
          hours: 168,
          amount: person[8],
        })),
      },
    },
  })

  const talentSeed = [
    {
      id: "seed-tal-1",
      organizationId: "seed-org-afez",
      name: "Məhəmməd Əlizadə",
      profession: "Mühəndis",
      education: "Memarlıq və İnşaat Universiteti",
      skills: "fasad, dəmir-beton, smeta",
      regions: "Bakı və Abşeron",
      startOn: day("2026-11-01"),
      phone: "+994 50 777 10 10",
      email: "mehemmed@example.az",
      state: "elcatan",
      expectPay: 2000,
      shareConsent: true,
      proofs: {
        create: [
          { id: "seed-proof-1", source: "isegoturen", title: "Xəzər Holdinq arayışı", years: 5, confirmed: true },
          { id: "seed-proof-2", source: "diplom", title: "İnşaat mühəndisi", years: 0, confirmed: true },
          { id: "seed-proof-1b", source: "sertifikat", title: "Fasad sistemləri", years: 0, confirmed: true, note: "2027-12-31" },
        ],
      },
    },
    {
      id: "seed-tal-2",
      name: "Gizli usta",
      profession: "Qaynaqçı",
      regions: "Gəncə-Qazax",
      state: "axtarir",
      shareConsent: false,
      proofs: { create: [{ id: "seed-proof-3", source: "el", title: "Öz bəyanı", years: 8, confirmed: false }] },
    },
    {
      id: "seed-tal-3",
      organizationId: "seed-org-afez",
      name: "Rəşad Hüseynov",
      profession: "Qaynaqçı",
      education: "Peşə liseyi",
      skills: "MIG, TIG, polad",
      regions: "Sumqayıt, Bakı",
      startOn: day("2026-11-15"),
      phone: "+994 55 410 22 18",
      email: "resad@example.az",
      state: "axtarir",
      expectPay: 1800,
      shareConsent: true,
      proofs: {
        create: [
          { id: "seed-proof-4", source: "muqavile", title: "Kür Metal müqaviləsi", years: 6, confirmed: true },
          { id: "seed-proof-5", source: "sertifikat", title: "ISO 9606-1", years: 0, confirmed: true, note: "2028-03-01" },
        ],
      },
    },
    {
      id: "seed-tal-4",
      organizationId: "seed-org-afez",
      name: "Nigar Məmmədova",
      profession: "Smeta mühəndisi",
      education: "Azərbaycan İnşaat Universiteti",
      skills: "forma 2, tender",
      regions: "Bakı",
      startOn: day("2026-10-25"),
      phone: "+994 50 612 44 09",
      email: "nigar.m@example.az",
      state: "elcatan",
      expectPay: 2200,
      shareConsent: true,
      proofs: {
        create: [
          { id: "seed-proof-6", source: "isegoturen", title: "Layihə bürosu arayışı", years: 7, confirmed: true },
          { id: "seed-proof-7", source: "diplom", title: "İnşaat iqtisadiyyatı", years: 0, confirmed: true },
        ],
      },
    },
    {
      id: "seed-tal-5",
      organizationId: "seed-org-afez",
      name: "Elnur Qasımov",
      profession: "Fasad ustası",
      education: "Peşə təhsili",
      skills: "ventilyasiya fasadı, hündürlük",
      regions: "Bakı və Abşeron",
      startOn: day("2026-12-01"),
      phone: "+994 70 233 18 40",
      state: "layihede",
      expectPay: 1600,
      shareConsent: true,
      proofs: {
        create: [
          { id: "seed-proof-8", source: "isegoturen", title: "Port Baku briqadası", years: 9, confirmed: true },
          { id: "seed-proof-9", source: "sertifikat", title: "Hündürlük işi", years: 0, confirmed: true, note: "2027-08-15" },
        ],
      },
    },
    {
      id: "seed-tal-6",
      organizationId: "seed-org-afez",
      name: "Aysel Kərimova",
      profession: "Elektrik",
      education: "Texniki kollec",
      skills: "daxili şəbəkə, paylayıcı",
      regions: "Abşeron, Bakı",
      startOn: day("2026-11-01"),
      phone: "+994 51 880 12 77",
      state: "axtarir",
      expectPay: 1400,
      shareConsent: true,
      proofs: {
        create: [
          { id: "seed-proof-10", source: "arayis", title: "Əmək kitabçası", years: 4, confirmed: true },
          { id: "seed-proof-11", source: "sertifikat", title: "Elektrik təhlükəsizliyi qrupu 3", years: 0, confirmed: true, note: "2027-01-20" },
        ],
      },
    },
    {
      id: "seed-tal-7",
      organizationId: "seed-org-afez",
      name: "Tural Əliyev",
      profession: "Betonçu",
      skills: "B30, monolit",
      regions: "Xırdalan, Bakı",
      startOn: day("2026-10-20"),
      phone: "+994 55 190 33 21",
      state: "elcatan",
      expectPay: 1300,
      shareConsent: false,
      proofs: { create: [{ id: "seed-proof-12", source: "muqavile", title: "Xəzər Business Center", years: 5, confirmed: true }] },
    },
    {
      id: "seed-tal-8",
      organizationId: "seed-org-afez",
      name: "Kamran İsmayılov",
      profession: "Kran operatoru",
      education: "Operator kursu",
      skills: "avtokran, qüllə kran",
      regions: "Ələt, Bakı",
      startOn: day("2026-11-10"),
      phone: "+994 50 300 14 62",
      state: "elcatan",
      expectPay: 1900,
      shareConsent: true,
      proofs: {
        create: [
          { id: "seed-proof-13", source: "isegoturen", title: "Texnika parkı arayışı", years: 11, confirmed: true },
          { id: "seed-proof-14", source: "sertifikat", title: "Operator şəhadətnaməsi", years: 0, confirmed: true, note: "2027-06-01" },
        ],
      },
    },
    {
      id: "seed-tal-9",
      organizationId: "seed-org-afez",
      name: "Leyla Həsənova",
      profession: "Anbardar",
      education: "Logistika kursu",
      skills: "qəbul, sayım",
      regions: "Bakı",
      startOn: day("2026-11-01"),
      phone: "+994 77 412 90 05",
      email: "leyla@example.az",
      state: "tesdiq",
      expectPay: 1100,
      shareConsent: true,
      proofs: { create: [{ id: "seed-proof-15", source: "isegoturen", title: "Mərkəzi anbar", years: 3, confirmed: true }] },
    },
    {
      id: "seed-tal-10",
      organizationId: "seed-org-afez",
      name: "Orxan Məlikov",
      profession: "Qaynaqçı",
      skills: "elektrod",
      regions: "Gəncə",
      phone: "+994 55 670 08 14",
      state: "axtarir",
      expectPay: 1200,
      shareConsent: false,
      proofs: { create: [{ id: "seed-proof-16", source: "el", title: "Öz bəyanı", years: 2, confirmed: false }] },
    },
    {
      id: "seed-tal-11",
      organizationId: "seed-org-afez",
      name: "Sevinc Əliyeva",
      profession: "Mühəndis",
      education: "AzMİU",
      skills: "fasad, keyfiyyət",
      regions: "Bakı və Abşeron",
      startOn: day("2026-11-05"),
      phone: "+994 50 221 67 30",
      email: "sevinc@example.az",
      state: "elcatan",
      expectPay: 2400,
      shareConsent: true,
      proofs: {
        create: [
          { id: "seed-proof-17", source: "isegoturen", title: "Fasad Konstruksiya", years: 8, confirmed: true },
          { id: "seed-proof-18", source: "sertifikat", title: "Fasad sistemləri", years: 0, confirmed: true, note: "2028-01-01" },
          { id: "seed-proof-19", source: "diplom", title: "İnşaat mühəndisi", years: 0, confirmed: true },
        ],
      },
    },
    {
      id: "seed-tal-12",
      organizationId: "seed-org-afez",
      name: "Vüsal Nəsirov",
      profession: "Elektrik",
      skills: "kabel xətti",
      regions: "Sumqayıt",
      phone: "+994 70 118 44 90",
      state: "elcatmaz",
      expectPay: 1000,
      shareConsent: false,
      proofs: { create: [{ id: "seed-proof-20", source: "arayis", title: "Qısa staj", years: 1, confirmed: true }] },
    },
  ]
  for (const row of talentSeed) await prisma.talent.create({ data: row })
  const openingSeed = [
    { id: "seed-open-1", profession: "Mühəndis", minYears: 5, region: "Bakı və Abşeron", certificate: "fasad", note: "Xırdalan məktəbi, fasad və dəmir-beton", startOn: day("2026-11-01") },
    { id: "seed-open-2", profession: "Qaynaqçı", minYears: 3, region: "Sumqayıt", certificate: "ISO 9606", note: "Polad konstruksiya sexi, növbəli iş", startOn: day("2026-11-15") },
    { id: "seed-open-3", profession: "Fasad ustası", minYears: 4, region: "Bakı", certificate: "hündürlük", note: "Port Baku Residence, fasad briqadası", startOn: day("2026-10-20") },
    { id: "seed-open-4", profession: "Elektrik", minYears: 2, region: "Abşeron", certificate: "elektrik təhlükəsizliyi", note: "Xırdalan məktəbi, daxili şəbəkə", startOn: day("2026-11-01") },
    { id: "seed-open-5", profession: "Betonçu", minYears: 3, region: "Xırdalan", certificate: "", note: "Xəzər Business Center, 4-cü mərtəbə", startOn: day("2026-10-18") },
    { id: "seed-open-6", profession: "Kran operatoru", minYears: 5, region: "Ələt", certificate: "operator", note: "Beton qovşağı, avtokran 25 t", startOn: day("2026-11-10") },
    { id: "seed-open-7", profession: "Smeta mühəndisi", minYears: 4, region: "Bakı", certificate: "", note: "Ofis, tender və forma 2", startOn: day("2026-10-25") },
    { id: "seed-open-8", profession: "Anbardar", minYears: 2, region: "Bakı", certificate: "", note: "Mərkəzi anbar, material qəbulu", startOn: day("2026-11-01") },
  ]
  await prisma.jobOpening.createMany({ data: openingSeed.map((row) => ({ ...row, organizationId: "seed-org-afez" })) })

  await prisma.driver.create({
    data: { id: "seed-drv-1", name: "Orxan Vəliyev", phone: "+994 50 222 33 44", license: "B-44120", category: "C", expires: "2028-04-01", status: "aktiv" },
  })
  await prisma.asset.createMany({
    data: [
      { id: "seed-ast-1", name: "Avtokran 25 t", type: "Avtokran", site: "Port Baku", status: "sahede", hours: 1240, nextService: "2026-09-20", utilization: 72, rate: 420, fuelPerHour: 8, plate: "10-AA-101", year: 2019, ownership: "oz", driverId: "seed-drv-1" },
      { id: "seed-ast-2", name: "Ekskavator", type: "Ekskavator", site: "Xırdalan", status: "bos", hours: 860, nextService: "2026-09-18", utilization: 40, rate: 85, fuelPerHour: 12, year: 2020, ownership: "icare" },
    ],
  })
  await prisma.plant.create({
    data: { id: "seed-plant-1", name: "Beton qovşağı", place: "Ələt", shift: "səhər", plan: 80, fact: 64, unit: "m3", kind: "zavod", locationId: "seed-loc-merkez", planStatus: "tesdiq", planBy: "Elvin Məmmədov" },
  })
  await prisma.workOrder.create({
    data: {
      id: "seed-wo-1",
      plant: "Beton qovşağı",
      product: "B30 beton",
      project: "Xəzər Business Center",
      qty: 24,
      unit: "m3",
      status: "gonderildi",
      due: "2026-10-14",
      sentBy: "Elvin Məmmədov",
      vehicle: "Mikser",
      note: "4-cü mərtəbə",
      cost: 3552,
    },
  })
  await prisma.dailyReport.create({
    data: {
      id: "seed-rep-1",
      projectId: "seed-prj-port",
      date: "2026-10-10",
      weather: "Yağış ehtimalı 40%, külək 6 m/s",
      note: "Fasad işi davam etdi",
      crew: 18,
      status: "tesdiq",
      author: "Rauf Hüseynov",
      laborCost: 2400,
      machineCost: 420,
      lines: { create: [{ id: "seed-rl-1", sort: 1, smetaLineId: "seed-smeta-port-0", qty: 85 }] },
      machines: { create: [{ id: "seed-rm-1", sort: 1, assetId: "seed-ast-1", hours: 6 }] },
      attendance: { create: [{ id: "seed-ra-1", sort: 1, personId: "seed-per-usta", hours: 9 }] },
    },
  })

  await prisma.financePartner.create({
    data: {
      id: "seed-bank-abb",
      kind: "bank",
      name: "Azərbaycan Beynəlxalq Bankı",
      note: "Pilot tərəfdaş. Qərar bankındır.",
      commission: 1.2,
      discount: 0.3,
      light: "tesdiq",
      proof: "Əməkdaşlıq məktubu 14/2026",
      proofDate: day("2026-09-01"),
      api: "bagli",
      contact: "qarant@abb.example",
      productsNote: "İştirak qarantiyası və dövriyyə",
      products: {
        create: [
          {
            id: "seed-fp-1",
            line: "qarant",
            name: "İştirak qarantiyası",
            terms: "Sənəd paketi, 5 iş günü",
            commission: 1.2,
            termDays: 90,
            confirmed: true,
            validUntil: day("2027-09-01"),
            discounts: {
              create: [{ id: "seed-disc-1", name: "Platforma üzvü endirimi", percent: 0.3, confirmed: true, startsOn: day("2026-09-01"), endsOn: day("2027-09-01"), terms: "Təsdiqli məktub" }],
            },
          },
          { id: "seed-fp-2", line: "dovriyye", name: "Dövriyyə kapitalı", terms: "Layihə pul axını əlavə olunur", commission: 0.5, rate: 14, termDays: 180, confirmed: true, validUntil: day("2027-03-01") },
        ],
      },
    },
  })
  await prisma.financePartner.create({
    data: { id: "seed-bank-wait", kind: "bank", name: "Gözləyən pilot bank", note: "Təsdiq sənədi yoxdur", light: "gozleme", api: "bagli", commission: 2 },
  })
  await prisma.financePartner.create({
    data: {
      id: "seed-ins-1",
      kind: "sigorta",
      name: "Tikinti Sığorta",
      proof: "Tarif cədvəli 7/2026",
      proofDate: day("2026-07-15"),
      light: "tesdiq",
      api: "bagli",
      products: {
        create: [{ id: "seed-fp-3", line: "sigorta", name: "Tikinti-quraşdırma riski", terms: "Sığortaçının tarifi", rate: 0.8, confirmed: true, validUntil: day("2027-07-15") }],
      },
    },
  })
  await prisma.guaranteeCase.create({
    data: {
      id: "seed-gar-1",
      organizationId: "seed-org-afez",
      kind: "istirak",
      mode: "percent",
      amount: 84000,
      rate: 2,
      partnerId: "seed-bank-abb",
      buyer: "Abşeron Rayon Təhsil Şöbəsi",
      title: "Xırdalan məktəbi iştirak qarantiyası",
      days: 90,
      packed: true,
      reviewed: true,
      light: "gozleme",
      consentAt: day("2026-10-09"),
    },
  })
  await prisma.financeApplication.create({
    data: {
      id: "seed-app-1",
      organizationId: "seed-org-afez",
      partnerId: "seed-bank-abb",
      productId: "seed-fp-2",
      kind: "kredit",
      status: "teqdim",
      amount: 250000,
      purpose: "Port Baku fasad materialı",
      payload: { project: "Port Baku Residence", days30: 420000 },
      packed: true,
      consentAt: day("2026-10-09"),
      events: {
        create: [
          { id: "seed-ape-1", status: "qaralama", person: "Günel Rzayeva", note: "Paket yığıldı" },
          { id: "seed-ape-2", status: "teqdim", person: "Elvin Məmmədov", note: "Sənəd mübadiləsi. Canlı bank bağlantısı yoxdur." },
        ],
      },
    },
  })
  await prisma.shareConsent.create({
    data: { id: "seed-cons-1", organizationId: "seed-org-afez", partnerId: "seed-bank-abb", purpose: "Dövriyyə kapitalı müraciəti", categories: "müqavilə, pul axını, smeta yekunu" },
  })
  await prisma.officialInquiry.createMany({
    data: [
      { id: "seed-offq-1", organizationId: "seed-org-afez", topic: "vergi_borcu", state: "alindi", channel: "sened", source: "Vergi arayışı", resultNote: "Arayış qovluğa əlavə olundu", document: "vergi-arayis-2026-10.pdf", asOf: day("2026-10-05") },
      { id: "seed-offq-2", organizationId: "seed-org-afez", topic: "muflis", state: "gonderilmeyib", channel: "sened", resultNote: "Rəsmi sorğu bağlanmayıb, əl ilə yoxlama lazımdır" },
      { id: "seed-offq-3", organizationId: "seed-org-afez", topic: "voen", state: "alindi", channel: "sened", source: "Qeydiyyat çıxarışı", document: "voen-cixaris.pdf", asOf: day("2026-09-12"), resultNote: "VÖEN 1700123451" },
    ],
  })

  await prisma.materialPassport.createMany({
    data: [
      { id: "seed-pass-1", organizationId: "seed-org-boya", material: "Fasad boyası ağ", section: "yanğınadavamlılıq", fit: "uygun", maker: "Azər Boya İstehsalat", standard: "AZS 148", certificate: "UY-2026-440", issuer: "AZSTAND", validUntil: day("2027-06-01"), batch: "AG-440", origin: "Azərbaycan", protocol: "Sınaq 18/2026" },
      { id: "seed-pass-2", organizationId: "seed-org-metal", material: "Armatur A500 Ø16", section: "möhkəmlik", fit: "el", maker: "Kür Armatur və İnert", standard: "A500", certificate: "ARM-0918", issuer: "laboratoriya", validUntil: day("2027-01-01"), batch: "A500-0918" },
    ],
  })
  await prisma.legalTemplate.createMany({
    data: [
      { id: "seed-tpl-1", organizationId: "seed-org-afez", name: "Material təchizatı müqaviləsi", kind: "techizat", version: "1.2", updatedOn: day("2026-09-01"), legal: "Hüquqşünas baxışı gözləyir", party: "{{teref}}", status: "Hazır şablon", body: "{{sirket}} (VÖEN {{voen}}) ilə {{teref}} arasında {{mebleg}} AZN məbləğində təchizat. Tarix: {{tarix}}." },
      { id: "seed-tpl-2", organizationId: "seed-org-afez", name: "Görülmüş işlər aktı", kind: "akt", version: "1.0", updatedOn: day("2026-08-12"), legal: "Yoxlanıb", party: "{{sifarisci}}", status: "Hazır şablon", body: "{{layihe}} üzrə görülmüş işlər aktı. Dövr: {{dovr}}." },
      ...templateCatalog.map((row) => ({
        id: row.id,
        organizationId: null,
        name: row.name,
        kind: row.kind,
        version: row.version,
        updatedOn: day(row.updatedOn),
        legal: row.legal,
        party: row.party,
        status: "Hazır şablon",
        body: row.body,
      })),
    ],
  })
  await prisma.coopRequest.create({
    data: {
      id: "seed-coop-1",
      organizationId: "seed-org-admin",
      company: "Azər Boya İstehsalat",
      note: "Boya istehsalçısı tender smetalarına kataloq qoşmaq istəyir",
      status: "Təhlil olunur",
      findings: {
        create: [{ id: "seed-find-1", topic: "Satış kanalı", finding: "Fasad boyası standart kodu MAT-BOYA ilə üst-üstə düşür, regional qiymət Bakı və Abşeron üçündür." }],
      },
    },
  })
  await prisma.approvalChain.create({
    data: {
      id: "seed-chain-1",
      organizationId: "seed-org-afez",
      kind: "smeta",
      subject: "Xırdalan məktəb smetası",
      steps: {
        create: [
          { id: "seed-step-1", sort: 1, role: "smeta", person: "Nigar Əliyeva", state: "tesdiq", at: day("2026-10-07"), note: "Həcmlər yoxlandı" },
          { id: "seed-step-2", sort: 2, role: "layihe", state: "gozleyir" },
          { id: "seed-step-3", sort: 3, role: "muhasib", state: "gozleyir" },
          { id: "seed-step-4", sort: 4, role: "direktor", state: "gozleyir" },
        ],
      },
    },
  })
  await prisma.defectAct.create({
    data: { id: "seed-def-1", organizationId: "seed-org-afez", projectId: "seed-prj-port", material: "Fasad paneli", qty: 4, reason: "Kənar əyilmə", visual: "cızıq", certificate: "FAS-4", person: "Rauf Hüseynov" },
  })
  await prisma.siteIncident.create({
    data: { id: "seed-inc-1", organizationId: "seed-org-afez", projectId: "seed-prj-port", kind: "hava", text: "Külək 13 m/s, kran dayandırıldı", on: day("2026-10-11"), person: "Rauf Hüseynov" },
  })
  await prisma.projectPhoto.create({
    data: { id: "seed-photo-1", organizationId: "seed-org-afez", projectId: "seed-prj-port", title: "7-ci mərtəbə fasad altı", takenOn: day("2026-10-08"), note: "Montajdan əvvəl" },
  })
  await prisma.weatherProof.create({
    data: { id: "seed-wproof-1", projectId: "seed-prj-port", date: day("2026-10-11"), rain: 20, wind: 13, pouring: false, stop: "Kran və fasad", officer: "Rauf Hüseynov" },
  })
  await prisma.weatherDay.create({
    data: { id: "seed-wday-14", date: day("2026-10-14"), rainPercent: 82, windMs: 7, pouring: false, source: "əl ilə proqnoz", stops: ["Hündürmərtəbəli iş, dam, fasad, açıq beton"], note: "Yağış ehtimalı 80%-dən yüksəkdir" },
  })
  await prisma.weatherDay.create({
    data: { id: "seed-wday-11", date: day("2026-10-11"), rainPercent: 20, windMs: 13, pouring: false, source: "sahə ölçümü", stops: ["Kran, fasad, hündürlükdə iş"] },
  })
  await prisma.jobWeatherHold.create({
    data: { jobId: "seed-job-win", weatherDayId: "seed-wday-14", reason: "Yağış 82%, hündürmərtəbəli fasad dayanır" },
  })

  await prisma.lead.createMany({
    data: [
      { id: "seed-lead-1", name: "Lalə Məmmədova", company: "Xəzər Holdinq", value: 3200000, owner: "Aysel Həsənova", heat: "isti", source: "tövsiyə", next: "2026-10-20" },
      { id: "seed-lead-2", name: "Nicat Əhmədov", company: "Caspian Estates", value: 900000, owner: "Aysel Həsənova", heat: "orta", source: "sayt", next: "2026-10-18" },
    ],
  })
  await prisma.deal.create({
    data: { id: "seed-deal-1", title: "Port Baku 2-ci mərhələ", client: "Xəzər Holdinq", value: 3200000, stage: "teklif", owner: "Aysel Həsənova", close: "2026-11-30", projectId: "seed-prj-port" },
  })
  await prisma.document.createMany({
    data: [
      { id: "seed-doc-1", projectId: "seed-prj-port", title: "Fəaliyyət şəhadətnaməsi", kind: "icaze", status: "var", date: "2026-01-15" },
      { id: "seed-doc-2", projectId: "seed-prj-school", title: "Oxşar iş müqaviləsi", kind: "muqavile", status: "var", date: "2025-11-02" },
    ],
  })
  await prisma.journalEntry.createMany({
    data: [
      { id: "seed-j-1", time: "2026-10-10 09:00", site: "Port Baku", text: "Fasad briqadası 11 nəfər işdədir" },
      { id: "seed-j-2", time: "2026-10-11 11:20", site: "Port Baku", text: "Külək səbəbindən kran dayandı" },
    ],
  })
  await prisma.auditEntry.createMany({
    data: [
      { id: "seed-aud-1", at: "2026-10-08T09:00:00.000Z", actor: "Elvin Məmmədov", role: "direktor", action: "kabinet", detail: "seed-org-afez toxum məlumatı yükləndi" },
      { id: "seed-aud-2", at: "2026-10-09T12:00:00.000Z", actor: "Günel Rzayeva", role: "muhasib", action: "muraciet", detail: "seed-org-afez dövriyyə paketi sənəd mübadiləsinə hazırlandı" },
    ],
  })
  await prisma.dispute.create({
    data: { id: "seed-disp-1", organizationId: "seed-org-afez", text: "Köhnə 6 mm şüşə qiyməti vaxtı keçib, müqayisəyə düşməməlidir", status: "aciq" },
  })

  await bulk(prisma, day)
  const door = await prisma.organization.findUnique({ where: { code: "NOKHTE-QAPI" } })
  if (door) {
    await prisma.materialPassport.createMany({
      data: [
        ["nokhte-pass-1", "Alüminium profil 60 mm", "05120 Konstruktiv polad", "uygun", "Xəzər Alüminium Sistemləri", "EN 573", "PRF-60-11", "AZSTAND", "2027-03-01", "PRF-60-11", "Azərbaycan", "Sınaq 11/2026"],
        ["nokhte-pass-2", "Şüşə paket 24 mm", "Sınaq və sertifikat", "uygun", "Abşeron Şüşə", "EN 1279", "GL-24-04", "AZSTAND", "2027-02-01", "GL-24-04", "Azərbaycan", "Sınaq 04/2026"],
        ["nokhte-pass-3", "PVC profil 70 mm", "01600 Məhsul tələbləri", "uygun", "Qafqaz PVC Profil", "EN 12608", "PVC-70-2", "laboratoriya", "2027-04-01", "PVC-70-2", "Azərbaycan", "Sınaq 70/2026"],
        ["nokhte-pass-4", "Dönər furnitur dəsti", "01600 Məhsul tələbləri", "catismir", "Xəzər Alüminium Sistemləri", "EN 13126", "", "", "", "FRN-D-03", "Azərbaycan", ""],
      ].map(([id, material, section, fit, maker, standard, certificate, issuer, validUntil, batch, origin, protocol]) => ({
        id, organizationId: door.id, material, section, fit, maker, standard, certificate, issuer, validUntil: validUntil ? day(validUntil) : null, batch, origin, protocol,
      })),
      skipDuplicates: true,
    })
  }
  await seedCalcHistory(prisma)
  await seedHaulHistory(prisma)

  const [organizations, projectCount, productCount, peopleCount, tenders] = await Promise.all([
    prisma.organization.count({ where: { id: { startsWith: "seed-" } } }),
    prisma.project.count({ where: { id: { startsWith: "seed-" } } }),
    prisma.catalogProduct.count({ where: { id: { startsWith: "seed-" } } }),
    prisma.person.count({ where: { id: { startsWith: "seed-" } } }),
    prisma.tenderCase.count({ where: { id: { startsWith: "seed-" } } }),
  ])
  console.log(JSON.stringify({ organizations, projects: projectCount, products: productCount, people: peopleCount, tenders }))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
