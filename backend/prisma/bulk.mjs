/** Extra demo rows so the cabinet screens are full after the base seed. */
export async function bulk(prisma, day) {
  const clients = [
    ["seed-x-cli-metro", "Bakı Metropoliteni", "Nəqliyyat", "Rauf İsmayılov", "+994 12 490 10 10", "satinalma@metro.az", "Bakı", "2023"],
    ["seed-x-cli-socar", "SOCAR Downstream", "Enerji", "Günel Məlikova", "+994 12 521 40 40", "layihe@socar-ds.az", "Bakı", "2022"],
    ["seed-x-cli-agseher", "Ağ Şəhər İdarəsi", "Şəhərsalma", "Tural Həsənli", "+994 12 310 22 22", "info@agseher.az", "Bakı", "2024"],
    ["seed-x-cli-sheki", "Şəki Bələdiyyəsi", "Bələdiyyə", "Aygün Əliyeva", "+994 24 244 11 11", "ihale@sheki.az", "Şəki", "2025"],
    ["seed-x-cli-lenkeran", "Lənkəran Su Kanalı", "Kommunal", "Elçin Vəliyev", "+994 25 255 18 18", "muqavile@lsk.az", "Lənkəran", "2024"],
    ["seed-x-cli-quba", "Quba Turizm", "Turizm", "Nərgiz Quliyeva", "+994 23 335 09 09", "ofis@quba-tur.az", "Quba", "2026"],
  ]
  for (const [id, name, sector, contact, phone, email, city, since] of clients) {
    await prisma.client.create({ data: { id, name, sector, contact, phone, email, city, since } })
  }

  const projects = [
    ["seed-x-prj-metro", "Metro Dəmiryol Körpüsü", "seed-x-cli-metro", "Bakı Metropoliteni", "Nərimanov", "Bakı", "Heydər Əliyev prospekti", "Karkas", 54, 16800000, 9100000, "2025-04-01", "2027-03-01", "Nigar Əliyeva", 74, "aktiv", "İnfrastruktur", 1, 9200],
    ["seed-x-prj-socar", "SOCAR Anbar Kompleksi", "seed-x-cli-socar", "SOCAR Downstream", "Qaradağ", "Bakı", "Sahil qəsəbəsi", "Bünövrə", 22, 22100000, 3400000, "2026-02-10", "2027-12-01", "Rauf Hüseynov", 58, "aktiv", "Sənaye", 4, 18600],
    ["seed-x-prj-ag", "Ağ Şəhər Blok C", "seed-x-cli-agseher", "Ağ Şəhər İdarəsi", "Nəsimi", "Bakı", "Ağ Şəhər bulvarı", "Fasad", 67, 13400000, 8800000, "2025-08-15", "2026-12-20", "Vüsal Məlikov", 41, "aktiv", "Yaşayış", 16, 24800],
    ["seed-x-prj-sheki", "Şəki Qonaq Evi", "seed-x-cli-sheki", "Şəki Bələdiyyəsi", "Şəki", "Şəki", "Yuxarı Baş", "Tamamlama", 88, 2600000, 2100000, "2025-05-01", "2026-11-01", "Nigar Əliyeva", 18, "tehvil", "Turizm", 2, 1800],
    ["seed-x-prj-su", "Lənkəran Su Anbarı", "seed-x-cli-lenkeran", "Lənkəran Su Kanalı", "Lənkəran", "Lənkəran", "Dənizkənarı", "Karkas", 36, 5400000, 1900000, "2026-01-12", "2027-06-30", "Rauf Hüseynov", 27, "gecikir", "Kommunal", 1, 6400],
    ["seed-x-prj-quba", "Quba Dağ Otel", "seed-x-cli-quba", "Quba Turizm", "Quba", "Quba", "Qəçrəş meşəsi", "Torpaq", 9, 7100000, 240000, "2026-09-01", "2028-04-01", "Vüsal Məlikov", 14, "plan", "Turizm", 5, 4300],
    ["seed-x-prj-school2", "Yasamal Lisey Korpusu", "seed-cli-tehsil", "Təhsil İnvest", "Yasamal", "Bakı", "Şərifzadə küçəsi", "Karkas", 44, 8900000, 3600000, "2025-10-01", "2027-05-15", "Nigar Əliyeva", 36, "aktiv", "Təhsil", 5, 11200],
    ["seed-x-prj-park", "Sumqayıt Park Anbarı", "seed-cli-sumqayit", "Sumqayıt Sənaye Parkı", "Sumqayıt", "Sumqayıt", "Sənaye zonası 2", "Fasad", 71, 4800000, 3100000, "2025-07-01", "2026-12-01", "Rauf Hüseynov", 22, "aktiv", "Sənaye", 1, 7600],
  ]
  const phaseNames = ["Torpaq", "Bünövrə", "Karkas", "Fasad", "Tamamlama", "Təhvil"]
  for (const row of projects) {
    const [id, name, clientId, clientName, district, city, address, phase, progress, budget, spent, start, end, manager, crew, status, type, floors, area] = row
    const at = phaseNames.indexOf(phase)
    await prisma.project.create({
      data: {
        id, name, clientId, clientName, district, city, address, phase, progress, budget, spent, start, end, manager, crew, status, type, floors, area,
        organizationId: "seed-org-afez",
        note: `${city} üzrə ${type.toLocaleLowerCase("az")} işi.`,
        phases: {
          create: phaseNames.map((item, sort) => ({
            id: `${id}-ph-${sort}`,
            name: item,
            sort,
            done: at > sort,
            current: item === phase,
          })),
        },
        notes: {
          create: [
            { id: `${id}-n1`, date: "2026-09-12", text: `${name}: həftəlik sahə yoxlaması aparılıb.` },
            { id: `${id}-n2`, date: "2026-10-06", text: "Material qəbulu və işçi sayı jurnalda qeyd olunub." },
          ],
        },
      },
    })
  }

  await prisma.location.createMany({
    data: [
      { id: "seed-x-loc-zavod", name: "Ələt beton qovşağı", kind: "zavod" },
      { id: "seed-x-loc-sex", name: "Xırdalan armatur sexi", kind: "sex" },
      { id: "seed-x-loc-ag", name: "Ağ Şəhər sahə anbarı", kind: "sahe", projectId: "seed-x-prj-ag" },
      { id: "seed-x-loc-metro", name: "Metro sahə anbarı", kind: "sahe", projectId: "seed-x-prj-metro" },
    ],
  })

  const materials = [
    ["seed-x-mat-qum", "Çay qumu", "m3", 140, 40, "Mərkəzi anbar", 28],
    ["seed-x-mat-cir", "Çınqıl 5-20", "m3", 96, 30, "Mərkəzi anbar", 32],
    ["seed-x-mat-kabel", "Güc kabeli 4x16", "m", 1800, 400, "Mərkəzi anbar", 6.4],
    ["seed-x-mat-bor", "Polietilen boru 110", "m", 640, 120, "Lənkəran sahəsi", 9.2],
    ["seed-x-mat-kafel", "Döşəmə kafeli 60x60", "m2", 860, 150, "Ağ Şəhər sahə anbarı", 18],
    ["seed-x-mat-suvaq", "Suvaq qarışığı", "kisə", 420, 80, "Mərkəzi anbar", 7.5],
    ["seed-x-mat-izolyasiya", "Bitum izolyasiya", "rulon", 75, 20, "Metro sahə anbarı", 42],
    ["seed-x-mat-panel", "Sendviç panel 80 mm", "m2", 310, 60, "Sumqayıt", 54],
  ]
  for (const [id, name, unit, qty, min, location, price] of materials) {
    await prisma.material.create({ data: { id, name, unit, qty, min, location, price } })
  }
  await prisma.stock.createMany({
    data: [
      { id: "seed-x-stk-1", materialId: "seed-x-mat-qum", locationId: "seed-loc-merkez", qty: 90 },
      { id: "seed-x-stk-2", materialId: "seed-x-mat-qum", locationId: "seed-x-loc-zavod", qty: 50 },
      { id: "seed-x-stk-3", materialId: "seed-x-mat-cir", locationId: "seed-loc-merkez", qty: 96 },
      { id: "seed-x-stk-4", materialId: "seed-x-mat-kabel", locationId: "seed-loc-merkez", qty: 1800 },
      { id: "seed-x-stk-5", materialId: "seed-x-mat-kafel", locationId: "seed-x-loc-ag", qty: 860 },
      { id: "seed-x-stk-6", materialId: "seed-x-mat-izolyasiya", locationId: "seed-x-loc-metro", qty: 75 },
      { id: "seed-x-stk-7", materialId: "seed-mat-sem", locationId: "seed-x-loc-zavod", qty: 40 },
      { id: "seed-x-stk-8", materialId: "seed-mat-arm", locationId: "seed-x-loc-sex", qty: 18 },
    ],
  })
  await prisma.movement.createMany({
    data: [
      ["seed-x-mov-1", "Çay qumu", "medaxil", 60, "m3", "SOCAR Anbar Kompleksi", "2026-09-04", "Kamran Əliyev", "seed-x-mat-qum", "seed-loc-merkez"],
      ["seed-x-mov-2", "Çay qumu", "mexaric", 12, "m3", "SOCAR Anbar Kompleksi", "2026-09-18", "Kamran Əliyev", "seed-x-mat-qum", "seed-x-loc-zavod"],
      ["seed-x-mov-3", "Çınqıl 5-20", "medaxil", 40, "m3", "Metro Dəmiryol Körpüsü", "2026-09-20", "Kamran Əliyev", "seed-x-mat-cir", "seed-loc-merkez"],
      ["seed-x-mov-4", "Güc kabeli 4x16", "transfer", 200, "m", "Ağ Şəhər Blok C", "2026-10-01", "Kamran Əliyev", "seed-x-mat-kabel", "seed-x-loc-ag"],
      ["seed-x-mov-5", "Döşəmə kafeli 60x60", "medaxil", 300, "m2", "Ağ Şəhər Blok C", "2026-10-03", "Kamran Əliyev", "seed-x-mat-kafel", "seed-x-loc-ag"],
      ["seed-x-mov-6", "Döşəmə kafeli 60x60", "mexaric", 48, "m2", "Ağ Şəhər Blok C", "2026-10-09", "Elşən Qarayev", "seed-x-mat-kafel", "seed-x-loc-ag"],
      ["seed-x-mov-7", "Bitum izolyasiya", "medaxil", 30, "rulon", "Metro Dəmiryol Körpüsü", "2026-10-05", "Kamran Əliyev", "seed-x-mat-izolyasiya", "seed-x-loc-metro"],
      ["seed-x-mov-8", "Sement CEM II 42.5", "transfer", 16, "ton", "Beton qovşağı", "2026-10-07", "Kamran Əliyev", "seed-mat-sem", "seed-x-loc-zavod"],
      ["seed-x-mov-9", "Armatur A500 Ø16", "mexaric", 4, "ton", "Yasamal Lisey Korpusu", "2026-10-08", "Kamran Əliyev", "seed-mat-arm", "seed-x-loc-sex"],
      ["seed-x-mov-10", "Sendviç panel 80 mm", "medaxil", 120, "m2", "Sumqayıt Park Anbarı", "2026-10-10", "Kamran Əliyev", "seed-x-mat-panel", "seed-loc-merkez"],
    ].map(([id, material, type, qty, unit, project, date, by, materialId, locationId]) => ({ id, material, type, qty, unit, project, date, by, materialId, locationId })),
  })

  const smetaProjects = [
    ["seed-smeta-biz", "seed-prj-biz"],
    ["seed-smeta-sum", "seed-prj-sum"],
    ["seed-smeta-gence", "seed-prj-gence"],
    ["seed-smeta-metro", "seed-x-prj-metro"],
    ["seed-smeta-ag", "seed-x-prj-ag"],
    ["seed-smeta-school2", "seed-x-prj-school2"],
  ]
  const lineBook = [
    ["Torpaq işləri", "m3", 1200, 28, 400, 200, 0.2],
    ["B30 beton", "m3", 640, 148, 280, 160, 1.1],
    ["Armatur A500", "ton", 90, 1120, 40, 22, 8],
    ["Kərpic hörgü", "m3", 310, 96, 80, 20, 1.4],
    ["Suvaq", "m2", 2400, 14, 600, 0, 0.5],
  ]
  for (const [id, projectId] of smetaProjects) {
    await prisma.smeta.create({
      data: {
        id,
        projectId,
        version: 2,
        status: "razilasma",
        lines: {
          create: lineBook.map(([name, unit, qty, unitPrice, doneQty, billedQty, laborHours], sort) => ({
            id: `${id}-${sort}`,
            sort,
            code: `B.${sort + 1}`,
            name,
            unit,
            qty,
            unitPrice,
            doneQty,
            billedQty,
            laborHours,
            recipe: "",
          })),
        },
      },
    })
    await prisma.project.update({ where: { id: projectId }, data: { smetaId: id } })
  }

  const acts = [
    ["seed-x-act-1", "AKT-14", "seed-prj-biz", "Xəzər Business Center", "Xəzər Holdinq", "MQ-2511", "2026-08", "2026-08-31", 420000, 75600, 495600, "tesdiq", "seed-smeta-biz-1", "B.2", "B30 beton"],
    ["seed-x-act-2", "AKT-15", "seed-prj-sum", "Sumqayıt Lojistik Park", "Sumqayıt Sənaye Parkı", "MQ-2506", "2026-09", "2026-09-30", 280000, 50400, 330400, "qaralama", "seed-smeta-sum-0", "B.1", "Torpaq işləri"],
    ["seed-x-act-3", "AKT-16", "seed-x-prj-metro", "Metro Dəmiryol Körpüsü", "Bakı Metropoliteni", "MQ-2604", "2026-09", "2026-09-30", 610000, 109800, 719800, "faktura", "seed-smeta-metro-2", "B.3", "Armatur A500"],
    ["seed-x-act-4", "AKT-17", "seed-x-prj-ag", "Ağ Şəhər Blok C", "Ağ Şəhər İdarəsi", "MQ-2608", "2026-10", "2026-10-10", 190000, 34200, 224200, "tesdiq", "seed-smeta-ag-4", "B.5", "Suvaq"],
    ["seed-x-act-5", "AKT-18", "seed-prj-gence", "Gəncə Şəhər Klinikası", "Gəncə Səhiyyə Fondu", "MQ-2605", "2026-07", "2026-07-31", 96000, 17280, 113280, "tesdiq", "seed-smeta-gence-0", "B.1", "Torpaq işləri"],
    ["seed-x-act-6", "AKT-19", "seed-x-prj-school2", "Yasamal Lisey Korpusu", "Təhsil İnvest", "MQ-2610", "2026-10", "2026-10-11", 150000, 27000, 177000, "qaralama", "seed-smeta-school2-1", "B.2", "B30 beton"],
  ]
  for (const [id, number, projectId, project, client, contractNumber, period, date, net, vat, gross, status, smetaLineId, code, name] of acts) {
    await prisma.act.create({
      data: {
        id, number, projectId, project, client, contractNumber, period, date, net, vat, gross, status,
        lines: { create: [{ id: `${id}-l`, sort: 1, smetaLineId, code, name, unit: "m3", unitPrice: 140, qty: 80, cumulativeQty: 200 }] },
      },
    })
  }

  const forms = [
    ["seed-x-f3-1", "F3-09", "seed-prj-port", "Port Baku Residence", "Xəzər Holdinq", "MQ-2408", "araliq", "2026-09", "tesdiq"],
    ["seed-x-f3-2", "F3-10", "seed-x-prj-metro", "Metro Dəmiryol Körpüsü", "Bakı Metropoliteni", "MQ-2604", "araliq", "2026-09", "tesdiq"],
    ["seed-x-f3-3", "F3-11", "seed-x-prj-ag", "Ağ Şəhər Blok C", "Ağ Şəhər İdarəsi", "MQ-2608", "araliq", "2026-10", "qaralama"],
    ["seed-x-f3-4", "F3-12", "seed-prj-villa", "Abşeron Villa Qrupu", "Caspian Estates", "MQ-2501", "yekun", "2026-10", "tesdiq"],
  ]
  for (const [id, number, projectId, project, client, contractNumber, kind, period, status] of forms) {
    await prisma.forma3.create({
      data: {
        id, number, projectId, project, client, contractNumber, kind, period, date: `${period}-28`, status,
        smetaValue: 4200000, priorValue: 1800000, periodValue: 640000, cumulativeValue: 2440000, remainValue: 1760000,
        advanceBalance: 210000, retention: 122000, vat: 115200, payable: 524800,
        lines: {
          create: [0, 1, 2].map((sort) => ({
            id: `${id}-l${sort}`,
            sort,
            smetaLineId: `seed-smeta-port-${sort}`,
            code: `B.${sort + 1}`,
            name: lineBook[sort][0],
            unit: lineBook[sort][1],
            smetaQty: 1000, smetaValue: 1400000,
            priorQty: 400, priorValue: 560000,
            periodQty: 120, periodValue: 168000,
            cumulativeQty: 520, cumulativeValue: 728000,
            remainQty: 480, remainValue: 672000,
          })),
        },
      },
    })
  }

  const reports = [
    ["seed-x-rep-1", "seed-prj-port", "2026-10-06", "gunesli", "Fasad alt konstruksiya 4-cü oxda davam etdi.", 22, "tesdiq", "Rauf Hüseynov", "seed-smeta-port-0"],
    ["seed-x-rep-2", "seed-prj-port", "2026-10-08", "kulek", "Kran 2 saat dayandı, sonra iş bərpa olundu.", 18, "gonderilib", "Elşən Qarayev", "seed-smeta-port-0"],
    ["seed-x-rep-3", "seed-prj-biz", "2026-10-07", "buludlu", "8-ci mərtəbə beton tökməsi.", 16, "tesdiq", "Rauf Hüseynov", "seed-smeta-biz-1"],
    ["seed-x-rep-4", "seed-prj-sum", "2026-10-09", "yagis", "Doldurma işi yağış səbəbindən qısaldıldı.", 11, "duzelis", "Vüsal Məlikov", "seed-smeta-sum-0"],
    ["seed-x-rep-5", "seed-x-prj-metro", "2026-10-09", "gunesli", "Dayaq armaturu bağlandı.", 20, "tesdiq", "Nigar Əliyeva", "seed-smeta-metro-2"],
    ["seed-x-rep-6", "seed-x-prj-ag", "2026-10-10", "buludlu", "Mənzil suvağı 12-ci mərtəbə.", 15, "qaralama", "Elşən Qarayev", "seed-smeta-ag-4"],
    ["seed-x-rep-7", "seed-prj-gence", "2026-10-04", "gunesli", "Bünövrə qəlibi yığıldı.", 14, "tesdiq", "Nigar Əliyeva", "seed-smeta-gence-0"],
    ["seed-x-rep-8", "seed-x-prj-school2", "2026-10-11", "kulek", "Örtük armaturu yoxlanıldı.", 12, "gonderilib", "Rauf Hüseynov", "seed-smeta-school2-1"],
    ["seed-x-rep-9", "seed-x-prj-park", "2026-10-03", "gunesli", "Panel montajı 2-ci ox.", 9, "tesdiq", "Vüsal Məlikov", "seed-smeta-port-0"],
    ["seed-x-rep-10", "seed-prj-villa", "2026-10-02", "buludlu", "Son tamamlama və təmizlik.", 7, "tesdiq", "Elşən Qarayev", "seed-smeta-port-0"],
  ]
  for (const [id, projectId, date, weather, note, crew, status, author, smetaLineId] of reports) {
    await prisma.dailyReport.create({
      data: {
        id, projectId, date, weather, note, crew, status, author, laborCost: 1800 + crew * 20, machineCost: 360,
        lines: { create: [{ id: `${id}-l`, sort: 1, smetaLineId, qty: 12 }] },
        machines: { create: [{ id: `${id}-m`, sort: 1, assetId: "seed-ast-1", hours: 5 }] },
        attendance: { create: [{ id: `${id}-a`, sort: 1, personId: "seed-per-usta", hours: 8 }] },
      },
    })
  }

  await prisma.invoice.createMany({
    data: [
      { id: "seed-x-inv-1", client: "Xəzər Holdinq", project: "Port Baku Residence", amount: 860000, issued: "2026-07-31", due: "2026-08-31", status: "odenilib", net: 728814, vat: 131186 },
      { id: "seed-x-inv-2", client: "Bakı Metropoliteni", project: "Metro Dəmiryol Körpüsü", amount: 719800, issued: "2026-09-30", due: "2026-10-30", status: "gonderilib", net: 610000, vat: 109800, actId: "seed-x-act-3" },
      { id: "seed-x-inv-3", client: "Ağ Şəhər İdarəsi", project: "Ağ Şəhər Blok C", amount: 224200, issued: "2026-10-10", due: "2026-11-10", status: "gonderilib", net: 190000, vat: 34200, actId: "seed-x-act-4" },
      { id: "seed-x-inv-4", client: "Gəncə Səhiyyə Fondu", project: "Gəncə Şəhər Klinikası", amount: 113280, issued: "2026-07-31", due: "2026-08-31", status: "odenilib", net: 96000, vat: 17280 },
      { id: "seed-x-inv-5", client: "Caspian Estates", project: "Abşeron Villa Qrupu", amount: 540000, issued: "2026-06-30", due: "2026-07-30", status: "odenilib", net: 457627, vat: 82373 },
      { id: "seed-x-inv-6", client: "Təhsil İnvest", project: "Yasamal Lisey Korpusu", amount: 177000, issued: "2026-09-15", due: "2026-10-01", status: "gecikir", net: 150000, vat: 27000 },
      { id: "seed-x-inv-7", client: "Sumqayıt Sənaye Parkı", project: "Sumqayıt Park Anbarı", amount: 96000, issued: "2026-10-01", due: "2026-11-01", status: "qaralama", net: 81356, vat: 14644 },
      { id: "seed-x-inv-8", client: "SOCAR Downstream", project: "SOCAR Anbar Kompleksi", amount: 310000, issued: "2026-08-20", due: "2026-09-20", status: "odenilib", net: 262712, vat: 47288 },
      { id: "seed-x-inv-9", client: "Şəki Bələdiyyəsi", project: "Şəki Qonaq Evi", amount: 188000, issued: "2026-09-01", due: "2026-10-01", status: "gecikir", net: 159322, vat: 28678 },
      { id: "seed-x-inv-10", client: "Xəzər Holdinq", project: "Xəzər Business Center", amount: 495600, issued: "2026-08-31", due: "2026-09-30", status: "odenilib", net: 420000, vat: 75600, actId: "seed-x-act-1" },
    ],
  })
  await prisma.expense.createMany({
    data: [
      ["seed-x-exp-1", "Material", "Kür Armatur və İnert", "Metro Dəmiryol Körpüsü", 186000, "2026-09-12", "tesdiq"],
      ["seed-x-exp-2", "Material", "Azər Boya İstehsalat", "Ağ Şəhər Blok C", 42800, "2026-09-22", "tesdiq"],
      ["seed-x-exp-3", "İşçilik", "Öz heyət", "Port Baku Residence", 112000, "2026-09-30", "tesdiq"],
      ["seed-x-exp-4", "Texnika", "Sahə Montaj", "SOCAR Anbar Kompleksi", 24600, "2026-10-02", "tesdiq"],
      ["seed-x-exp-5", "Yanacaq", "SOCAR", "Sumqayıt Lojistik Park", 8400, "2026-10-04", "tesdiq"],
      ["seed-x-exp-6", "Subpodrat", "Fasad Konstruksiya", "Port Baku Residence", 96000, "2026-08-18", "tesdiq"],
      ["seed-x-exp-7", "Nəqliyyat", "Şüşədaşıma Lojistik", "Abşeron Villa Qrupu", 7200, "2026-09-28", "tesdiq"],
      ["seed-x-exp-8", "Digər", "Azərişıq", "Yasamal Lisey Korpusu", 3100, "2026-10-06", "tesdiq"],
      ["seed-x-exp-9", "Material", "Qafqaz PVC Profil", "Şəki Qonaq Evi", 15400, "2026-08-09", "tesdiq"],
      ["seed-x-exp-10", "İşçilik", "Öz heyət", "Gəncə Şəhər Klinikası", 48000, "2026-07-31", "tesdiq"],
      ["seed-x-exp-11", "Texnika", "Sahə Montaj", "Lənkəran Su Anbarı", 13200, "2026-10-08", "qaralama"],
      ["seed-x-exp-12", "Material", "Abşeron Şüşə", "Xəzər Business Center", 67000, "2026-09-16", "tesdiq"],
    ].map(([id, category, vendor, project, amount, date, status]) => ({ id, category, vendor, project, amount, date, status })),
  })
  await prisma.payable.createMany({
    data: [
      { id: "seed-x-pay-1", supplier: "Kür Armatur və İnert", poId: "seed-x-po-1", amount: 44800, status: "odenilib", date: "2026-08-20" },
      { id: "seed-x-pay-2", supplier: "Azər Boya İstehsalat", poId: "seed-x-po-2", amount: 9600, status: "acik", date: "2026-09-25" },
      { id: "seed-x-pay-3", supplier: "Xəzər Alüminium Sistemləri", poId: "seed-x-po-3", amount: 73600, status: "acik", date: "2026-10-01" },
      { id: "seed-x-pay-4", supplier: "Abşeron Şüşə", poId: "seed-x-po-4", amount: 18400, status: "odenilib", date: "2026-07-14" },
      { id: "seed-x-pay-5", supplier: "Qafqaz PVC Profil", poId: "seed-x-po-5", amount: 12100, status: "acik", date: "2026-10-06" },
      { id: "seed-x-pay-6", supplier: "Kür Armatur və İnert", poId: "seed-po-1", amount: 11200, status: "odenilib", date: "2026-09-30" },
    ],
  })

  await prisma.department.createMany({
    data: [
      { id: "seed-x-dep-maliyye", name: "Maliyyə", code: "MAL", leadId: "seed-per-gunel", site: "Baş ofis" },
      { id: "seed-x-dep-istehsal", name: "İstehsal", code: "IST", leadId: "seed-per-elvin", site: "Beton qovşağı" },
      { id: "seed-x-dep-satis", name: "Satış", code: "SAT", leadId: "seed-per-nigar", site: "Baş ofis" },
      { id: "seed-x-dep-sex", name: "Armatur sexi", code: "SEX", leadId: "seed-per-rauf", site: "Armatur sexi" },
    ],
  })
  const people = [
    ["seed-x-per-1", "Aysel Həsənova", "Satış rəhbəri", "Satış", "Baş ofis", "ofis", "ofisde", "seed-x-dep-satis", 2200],
    ["seed-x-per-2", "Səbinə Əhmədova", "Təchizatçı", "Anbar", "Mərkəzi anbar", "ofis", "ofisde", "seed-dep-3", 1500],
    ["seed-x-per-3", "Vüsal Məlikov", "Briqadir", "Sahə", "Metro Dəmiryol Körpüsü", "sahe", "sahede", "seed-dep-2", 1800],
    ["seed-x-per-4", "Könül Rzayeva", "Usta", "Sahə", "Ağ Şəhər Blok C", "sahe", "sahede", "seed-dep-2", 1400],
    ["seed-x-per-5", "Orxan Quliyev", "Mexanik", "İstehsal", "Beton qovşağı", "istehsal", "istehsalda", "seed-x-dep-istehsal", 1500],
    ["seed-x-per-6", "Lalə Hüseynova", "Mühasib", "Maliyyə", "Baş ofis", "ofis", "ofisde", "seed-x-dep-maliyye", 1700],
    ["seed-x-per-7", "Tural Əliyev", "Qaynaqçı", "Armatur sexi", "Armatur sexi", "istehsal", "istehsalda", "seed-x-dep-sex", 1300],
    ["seed-x-per-8", "Sevinc Məmmədli", "Anbardar", "Anbar", "Mərkəzi anbar", "ofis", "mezuniyyet", "seed-dep-3", 1100],
    ["seed-x-per-9", "Rəşad İbrahimov", "Maşinist", "Sahə", "SOCAR Anbar Kompleksi", "sahe", "ezamiyyetde", "seed-dep-2", 1600],
    ["seed-x-per-10", "Aygün Qasımova", "Kadrlar", "İdarəetmə", "Baş ofis", "ofis", "ofisde", "seed-dep-1", 1400],
    ["seed-x-per-11", "Elçin Nərimanov", "Elektrik", "Sahə", "Yasamal Lisey Korpusu", "sahe", "sahede", "seed-dep-2", 1350],
    ["seed-x-per-12", "Nərmin Əlizadə", "Laborant", "İstehsal", "Beton qovşağı", "istehsal", "istehsalda", "seed-x-dep-istehsal", 1250],
  ]
  for (const [id, name, role, crew, site, placeKind, status, departmentId, salary] of people) {
    await prisma.person.create({
      data: { id, name, role, crew, site, placeKind, status, phone: "+994 50 410 20 20", email: `${id}@afez.az`, departmentId, pin: id.slice(-4), hired: "2024-06-01", salary, card: id.toUpperCase() },
    })
  }
  await prisma.terminal.createMany({
    data: [
      { id: "seed-x-term-1", name: "Baş ofis turniket", code: "OF-1", site: "Baş ofis", status: "online", lastSeen: "2026-10-12 09:10" },
      { id: "seed-x-term-2", name: "Port Baku giriş", code: "PB-1", site: "Port Baku", status: "online", lastSeen: "2026-10-12 08:02" },
      { id: "seed-x-term-3", name: "Beton qovşağı", code: "BT-1", site: "Beton qovşağı", status: "offline", lastSeen: "2026-10-11 18:40" },
      { id: "seed-x-term-4", name: "Mərkəzi anbar", code: "AN-1", site: "Mərkəzi anbar", status: "online", lastSeen: "2026-10-12 08:30" },
    ],
  })
  const marks = ["geldi", "geldi", "gec", "gelmedi", "mezuniyyet", "ezamiyyet"]
  const attPeople = ["seed-per-usta", "seed-per-rauf", "seed-per-nigar", "seed-x-per-3", "seed-x-per-4", "seed-x-per-5", "seed-x-per-7", "seed-x-per-11"]
  const attRows = []
  for (let dayIndex = 6; dayIndex <= 11; dayIndex += 1) {
    attPeople.forEach((personId, index) => {
      const mark = marks[(dayIndex + index) % marks.length]
      attRows.push({
        id: `seed-x-att-${dayIndex}-${index}`,
        personId,
        date: `2026-10-${String(dayIndex).padStart(2, "0")}`,
        inAt: mark === "gelmedi" || mark === "mezuniyyet" ? "" : mark === "gec" ? "09:20" : "08:05",
        outAt: mark === "gelmedi" || mark === "mezuniyyet" ? "" : "17:40",
        mark,
        terminalId: "seed-x-term-2",
        hours: mark === "gelmedi" || mark === "mezuniyyet" ? 0 : 8,
        note: mark === "gec" ? "Tıxac" : "",
      })
    })
  }
  for (const [index, personId] of ["seed-per-usta", "seed-per-rauf", "seed-per-nigar", "seed-x-per-3", "seed-x-per-4", "seed-x-per-5", "seed-per-kamran", "seed-x-per-11"].entries()) {
    attRows.push({
      id: `seed-x-att-today-${index}`,
      personId,
      date: "2026-09-23",
      inAt: index === 3 ? "09:15" : "08:00",
      outAt: "18:00",
      mark: index === 6 ? "mezuniyyet" : index === 3 ? "gec" : "geldi",
      terminalId: "seed-x-term-1",
      hours: index === 6 ? 0 : 8,
      note: index === 3 ? "Gecikmə" : "",
    })
  }
  await prisma.attendance.createMany({ data: attRows })
  await prisma.leaveRequest.createMany({
    data: [
      { id: "seed-x-lv-1", personId: "seed-x-per-8", kind: "illik", from: "2026-10-06", to: "2026-10-17", days: 10, status: "tesdiq", note: "İllik məzuniyyət" },
      { id: "seed-x-lv-2", personId: "seed-per-gunel", kind: "xestelik", from: "2026-09-22", to: "2026-09-24", days: 3, status: "tesdiq", note: "Həkim arayışı" },
      { id: "seed-x-lv-3", personId: "seed-x-per-4", kind: "odenissiz", from: "2026-10-20", to: "2026-10-21", days: 2, status: "gozleyir", note: "Ailə işi" },
      { id: "seed-x-lv-4", personId: "seed-x-per-9", kind: "ezamiyyet", from: "2026-10-08", to: "2026-10-12", days: 5, status: "tesdiq", note: "Qaradağ sahəsi" },
      { id: "seed-x-lv-5", personId: "seed-per-nigar", kind: "illik", from: "2026-11-02", to: "2026-11-06", days: 5, status: "gozleyir", note: "Planlı" },
      { id: "seed-x-lv-6", personId: "seed-x-per-11", kind: "xestelik", from: "2026-08-11", to: "2026-08-12", days: 2, status: "redd", note: "Arayış çatışmır" },
      { id: "seed-x-lv-7", personId: "seed-per-usta", kind: "illik", from: "2026-12-20", to: "2026-12-31", days: 8, status: "gozleyir", note: "İl sonu" },
      { id: "seed-x-lv-8", personId: "seed-x-per-6", kind: "odenissiz", from: "2026-09-01", to: "2026-09-01", days: 1, status: "tesdiq", note: "Şəxsi iş" },
    ],
  })
  await prisma.hrPayment.createMany({
    data: [
      ["seed-x-hp-1", "seed-per-usta", "maas", 1200, "2026-09-30", "odenilib", "Sentyabr maaşı"],
      ["seed-x-hp-2", "seed-x-per-3", "maas", 1800, "2026-09-30", "odenilib", "Sentyabr maaşı"],
      ["seed-x-hp-3", "seed-x-per-5", "avans", 400, "2026-10-10", "odenilib", "Oktyabr avansı"],
      ["seed-x-hp-4", "seed-per-nigar", "mukafat", 300, "2026-09-30", "odenilib", "Layihə bağlanışı"],
      ["seed-x-hp-5", "seed-x-per-4", "maas", 1400, "2026-10-12", "gozleyir", "Oktyabr"],
      ["seed-x-hp-6", "seed-x-per-7", "maas", 1300, "2026-10-12", "gozleyir", "Oktyabr"],
      ["seed-x-hp-7", "seed-x-per-11", "cerime", 40, "2026-10-08", "odenilib", "Gecikmə"],
      ["seed-x-hp-8", "seed-per-kamran", "avans", 350, "2026-10-05", "odenilib", "Anbar avansı"],
      ["seed-x-hp-9", "seed-x-per-12", "maas", 1250, "2026-09-30", "odenilib", "Sentyabr"],
      ["seed-x-hp-10", "seed-x-per-10", "mukafat", 200, "2026-10-01", "gozleyir", "İşə qəbul paketi"],
    ].map(([id, personId, kind, amount, date, status, note]) => ({ id, personId, kind, amount, date, status, note })),
  })
  await prisma.hrMove.createMany({
    data: [
      { id: "seed-x-mv-1", personId: "seed-x-per-3", date: "2026-09-01", kind: "tikinti", fromSite: "Port Baku", fromDepartmentId: "seed-dep-2", toSite: "Metro Dəmiryol Körpüsü", toDepartmentId: "seed-dep-2", note: "Körpü briqadasına keçid" },
      { id: "seed-x-mv-2", personId: "seed-x-per-5", date: "2026-06-15", kind: "zavod", fromSite: "Baş ofis", fromDepartmentId: "seed-dep-1", toSite: "Beton qovşağı", toDepartmentId: "seed-x-dep-istehsal", note: "Mexanik təyinatı" },
      { id: "seed-x-mv-3", personId: "seed-x-per-7", date: "2026-04-01", kind: "zavod", fromSite: "Mərkəzi anbar", fromDepartmentId: "seed-dep-3", toSite: "Armatur sexi", toDepartmentId: "seed-x-dep-sex", note: "Sexə keçid" },
      { id: "seed-x-mv-4", personId: "seed-per-nigar", date: "2026-03-01", kind: "ofis", fromSite: "Port Baku", fromDepartmentId: "seed-dep-2", toSite: "Baş ofis", toDepartmentId: "seed-dep-1", note: "Layihə rəhbərliyi" },
    ],
  })
  await prisma.payroll.create({
    data: {
      id: "seed-x-payr-08",
      date: "2026-08-31",
      total: 18600,
      status: "odenilib",
      lines: {
        create: people.slice(0, 6).map((person, sort) => ({ id: `seed-x-pl8-${sort}`, sort, personId: person[0], name: person[1], hours: 168, amount: person[8] })),
      },
    },
  })
  await prisma.payroll.create({
    data: {
      id: "seed-x-payr-10",
      date: "2026-10-12",
      total: 9800,
      status: "acik",
      lines: {
        create: people.slice(6).map((person, sort) => ({ id: `seed-x-pl10-${sort}`, sort, personId: person[0], name: person[1], hours: 80, amount: Math.round(person[8] / 2) })),
      },
    },
  })

  await prisma.plant.createMany({
    data: [
      { id: "seed-x-plant-panel", name: "Panel zavodu", place: "Sumqayıt", shift: "Gündüz növbəsi", plan: 40, fact: 28, unit: "eded", kind: "zavod", locationId: "seed-x-loc-zavod", planStatus: "tesdiq", planBy: "Elvin Məmmədov" },
      { id: "seed-x-plant-arm", name: "Armatur sexi", place: "Xırdalan", shift: "Gündüz növbəsi", plan: 12, fact: 9, unit: "ton", kind: "sex", locationId: "seed-x-loc-sex", planStatus: "tesdiq", planBy: "Rauf Hüseynov" },
      { id: "seed-x-plant-pencere", name: "Pəncərə sexi", place: "Binəqədi", shift: "Gündüz növbəsi", plan: 30, fact: 18, unit: "eded", kind: "sex", locationId: "seed-x-loc-sex", planStatus: "qaralama", planBy: "Nigar Əliyeva" },
      { id: "seed-x-plant-boya", name: "Boya sexi", place: "Ələt", shift: "Axşam növbəsi", plan: 200, fact: 0, unit: "kq", kind: "sex", locationId: "seed-x-loc-zavod", planStatus: "qaralama", planBy: "Elvin Məmmədov" },
    ],
  })
  await prisma.recipe.create({
    data: {
      id: "seed-x-rec-b30", product: "B30 beton", unit: "m3", plantId: "seed-plant-1",
      items: { create: [{ id: "seed-x-ri-1", sort: 1, materialId: "seed-mat-sem", qty: 0.38 }, { id: "seed-x-ri-2", sort: 2, materialId: "seed-x-mat-qum", qty: 0.5 }] },
    },
  })
  await prisma.recipe.create({
    data: {
      id: "seed-x-rec-arm", product: "Ø16 karkas", unit: "ton", plantId: "seed-x-plant-arm",
      items: { create: [{ id: "seed-x-ri-3", sort: 1, materialId: "seed-mat-arm", qty: 1 }] },
    },
  })
  await prisma.workOrder.createMany({
    data: [
      { id: "seed-x-wo-1", plant: "Beton qovşağı", product: "B30 beton", project: "Xəzər Business Center", qty: 18, unit: "m3", status: "gedir", due: "2026-10-13", startedBy: "Orxan Quliyev", note: "8-ci mərtəbə", cost: 2664 },
      { id: "seed-x-wo-2", plant: "Beton qovşağı", product: "B25 beton", project: "Metro Dəmiryol Körpüsü", qty: 12, unit: "m3", status: "novbede", due: "2026-10-15", note: "Dayaq" },
      { id: "seed-x-wo-3", plant: "Beton qovşağı", product: "B30 beton", project: "Yasamal Lisey Korpusu", qty: 8, unit: "m3", status: "hazir", due: "2026-10-12", closedBy: "Orxan Quliyev", cost: 1184 },
      { id: "seed-x-wo-4", plant: "Panel zavodu", product: "Fasad paneli FP-12", project: "Ağ Şəhər Blok C", qty: 24, unit: "eded", status: "gonderildi", due: "2026-10-09", sentBy: "Elvin Məmmədov", vehicle: "Yük maşını", cost: 4800 },
      { id: "seed-x-wo-5", plant: "Armatur sexi", product: "Ø16 karkas", project: "Metro Dəmiryol Körpüsü", qty: 6, unit: "ton", status: "gedir", due: "2026-10-14", startedBy: "Tural Əliyev", cost: 6720 },
      { id: "seed-x-wo-6", plant: "Armatur sexi", product: "Bünövrə səbəti", project: "SOCAR Anbar Kompleksi", qty: 4, unit: "ton", status: "novbede", due: "2026-10-18" },
      { id: "seed-x-wo-7", plant: "Pəncərə sexi", product: "Pəncərə bloku 1400", project: "Şəki Qonaq Evi", qty: 16, unit: "eded", status: "hazir", due: "2026-10-11", closedBy: "Nigar Əliyeva" },
      { id: "seed-x-wo-8", plant: "Boya sexi", product: "Fasad boyası ağ", project: "Port Baku Residence", qty: 200, unit: "kq", status: "legv", due: "2026-10-08", cancelledBy: "Elvin Məmmədov", note: "Rəng kodu dəyişdi" },
    ],
  })

  await prisma.asset.createMany({
    data: [
      { id: "seed-x-ast-1", name: "Ekskavator CAT 320", type: "Ekskavator", site: "SOCAR Anbar Kompleksi", status: "sahede", hours: 2140, nextService: "2026-11-12", utilization: 81, rate: 95, fuelPerHour: 14, plate: "90-BH-220", year: 2022, ownership: "oz", fuel: "dizel", meter: "saat", odometer: 2140 },
      { id: "seed-x-ast-2", name: "Beton nasosu", type: "Beton", site: "Beton qovşağı", status: "sahede", hours: 980, nextService: "2026-09-23", utilization: 66, rate: 70, fuelPerHour: 6, year: 2020, ownership: "oz", fuel: "dizel", meter: "saat" },
      { id: "seed-x-ast-3", name: "Yük maşını 20 t", type: "Nəqliyyat", site: "Mərkəzi anbar", status: "bos", hours: 64000, nextService: "2026-12-01", utilization: 48, rate: 45, fuelPerHour: 11, plate: "10-CC-441", year: 2019, ownership: "oz", fuel: "dizel", meter: "km", odometer: 64000, driverId: "seed-drv-1" },
      { id: "seed-x-ast-4", name: "Avtokran 50 t", type: "Kran", site: "Ağ Şəhər Blok C", status: "servis", hours: 3100, nextService: "2026-10-13", utilization: 20, rate: 120, fuelPerHour: 8, plate: "10-KR-050", year: 2018, ownership: "oz", fuel: "dizel", meter: "saat" },
      { id: "seed-x-ast-5", name: "Mikser 9 m3", type: "Beton", site: "Metro Dəmiryol Körpüsü", status: "sahede", hours: 1560, nextService: "2027-01-10", utilization: 74, rate: 55, year: 2023, ownership: "oz", fuel: "dizel", meter: "saat" },
      { id: "seed-x-ast-6", name: "Forklift", type: "Anbar", site: "Mərkəzi anbar", status: "bos", hours: 2200, nextService: "2026-11-20", utilization: 35, rate: 25, year: 2024, ownership: "oz" },
      { id: "seed-x-ast-7", name: "İcarə ekskavatoru", type: "Ekskavator", site: "Quba Dağ Otel", status: "icarede", hours: 120, nextService: "2026-12-15", utilization: 10, rate: 110, year: 2021, ownership: "icare" },
      { id: "seed-x-ast-8", name: "Qaldırıcı platforma", type: "Kran", site: "Port Baku", status: "sahede", hours: 760, nextService: "2026-09-20", utilization: 58, rate: 40, year: 2022, ownership: "icare" },
    ],
  })
  await prisma.driver.createMany({
    data: [
      { id: "seed-x-drv-2", name: "Rəşad İbrahimov", phone: "+994 50 333 21 21", license: "C-11820", category: "C", expires: "2027-09-01", status: "aktiv" },
      { id: "seed-x-drv-3", name: "Kamil Əhmədov", phone: "+994 55 200 14 14", license: "CE-3301", category: "CE", expires: "2026-12-01", status: "mezuniyyet" },
    ],
  })
  await prisma.trip.createMany({
    data: [
      { id: "seed-x-trip-1", assetId: "seed-x-ast-3", driverId: "seed-drv-1", project: "Ağ Şəhər Blok C", from: "Mərkəzi anbar", to: "Ağ Şəhər", cargo: "Kafel", km: 18, date: "2026-10-10", status: "catdi", note: "" },
      { id: "seed-x-trip-2", assetId: "seed-x-ast-3", driverId: "seed-x-drv-2", project: "Metro Dəmiryol Körpüsü", from: "Yevlax", to: "Bakı", cargo: "Armatur", km: 290, date: "2026-10-12", status: "yolda", note: "Gömrük yoxdur" },
      { id: "seed-x-trip-3", assetId: "seed-x-ast-5", driverId: "seed-drv-1", project: "Xəzər Business Center", from: "Ələt", to: "Səbail", cargo: "B30 beton", km: 42, date: "2026-10-13", status: "plan", note: "" },
    ],
  })
  await prisma.fuelFill.createMany({
    data: [
      { id: "seed-x-fuel-1", assetId: "seed-x-ast-1", liters: 180, reading: 2140, amount: 216, project: "SOCAR Anbar Kompleksi", date: "2026-10-08", by: "Kamran Əliyev", note: "Dizel" },
      { id: "seed-x-fuel-2", assetId: "seed-x-ast-3", liters: 90, reading: 63980, amount: 108, project: "Ağ Şəhər Blok C", date: "2026-10-10", by: "Orxan Vəliyev", note: "" },
    ],
  })
  await prisma.fleetDoc.createMany({
    data: [
      { id: "seed-x-fd-1", assetId: "seed-ast-1", kind: "sigorta", number: "SI-2026-101", issuer: "Tikinti Sığorta", expires: "2026-10-01" },
      { id: "seed-x-fd-2", assetId: "seed-x-ast-3", kind: "baxis", number: "TEX-441", issuer: "BDYPI", expires: "2026-09-18" },
      { id: "seed-x-fd-3", assetId: "seed-x-ast-1", kind: "qeydiyyat", number: "90-BH-220", issuer: "DYP", expires: "2028-01-01" },
      { id: "seed-x-fd-4", assetId: "seed-ast-2", kind: "icaze", number: "IC-2026-002", issuer: "İcarədar", expires: "2026-10-05" },
    ],
  })
  await prisma.serviceJob.createMany({
    data: [
      { id: "seed-x-srv-1", assetId: "seed-x-ast-4", asset: "Avtokran 50 t", project: "Ağ Şəhər Blok C", status: "acik", opened: "2026-10-11", note: "Hidravlika sızması", cost: 1200 },
      { id: "seed-x-srv-2", assetId: "seed-ast-2", asset: "Ekskavator", project: "Xırdalan Məktəb Kompleksi", status: "bagli", opened: "2026-09-02", closed: "2026-09-04", note: "Yağ dəyişmə", cost: 240 },
    ],
  })
  await prisma.gear.createMany({
    data: [
      { id: "seed-x-gear-1", name: "Qoruyucu kask", category: "geyim", place: "Port Baku", qty: 40, unit: "eded", status: "istifade", home: "istifade", nextCheck: "2026-12-01" },
      { id: "seed-x-gear-2", name: "Təhlükəsizlik kəməri", category: "geyim", place: "Ağ Şəhər", qty: 18, unit: "eded", status: "yoxlamada", home: "istifade", nextCheck: "2026-10-20" },
      { id: "seed-x-gear-3", name: "Perforator", category: "alet", place: "Mərkəzi anbar", qty: 6, unit: "eded", status: "anbarda", home: "anbarda", nextCheck: "2027-01-15" },
      { id: "seed-x-gear-4", name: "Qaynaq aparatı", category: "avadanliq", place: "Armatur sexi", qty: 3, unit: "eded", status: "istifade", home: "istifade", nextCheck: "2026-11-01" },
      { id: "seed-x-gear-5", name: "Lazer nivelir", category: "alet", place: "Metro sahəsi", qty: 2, unit: "eded", status: "gonderildi", home: "istifade", nextCheck: "2026-10-18" },
      { id: "seed-x-gear-6", name: "Generator 20 kVt", category: "avadanliq", place: "Lənkəran", qty: 1, unit: "eded", status: "tesdiq", home: "istifade", nextCheck: "2026-10-25" },
      { id: "seed-x-gear-7", name: "İş əlcəyi", category: "levazimat", place: "Mərkəzi anbar", qty: 200, unit: "cut", status: "anbarda", home: "anbarda", nextCheck: "2027-03-01" },
      { id: "seed-x-gear-8", name: "Köhnə iskele", category: "sair", place: "Anbar", qty: 12, unit: "serit", status: "kohnelmis", home: "anbarda", nextCheck: "2026-09-01" },
    ],
  })
  await prisma.gearEvent.createMany({
    data: [
      { id: "seed-x-ge-1", gearId: "seed-x-gear-2", kind: "yoxlama", note: "Kəmər tikişi yoxlanır", by: "Rauf Hüseynov", date: "2026-10-10", status: "yoxlamada" },
      { id: "seed-x-ge-2", gearId: "seed-x-gear-5", kind: "qebul", note: "Yeni lazer qəbul edildi", by: "Kamran Əliyev", date: "2026-10-08", status: "gonderildi" },
      { id: "seed-x-ge-3", gearId: "seed-x-gear-8", kind: "kohnelme", note: "İstifadəyə yararsız", by: "Kamran Əliyev", date: "2026-09-01", status: "kohnelmis" },
    ],
  })

  await prisma.supplier.createMany({
    data: [
      { id: "seed-x-sup-suse", name: "Abşeron Şüşə", category: "Şüşə", city: "Sumqayıt", rating: "4.5", terms: "14 gün", contact: "+994 50 700 10 10" },
      { id: "seed-x-sup-pvc", name: "Qafqaz PVC Profil", category: "Pəncərə", city: "Xırdalan", rating: "4.2", terms: "avans 30%", contact: "+994 50 700 20 20" },
      { id: "seed-x-sup-qum", name: "Abşeron İnert", category: "İnert", city: "Qaradağ", rating: "4.1", terms: "nağd", contact: "+994 50 700 30 30" },
    ],
  })
  await prisma.purchaseOrder.createMany({
    data: [
      { id: "seed-x-po-1", supplier: "Kür Armatur və İnert", item: "Armatur A500 Ø16", qty: 40, unit: "ton", amount: 44800, status: "qebul", eta: "2026-08-18", materialId: "seed-mat-arm", receivedQty: 40 },
      { id: "seed-x-po-2", supplier: "Azər Boya İstehsalat", item: "Fasad boyası ağ", qty: 2000, unit: "kq", amount: 9600, status: "yoldadir", eta: "2026-10-20", materialId: "seed-mat-boya", receivedQty: 0 },
      { id: "seed-x-po-3", supplier: "Xəzər Alüminium Sistemləri", item: "Alüminium profil 60 mm", qty: 6400, unit: "m", amount: 73600, status: "tesdiq", eta: "2026-10-28", materialId: "seed-mat-profil", receivedQty: 0 },
      { id: "seed-x-po-4", supplier: "Abşeron Şüşə", item: "Şüşə paket 24 mm", qty: 200, unit: "m2", amount: 18400, status: "qebul", eta: "2026-07-12", materialId: "seed-mat-suse", receivedQty: 200 },
      { id: "seed-x-po-5", supplier: "Qafqaz PVC Profil", item: "PVC profil 70 mm", qty: 1500, unit: "m", amount: 12100, status: "yoldadir", eta: "2026-10-22", receivedQty: 400 },
      { id: "seed-x-po-6", supplier: "Abşeron İnert", item: "Çay qumu", qty: 80, unit: "m3", amount: 2240, status: "qebul", eta: "2026-09-04", materialId: "seed-x-mat-qum", receivedQty: 80 },
    ],
  })
  await prisma.materialRequest.createMany({
    data: [
      { id: "seed-x-req-1", projectId: "seed-x-prj-metro", project: "Metro Dəmiryol Körpüsü", materialId: "seed-mat-arm", material: "Armatur A500 Ø16", qty: 12, unit: "ton", status: "sifaris", author: "Rauf Hüseynov", date: "2026-10-02", text: "Dayaq üçün", poId: "seed-x-po-1" },
      { id: "seed-x-req-2", projectId: "seed-x-prj-ag", project: "Ağ Şəhər Blok C", materialId: "seed-mat-boya", material: "Fasad boyası ağ", qty: 400, unit: "kq", status: "gozleyir", author: "Elşən Qarayev", date: "2026-10-09", text: "12-ci mərtəbə" },
      { id: "seed-x-req-3", projectId: "seed-prj-port", project: "Port Baku Residence", materialId: "seed-mat-profil", material: "Alüminium profil 60 mm", qty: 800, unit: "m", status: "teklif", author: "Nigar Əliyeva", date: "2026-10-05", text: "Fasad oxu 4" },
      { id: "seed-x-req-4", projectId: "seed-prj-biz", project: "Xəzər Business Center", materialId: "seed-mat-suse", material: "Şüşə paket 24 mm", qty: 60, unit: "m2", status: "anbar", author: "Rauf Hüseynov", date: "2026-09-28", text: "Sahə anbarına" },
      { id: "seed-x-req-5", projectId: "seed-x-prj-school2", project: "Yasamal Lisey Korpusu", materialId: "seed-x-mat-kabel", material: "Güc kabeli 4x16", qty: 300, unit: "m", status: "gozleyir", author: "Elçin Nərimanov", date: "2026-10-11" },
      { id: "seed-x-req-6", projectId: "seed-prj-sum", project: "Sumqayıt Lojistik Park", materialId: "seed-x-mat-panel", material: "Sendviç panel 80 mm", qty: 200, unit: "m2", status: "redd", author: "Vüsal Məlikov", date: "2026-10-01", decision: "Ölçü təsdiqlənməyib", decidedBy: "Səbinə Əhmədova" },
      { id: "seed-x-req-7", projectId: "seed-x-prj-su", project: "Lənkəran Su Anbarı", materialId: "seed-x-mat-bor", material: "Polietilen boru 110", qty: 400, unit: "m", status: "sifaris", author: "Rauf Hüseynov", date: "2026-10-07", poId: "seed-x-po-5" },
      { id: "seed-x-req-8", projectId: "seed-prj-villa", project: "Abşeron Villa Qrupu", materialId: "seed-x-mat-kafel", material: "Döşəmə kafeli 60x60", qty: 80, unit: "m2", status: "anbar", author: "Elşən Qarayev", date: "2026-09-20" },
    ],
  })
  await prisma.quote.createMany({
    data: [
      { id: "seed-x-qt-1", requestId: "seed-x-req-3", supplier: "Xəzər Alüminium Sistemləri", amount: 9200, days: 10, status: "acik" },
      { id: "seed-x-qt-2", requestId: "seed-x-req-3", supplier: "Qafqaz PVC Profil", amount: 8700, days: 14, status: "acik" },
      { id: "seed-x-qt-3", requestId: "seed-x-req-1", supplier: "Kür Armatur və İnert", amount: 13440, days: 7, status: "secildi" },
      { id: "seed-x-qt-4", requestId: "seed-x-req-2", supplier: "Azər Boya İstehsalat", amount: 1920, days: 5, status: "acik" },
      { id: "seed-x-qt-5", requestId: "seed-x-req-7", supplier: "Abşeron İnert", amount: 3680, days: 12, status: "secildi" },
      { id: "seed-x-qt-6", requestId: "seed-x-req-6", supplier: "Fasad Konstruksiya", amount: 10800, days: 20, status: "redd" },
    ],
  })

  await prisma.shipment.create({
    data: {
      id: "seed-x-ship-1", stops: ["seed-loc-merkez", "seed-x-loc-ag"], step: 1, date: "2026-10-10", by: "Orxan Vəliyev", note: "Kafel daşındı",
      lines: { create: [{ id: "seed-x-sl-1", sort: 1, materialId: "seed-x-mat-kafel", material: "Döşəmə kafeli 60x60", qty: 120, unit: "m2", price: 18, amount: 2160 }] },
    },
  })
  await prisma.shipment.create({
    data: {
      id: "seed-x-ship-2", stops: ["seed-loc-merkez", "seed-x-loc-metro", "seed-x-loc-zavod"], step: 0, date: "2026-10-12", by: "Rəşad İbrahimov", note: "Armatur və sement",
      lines: { create: [{ id: "seed-x-sl-2", sort: 1, materialId: "seed-mat-arm", material: "Armatur A500 Ø16", qty: 6, unit: "ton", price: 1120, amount: 6720 }] },
    },
  })

  await prisma.document.createMany({
    data: [
      { id: "seed-x-doc-1", projectId: "seed-x-prj-metro", title: "Tikinti icazəsi", kind: "İcazə", status: "tesdiq", date: "2026-03-18" },
      { id: "seed-x-doc-2", projectId: "seed-x-prj-metro", title: "Körpü cizgisi", kind: "Çizgi", status: "tesdiq", date: "2026-02-02" },
      { id: "seed-x-doc-3", projectId: "seed-x-prj-ag", title: "Əlavə iş protokolu", kind: "Protokol", status: "gozleyir", date: "2026-10-04" },
      { id: "seed-x-doc-4", projectId: "seed-prj-port", title: "Fasad aktı", kind: "Akt", status: "tesdiq", date: "2026-09-30" },
      { id: "seed-x-doc-5", projectId: "seed-x-prj-socar", title: "Ətraf mühit rəyi", kind: "İcazə", status: "gozleyir", date: "2026-09-14" },
      { id: "seed-x-doc-6", projectId: "seed-prj-gence", title: "Tibbi plan", kind: "Çizgi", status: "tesdiq", date: "2026-05-20" },
      { id: "seed-x-doc-7", projectId: "seed-x-prj-sheki", title: "Təhvil aktı", kind: "Akt", status: "tesdiq", date: "2026-10-01" },
      { id: "seed-x-doc-8", projectId: "seed-x-prj-school2", title: "Dəyişiklik protokolu", kind: "Əlavə iş", status: "gozleyir", date: "2026-10-08" },
    ],
  })
  await prisma.journalEntry.createMany({
    data: [
      ["seed-x-j-1", "2026-10-06 08:10", "Port Baku", "Briqada 22 nəfər, hava günəşli."],
      ["seed-x-j-2", "2026-10-07 09:00", "Xəzər Business Center", "Beton nasosu sahəyə gəldi."],
      ["seed-x-j-3", "2026-10-08 11:40", "Port Baku", "Külək artdı, kran dayandırıldı."],
      ["seed-x-j-4", "2026-10-09 08:20", "Metro Dəmiryol Körpüsü", "Armatur qəbulu imzalandı."],
      ["seed-x-j-5", "2026-10-09 16:00", "Sumqayıt Lojistik Park", "Yağış səbəbindən doldurma dayandı."],
      ["seed-x-j-6", "2026-10-10 10:15", "Ağ Şəhər Blok C", "Suvaq briqadası 12-ci mərtəbədədir."],
      ["seed-x-j-7", "2026-10-10 14:00", "Beton qovşağı", "B30 partiyası laboratoriya nümunəsi götürüldü."],
      ["seed-x-j-8", "2026-10-11 08:05", "Armatur sexi", "6 ton karkas növbədədir."],
      ["seed-x-j-9", "2026-10-11 13:30", "Mərkəzi anbar", "Kafel partiyası sayıldı, çatışmazlıq yoxdur."],
      ["seed-x-j-10", "2026-10-12 09:20", "Yasamal Lisey Korpusu", "Örtük armaturu mühəndis yoxlamasındadır."],
    ].map(([id, time, site, text]) => ({ id, time, site, text })),
  })
  await prisma.auditEntry.createMany({
    data: [
      ["seed-x-aud-1", "2026-09-30T18:00:00.000Z", "Günel Rzayeva", "muhasib", "qaimə", "Port Baku avqust qaiməsi ödənilib yazıldı"],
      ["seed-x-aud-2", "2026-10-01T09:10:00.000Z", "Kamran Əliyev", "anbardar", "anbar", "Çay qumu qəbulu Mərkəzi anbara düşdü"],
      ["seed-x-aud-3", "2026-10-02T11:00:00.000Z", "Səbinə Əhmədova", "satinalma", "sifariş", "Armatur sifarişi Kür Armaturdan seçildi"],
      ["seed-x-aud-4", "2026-10-04T15:20:00.000Z", "Nigar Əliyeva", "layihe", "akt", "AKT-14 Xəzər Business Center təsdiqləndi"],
      ["seed-x-aud-5", "2026-10-06T08:30:00.000Z", "Rauf Hüseynov", "sahe", "gündəlik", "Port Baku 6 oktyabr gündəliyi təsdiqə getdi"],
      ["seed-x-aud-6", "2026-10-07T10:00:00.000Z", "Elvin Məmmədov", "direktor", "əmək haqqı", "Avqust maaş cədvəli ödənildi"],
      ["seed-x-aud-7", "2026-10-08T12:40:00.000Z", "Aygün Qasımova", "kadr", "məzuniyyət", "Sevinc Məmmədlinin illik məzuniyyəti təsdiqləndi"],
      ["seed-x-aud-8", "2026-10-09T09:00:00.000Z", "Orxan Quliyev", "istehsal", "iş əmri", "B30 beton işə salındı"],
      ["seed-x-aud-9", "2026-10-10T16:10:00.000Z", "Günel Rzayeva", "muhasib", "xərc", "Fasad subpodratı təsdiqləndi"],
      ["seed-x-aud-10", "2026-10-11T08:50:00.000Z", "Rauf Hüseynov", "sahe", "texnika", "Avtokran 50 t servisə yazıldı"],
      ["seed-x-aud-11", "2026-10-11T14:00:00.000Z", "Aysel Həsənova", "satis", "sövdə", "Quba Dağ Otel ilkin mərhələyə keçdi"],
      ["seed-x-aud-12", "2026-10-12T09:30:00.000Z", "Platforma inzibatçısı", "direktor", "kabinet", "Demo məlumatı yeniləndi"],
    ].map(([id, at, actor, role, action, detail]) => ({ id, at, actor, role, action, detail })),
  })

  await prisma.lead.createMany({
    data: [
      { id: "seed-x-lead-1", name: "Rauf İsmayılov", company: "Bakı Metropoliteni", value: 4500000, owner: "Aysel Həsənova", heat: "isti", source: "tender", next: "2026-10-21" },
      { id: "seed-x-lead-2", name: "Tural Həsənli", company: "Ağ Şəhər İdarəsi", value: 2100000, owner: "Aysel Həsənova", heat: "isti", source: "görüş", next: "2026-10-16" },
      { id: "seed-x-lead-3", name: "Elçin Vəliyev", company: "Lənkəran Su Kanalı", value: 980000, owner: "Nigar Əliyeva", heat: "ilik", source: "zəng", next: "2026-10-19" },
      { id: "seed-x-lead-4", name: "Nərgiz Quliyeva", company: "Quba Turizm", value: 7100000, owner: "Aysel Həsənova", heat: "soyuq", source: "sayt", next: "2026-11-02" },
      { id: "seed-x-lead-5", name: "Günel Məlikova", company: "SOCAR Downstream", value: 6000000, owner: "Elvin Məmmədov", heat: "isti", source: "tövsiyə", next: "2026-10-24" },
      { id: "seed-x-lead-6", name: "Aygün Əliyeva", company: "Şəki Bələdiyyəsi", value: 400000, owner: "Aysel Həsənova", heat: "ilik", source: "bələdiyyə", next: "2026-10-28" },
    ],
  })
  await prisma.deal.createMany({
    data: [
      { id: "seed-x-deal-1", title: "Metro ikinci dayaq", client: "Bakı Metropoliteni", value: 4500000, stage: "danisiq", owner: "Aysel Həsənova", close: "2026-12-15", projectId: "seed-x-prj-metro" },
      { id: "seed-x-deal-2", title: "Ağ Şəhər Blok D", client: "Ağ Şəhər İdarəsi", value: 2100000, stage: "teklif", owner: "Aysel Həsənova", close: "2026-11-20" },
      { id: "seed-x-deal-3", title: "Lənkəran nasosxana", client: "Lənkəran Su Kanalı", value: 980000, stage: "ilkin", owner: "Nigar Əliyeva", close: "2027-01-15" },
      { id: "seed-x-deal-4", title: "Quba otel karkası", client: "Quba Turizm", value: 7100000, stage: "ilkin", owner: "Aysel Həsənova", close: "2027-02-01", projectId: "seed-x-prj-quba" },
      { id: "seed-x-deal-5", title: "SOCAR çən meydançası", client: "SOCAR Downstream", value: 6000000, stage: "muqavile", owner: "Elvin Məmmədov", close: "2026-11-01", projectId: "seed-x-prj-socar" },
      { id: "seed-x-deal-6", title: "Şəki bazar örtüyü", client: "Şəki Bələdiyyəsi", value: 400000, stage: "uduzulub", owner: "Aysel Həsənova", close: "2026-09-01" },
    ],
  })
  await prisma.crmTask.createMany({
    data: [
      { id: "seed-x-task-1", title: "Metro smetasını göndər", kind: "teklif", status: "gedir", priority: "yuksek", owner: "Aysel Həsənova", due: "2026-10-16", client: "Bakı Metropoliteni", dealId: "seed-x-deal-1", note: "İkinci dayaq" },
      { id: "seed-x-task-2", title: "Ağ Şəhər görüşü", kind: "gorus", status: "acik", priority: "orta", owner: "Nigar Əliyeva", due: "2026-10-18", client: "Ağ Şəhər İdarəsi", dealId: "seed-x-deal-2", note: "Blok D" },
      { id: "seed-x-task-3", title: "SOCAR zəngi", kind: "zeng", status: "bitdi", priority: "yuksek", owner: "Elvin Məmmədov", due: "2026-10-08", client: "SOCAR Downstream", dealId: "seed-x-deal-5", note: "Müqavilə tarixi" },
      { id: "seed-x-task-4", title: "Quba brifinqi", kind: "sened", status: "gozleyir", priority: "asagi", owner: "Aysel Həsənova", due: "2026-10-30", client: "Quba Turizm", dealId: "seed-x-deal-4", note: "Torpaq planı" },
      { id: "seed-x-task-5", title: "Lənkəran takip", kind: "takip", status: "acik", priority: "orta", owner: "Nigar Əliyeva", due: "2026-10-22", client: "Lənkəran Su Kanalı", leadId: "seed-x-lead-3", note: "" },
      { id: "seed-x-task-6", title: "Şəki imtina məktubu", kind: "sened", status: "bitdi", priority: "asagi", owner: "Aysel Həsənova", due: "2026-09-03", client: "Şəki Bələdiyyəsi", dealId: "seed-x-deal-6", note: "Uduzulub" },
      { id: "seed-x-task-7", title: "Xəzər Holdinq akt zəngi", kind: "zeng", status: "gedir", priority: "yuksek", owner: "Günel Rzayeva", due: "2026-10-14", client: "Xəzər Holdinq", note: "AKT-14" },
      { id: "seed-x-task-8", title: "Təhsil İnvest görüşü", kind: "gorus", status: "acik", priority: "orta", owner: "Nigar Əliyeva", due: "2026-10-25", client: "Təhsil İnvest", note: "Lisey korpusu" },
    ],
  })
  await prisma.crmFile.createMany({
    data: [
      { id: "seed-x-file-1", title: "Metro kommersiya təklifi", number: "TK-104", kind: "teklif", status: "gozleyir", owner: "Aysel Həsənova", date: "2026-10-02", due: "2026-10-20", client: "Bakı Metropoliteni", dealId: "seed-x-deal-1", projectId: "seed-x-prj-metro", note: "İkinci dayaq" },
      { id: "seed-x-file-2", title: "SOCAR müqavilə layihəsi", number: "MQ-330", kind: "muqavile", status: "tesdiq", owner: "Elvin Məmmədov", date: "2026-09-18", due: "2026-11-01", client: "SOCAR Downstream", dealId: "seed-x-deal-5", projectId: "seed-x-prj-socar", note: "" },
      { id: "seed-x-file-3", title: "Ağ Şəhər fasad cizgisi", number: "CZ-18", kind: "cizgi", status: "tesdiq", owner: "Nigar Əliyeva", date: "2026-08-12", due: "", client: "Ağ Şəhər İdarəsi", projectId: "seed-x-prj-ag", note: "Blok C" },
      { id: "seed-x-file-4", title: "Gəncə təhvil məktubu", number: "MK-09", kind: "mektub", status: "arxiv", owner: "Günel Rzayeva", date: "2026-07-02", due: "", client: "Gəncə Səhiyyə Fondu", projectId: "seed-prj-gence", note: "" },
      { id: "seed-x-file-5", title: "VÖEN çıxarışı", number: "VN-01", kind: "sexsiyyet", status: "tesdiq", owner: "Aygün Qasımova", date: "2026-01-15", due: "2027-01-15", client: "Sənaye Xidmətləri", note: "Kabinet sənədi" },
      { id: "seed-x-file-6", title: "Port Baku sentyabr aktı", number: "AKT-09", kind: "akt", status: "tesdiq", owner: "Günel Rzayeva", date: "2026-09-30", due: "", client: "Xəzər Holdinq", projectId: "seed-prj-port", note: "" },
      { id: "seed-x-file-7", title: "Quba ilkin təklif", number: "TK-118", kind: "teklif", status: "qaralama", owner: "Aysel Həsənova", date: "2026-10-11", due: "2026-11-05", client: "Quba Turizm", dealId: "seed-x-deal-4", note: "Qiymət hələ açılmayıb" },
      { id: "seed-x-file-8", title: "Lənkəran niyyət məktubu", number: "MK-22", kind: "mektub", status: "gozleyir", owner: "Nigar Əliyeva", date: "2026-10-07", due: "2026-10-28", client: "Lənkəran Su Kanalı", note: "" },
    ],
  })
  await prisma.crmActivity.createMany({
    data: [
      { id: "seed-x-actv-1", kind: "zeng", title: "Metro satınalma ilə danışıq", at: "2026-10-10 11:00", owner: "Aysel Həsənova", client: "Bakı Metropoliteni", dealId: "seed-x-deal-1", note: "Qiymət cədvəli istənildi" },
      { id: "seed-x-actv-2", kind: "gorus", title: "SOCAR ofis görüşü", at: "2026-09-20 15:00", owner: "Elvin Məmmədov", client: "SOCAR Downstream", dealId: "seed-x-deal-5", note: "Müqavilə paraflandı" },
      { id: "seed-x-actv-3", kind: "email", title: "Ağ Şəhər əlavə iş məktubu", at: "2026-10-04 09:30", owner: "Nigar Əliyeva", client: "Ağ Şəhər İdarəsi", note: "Blok C" },
      { id: "seed-x-actv-4", kind: "qeyd", title: "Quba büdcəsi hələ təsdiqlənməyib", at: "2026-10-11 17:10", owner: "Aysel Həsənova", client: "Quba Turizm", note: "Növbəti zəng noyabrda" },
      { id: "seed-x-actv-5", kind: "zeng", title: "Şəki imtina təsdiqi", at: "2026-09-02 12:00", owner: "Aysel Həsənova", client: "Şəki Bələdiyyəsi", dealId: "seed-x-deal-6", note: "" },
      { id: "seed-x-actv-6", kind: "gorus", title: "Xəzər Holdinq akt yoxlaması", at: "2026-10-01 10:00", owner: "Günel Rzayeva", client: "Xəzər Holdinq", note: "AKT-09 qəbul olundu" },
    ],
  })

  await prisma.materialPassport.createMany({
    data: [
      ["seed-x-pass-1", "seed-org-admin", "Sement CEM II 42.5", "03300 Yerində tökülən beton", "uygun", "Kür Armatur və İnert", "AZS 365", "SEM-2026-17", "AZSTAND", "2027-04-01", "SEM-101", "Azərbaycan", "Sınaq 17/2026"],
      ["seed-x-pass-2", "seed-org-admin", "Armatur A500 Ø16", "05120 Konstruktiv polad", "uygun", "Kür Armatur və İnert", "A500", "ARM-1002", "laboratoriya", "2027-01-15", "A500-1002", "Azərbaycan", "Sınaq 41/2026"],
      ["seed-x-pass-3", "seed-org-admin", "Fasad boyası ağ", "01400 Keyfiyyət tələbləri", "el", "Azər Boya İstehsalat", "AZS 148", "BOY-440", "AZSTAND", "2027-06-01", "AG-440", "Azərbaycan", "Sınaq 18/2026"],
      ["seed-x-pass-4", "seed-org-admin", "Şüşə paket 24 mm", "Sınaq və sertifikat", "uygun", "Abşeron Şüşə", "EN 1279", "GL-24-77", "AZSTAND", "2027-02-01", "GL-077", "Azərbaycan", "Sınaq 77/2026"],
      ["seed-x-pass-5", "seed-org-admin", "Alüminium profil 60 mm", "05120 Konstruktiv polad", "catismir", "Xəzər Alüminium Sistemləri", "EN 573", "", "", "2027-03-01", "PRF-60-09", "Azərbaycan", ""],
      ["seed-x-pass-6", "seed-org-admin", "Sendviç panel 80 mm", "01600 Məhsul tələbləri", "gozleyir", "Fasad Konstruksiya", "EN 14509", "PNL-80-3", "laboratoriya", "2026-11-08", "PNL-80", "Azərbaycan", "Sınaq 80/2026"],
      ["seed-x-pass-7", "seed-org-afez", "Çay qumu", "03300 Yerində tökülən beton", "uygun", "Abşeron İnert", "AZS 165", "QUM-14", "laboratoriya", "2027-05-01", "QUM-14", "Abşeron", "Sınaq 14/2026"],
      ["seed-x-pass-8", "seed-org-afez", "Polietilen boru 110", "Sınaq və sertifikat", "uygun", "Lənkəran Su Kanalı", "ISO 4427", "BOR-110-2", "AZSTAND", "2028-01-01", "BOR-22", "Azərbaycan", "Sınaq 22/2026"],
      ["seed-x-pass-9", "seed-org-afez", "Armatur A500 Ø16", "05120 Konstruktiv polad", "uygun", "Kür Armatur və İnert", "A500", "ARM-0918", "laboratoriya", "2027-01-15", "A500-0918", "Azərbaycan", "Sınaq 41/2026"],
      ["seed-x-pass-10", "seed-org-afez", "Sement CEM II 42.5", "03300 Yerində tökülən beton", "uygun", "Norm Sement", "AZS EN 197-1", "SEM-425-86", "AZSTAND", "2027-08-01", "CEM-425-09", "Azərbaycan", "Sınaq 09/2026"],
      ["seed-x-pass-11", "seed-org-afez", "Fasad boyası ağ", "01400 Keyfiyyət tələbləri", "uygun", "Azər Boya İstehsalat", "AZS 148", "UY-2026-440", "AZSTAND", "2027-06-01", "AG-440", "Azərbaycan", "Sınaq 18/2026"],
      ["seed-x-pass-12", "seed-org-afez", "Şüşə paket 24 mm", "Sınaq və sertifikat", "catismir", "Abşeron Şüşə", "EN 1279", "", "", "", "GL-24-180", "Azərbaycan", ""],
      ["seed-x-pass-13", "seed-org-afez", "Alüminium profil 60 mm", "05120 Konstruktiv polad", "gozleyir", "Xəzər Alüminium Sistemləri", "EN 573", "PRF-60-09", "laboratoriya", "2026-11-02", "PRF-60-09", "Azərbaycan", "Sınaq 60/2026"],
      ["seed-x-pass-14", "seed-org-afez", "Fasad paneli", "01600 Məhsul tələbləri", "deyil", "Fasad Konstruksiya", "EN 14509", "FAS-4", "laboratoriya", "2026-12-20", "FAS-4-07", "Azərbaycan", "Sınaq 4/2026"],
    ].map(([id, organizationId, material, section, fit, maker, standard, certificate, issuer, validUntil, batch, origin = "", protocol = ""]) => ({
      id, organizationId, material, section, fit, maker, standard, certificate, issuer, validUntil: validUntil ? day(validUntil) : null, batch, origin, protocol,
    })),
  })
  await prisma.legalTemplate.createMany({
    data: [
      ["seed-x-tpl-1", "Subpodrat müqaviləsi", "Müqavilə", "2.0", "Baxıldı", "Fasad briqadası", "{{sirket}} (VÖEN {{voen}}) subpodrat müqaviləsi. İş: {{layihe}}."],
      ["seed-x-tpl-2", "Material alışı", "Müqavilə", "1.4", "Gözləyir", "{{teref}}", "{{sirket}} {{teref}} tərəfindən material alır. Məbləğ {{mebleg}} AZN."],
      ["seed-x-tpl-3", "Forma-2 aktı", "Akt", "1.1", "Baxıldı", "{{sifarisci}}", "{{layihe}} üzrə görülmüş işlər. Dövr {{dovr}}. Şirkət {{sirket}}."],
      ["seed-x-tpl-4", "Forma-3 arayışı", "Akt", "1.0", "Gözləyir", "{{sifarisci}}", "Yerinə yetirilmiş işlərin dəyəri. Müqavilə {{muqavile}}."],
      ["seed-x-tpl-5", "İştirak qarantiyası", "Zəmanət", "1.3", "Baxıldı", "Bank", "{{sirket}} (VÖEN {{voen}}) adından iştirak qarantiyası."],
      ["seed-x-tpl-6", "İcra qarantiyası", "Zəmanət", "1.0", "Geri qaytarıldı", "Bank", "İcra təminatı. Məbləğ və müddət ayrıca yazılır."],
      ["seed-x-tpl-7", "Anbar sifarişi", "Sifariş", "1.2", "Baxıldı", "Anbardar", "{{sirket}} anbar sifarişi. Material və miqdar cədvəldədir."],
      ["seed-x-tpl-8", "Texnika icarəsi", "Sifariş", "1.0", "Gözləyir", "Sahə Montaj", "Texnika icarəsi. Günlük tarif və operator şərti."],
    ].map(([id, name, kind, version, legal, party, body]) => ({
      id, organizationId: "seed-org-admin", name, kind, version, legal, party, status: "Hazır şablon", body, updatedOn: day("2026-09-15"),
    })),
  })
  await prisma.officialInquiry.createMany({
    data: [
      { id: "seed-x-off-1", organizationId: "seed-org-admin", topic: "selahiyyet", state: "alindi", channel: "sened", source: "SIMA sənədi", document: "sima-razilıq.pdf", asOf: day("2026-09-01"), resultNote: "Direktorun elektron razılığı qovluqdadır" },
      { id: "seed-x-off-2", organizationId: "seed-org-admin", topic: "voen", state: "alindi", channel: "sened", source: "Qeydiyyat çıxarışı", document: "voen-admin.pdf", asOf: day("2026-08-20"), resultNote: "VÖEN aktivdir" },
      { id: "seed-x-off-3", organizationId: "seed-org-admin", topic: "vergi_borcu", state: "alindi", channel: "sened", source: "Vergi arayışı", document: "vergi-2026-09.pdf", asOf: day("2026-09-28"), resultNote: "Borc yoxdur" },
      { id: "seed-x-off-4", organizationId: "seed-org-admin", topic: "qeydiyyat", state: "alindi", channel: "sened", source: "Dövlət reyestri", document: "reyestr-cixaris.pdf", asOf: day("2026-07-11"), resultNote: "Aktivdir" },
      { id: "seed-x-off-5", organizationId: "seed-org-admin", topic: "muflis", state: "alindi", channel: "sened", source: "Məhkəmə arayışı", document: "muflis-yox.pdf", asOf: day("2026-10-01"), resultNote: "Müflislik qeydi yoxdur" },
      { id: "seed-x-off-6", organizationId: "seed-org-admin", topic: "satinalma", state: "gonderilib", channel: "sened", source: "Satınalma arayışı", document: "satinalma-siyahi.pdf", asOf: day("2026-10-06"), resultNote: "Sənəd göndərilib, cavab gözlənilir" },
      { id: "seed-x-off-7", organizationId: "seed-org-afez", topic: "selahiyyet", state: "alindi", channel: "sened", source: "SIMA sənədi", document: "sima-elvin.pdf", asOf: day("2026-09-02"), resultNote: "Elvin Məmmədovun imza səlahiyyəti var" },
      { id: "seed-x-off-8", organizationId: "seed-org-afez", topic: "qeydiyyat", state: "alindi", channel: "sened", source: "Nizamnamə", document: "nizamname.pdf", asOf: day("2026-01-15"), resultNote: "Aktivdir" },
    ],
  })
  await prisma.coopRequest.createMany({
    data: [
      { id: "seed-x-coop-1", organizationId: "seed-org-admin", company: "Xəzər Alüminium Sistemləri", note: "Pəncərə kataloqunu tender smetasına bağlamaq istəyir", status: "Təhlil olunur" },
      { id: "seed-x-coop-2", organizationId: "seed-org-admin", company: "Abşeron Şüşə", note: "Şüşə paket qiymətini regionlara görə açır", status: "Görüş təyin olunub" },
      { id: "seed-x-coop-3", organizationId: "seed-org-admin", company: "Sahə Montaj", note: "Kran və ekskavator icarəsini kabinetə salmaq istəyir", status: "Təhlil olunur" },
      { id: "seed-x-coop-4", organizationId: "seed-org-admin", company: "Qafqaz PVC Profil", note: "PVC profil kodları standart material siyahısı ilə tutuşdurulur", status: "Sənəd gözlənilir" },
      { id: "seed-x-coop-5", organizationId: "seed-org-admin", company: "Fasad Konstruksiya", note: "Gəncə anbarından çatdırılma şərtini yazır", status: "Qəbul olunub" },
      { id: "seed-x-coop-6", organizationId: "seed-org-afez", company: "Şüşədaşıma Lojistik", note: "Şüşə daşıma marşrutunu sifarişə bağlamaq istəyir", status: "Təhlil olunur" },
    ],
  })

  await prisma.financePartner.create({
    data: {
      id: "seed-ins-2", kind: "sigorta", name: "Xəzər Sığorta", proof: "Tarif 11/2026", proofDate: day("2026-08-01"), light: "tesdiq", api: "bagli",
      products: { create: [{ id: "seed-fp-ins-2", line: "sigorta", name: "Texnika sığortası", terms: "Park üzrə illik", rate: 1.1, termDays: 365, confirmed: true, validUntil: day("2027-08-01") }] },
    },
  })
  await prisma.financePartner.create({
    data: {
      id: "seed-ins-3", kind: "sigorta", name: "Qala Sığorta", proof: "", light: "gozleme", api: "bagli",
      products: { create: [{ id: "seed-fp-ins-3", line: "sigorta", name: "İşçi bədbəxt hadisə", terms: "Siyahı üzrə", rate: 0.4, termDays: 365, confirmed: true, validUntil: day("2027-06-01") }] },
    },
  })
  const apps = [
    ["seed-x-app-1", "seed-org-admin", "seed-ins-1", "seed-fp-3", "Port Baku tikinti riski", 180000, "tesdiq", "Port Baku Residence"],
    ["seed-x-app-2", "seed-org-admin", "seed-ins-2", "seed-fp-ins-2", "Kran və ekskavator parkı", 64000, "teqdim", "Öz texnika"],
    ["seed-x-app-3", "seed-org-admin", "seed-ins-3", "seed-fp-ins-3", "Sahə işçiləri", 22000, "yoxlanir", "86 nəfər"],
    ["seed-x-app-4", "seed-org-admin", "seed-ins-1", "seed-fp-3", "Metro körpüsü", 96000, "qaralama", "Metro Dəmiryol Körpüsü"],
    ["seed-x-app-5", "seed-org-afez", "seed-ins-2", "seed-fp-ins-2", "Mikser və nasos", 28000, "tesdiq", "Beton qovşağı"],
  ]
  for (const [id, organizationId, partnerId, productId, purpose, amount, status, objectName] of apps) {
    await prisma.financeApplication.create({
      data: {
        id, organizationId, partnerId, productId, kind: "sigorta", status, amount, purpose,
        payload: { object: objectName, gear: "kran, ekskavator", workers: "sahə heyəti" },
        packed: true,
        consentAt: day("2026-10-02"),
        events: { create: [{ id: `${id}-e`, status, person: "Günel Rzayeva", note: "Sığorta paketi bazadadır" }] },
      },
    })
  }

  const products = [
    ["seed-x-prd-kafel", "seed-org-boya", "Döşəmə kafeli 60x60", "KAF-60", "Fasad", "m2", 18, 11],
    ["seed-x-prd-panel", "seed-org-fasad", "Sendviç panel 80 mm", "PNL-80", "Fasad", "m2", 54, 36],
    ["seed-x-prd-bor", "seed-org-metal", "Polietilen boru 110", "BOR-110", "Metal", "m", 9.2, 6.1],
    ["seed-x-prd-qum", "seed-org-metal", "Çay qumu", "QUM-1", "Sement", "m3", 28, 16],
    ["seed-x-prd-kabel", "seed-org-alum", "Güc kabeli 4x16", "KBL-16", "Metal", "m", 6.4, 4.2],
    ["seed-x-prd-suvaq", "seed-org-boya", "Suvaq qarışığı", "SUV-1", "Boya", "kisə", 7.5, 4.4],
  ]
  for (const [id, organizationId, name, code, category, unit, price, cost] of products) {
    await prisma.catalogProduct.create({
      data: { id, organizationId, name, code, category, unit, price, cost, validUntil: day("2027-06-01"), minQty: 10, leadDays: 5 },
    })
  }

  const schedules = [
    ["seed-x-sch-port", "seed-prj-port", 2, [
      ["Sahənin hasarlanması", 1, 4, 4],
      ["Qüllə kranının quraşdırılması", 3, 8, 9],
      ["Fasad alt konstruksiya", 6, 22, 25],
      ["Pəncərə montajı", 18, 34, null],
      ["Daş üzlük", 24, 40, null],
      ["Boya və silikon", 36, 48, null],
      ["Məhəccər və balkon", 40, 52, null],
      ["Təhvil-təslim", 50, 58, null],
    ]],
    ["seed-x-sch-biz", "seed-prj-biz", 5, [
      ["Svay və bünövrə", 1, 18, 18],
      ["Zirzəmi divarları", 16, 30, 33],
      ["Karkas, 1–8-ci mərtəbə", 28, 60, null],
      ["Karkas, 9–16-cı mərtəbə", 55, 90, null],
      ["Mühəndis şəbəkələri", 70, 110, null],
      ["Fasad karkası", 100, 130, null],
      ["Lift şaxtası", 80, 120, null],
    ]],
    ["seed-x-sch-metro", "seed-x-prj-metro", 10, [
      ["Dayanacaq lövhəsi", 1, 12, 12],
      ["Körpü dayağı", 10, 40, 42],
      ["Aşırım tiri", 35, 70, null],
      ["Dəmiryol üst quruluşu", 65, 95, null],
      ["Elektrik və işıqlandırma", 85, 110, null],
      ["Sınaq və təhvil", 105, 120, null],
    ]],
    ["seed-x-sch-ag", "seed-x-prj-ag", 3, [
      ["İskele", 1, 6, 6],
      ["İstilik izolyasiyası", 5, 20, 21],
      ["Alüminium alt sistem", 16, 36, null],
      ["Kompozit panel", 30, 52, null],
      ["Pəncərə dəyişmə", 40, 58, null],
      ["Abadlıq", 54, 64, null],
    ]],
    ["seed-x-sch-sum", "seed-prj-sum", 7, [
      ["Metal karkas", 1, 25, 28],
      ["Dam örtüyü", 20, 36, null],
      ["Divar sendviç", 30, 48, null],
      ["Sənaye döşəməsi", 42, 55, null],
      ["Yükləmə estakadası", 50, 62, null],
    ]],
    ["seed-x-sch-gence", "seed-prj-gence", 12, [
      ["Çuxur və svay", 1, 14, null],
      ["Bünövrə plitəsi", 12, 28, null],
      ["Blok A karkası", 26, 55, null],
      ["Blok B karkası", 40, 70, null],
      ["Tibbi qaz xətləri", 60, 84, null],
    ]],
  ]
  for (const [id, projectId, bondDay, tasks] of schedules) {
    await prisma.workSchedule.create({
      data: {
        id,
        organizationId: "seed-org-admin",
        projectId,
        bondDay,
        tasks: {
          create: tasks.map(([name, startDay, endDay, actualEnd], sort) => ({
            id: `${id}-t${sort + 1}`,
            sort: sort + 1,
            name,
            startDay,
            endDay,
            actualEnd,
          })),
        },
      },
    })
  }
  await prisma.weatherProof.createMany({
    data: [
      { id: "seed-x-wproof-port-2", projectId: "seed-prj-port", date: day("2026-10-08"), rain: 84, wind: 6, pouring: true, stop: "Hündürmərtəbəli iş, dam, fasad, açıq beton", officer: "Rauf Hüseynov" },
      { id: "seed-x-wproof-port-3", projectId: "seed-prj-port", date: day("2026-10-09"), rain: 40, wind: 16, pouring: false, stop: "Bütün açıq sahə", officer: "Elşən Qarayev" },
      { id: "seed-x-wproof-biz-1", projectId: "seed-prj-biz", date: day("2026-10-06"), rain: 18, wind: 14, pouring: false, stop: "Kran, fasad, hündürlük", officer: "Rauf Hüseynov" },
      { id: "seed-x-wproof-biz-2", projectId: "seed-prj-biz", date: day("2026-10-07"), rain: 86, wind: 8, pouring: true, stop: "Açıq beton tökmə", officer: "Kamran Əliyev" },
      { id: "seed-x-wproof-metro-1", projectId: "seed-x-prj-metro", date: day("2026-09-28"), rain: 90, wind: 9, pouring: true, stop: "Açıq beton tökmə", officer: "Nigar Əliyeva" },
      { id: "seed-x-wproof-metro-2", projectId: "seed-x-prj-metro", date: day("2026-10-02"), rain: 30, wind: 15, pouring: false, stop: "Bütün açıq sahə", officer: "Vüsal Məlikov" },
      { id: "seed-x-wproof-ag-1", projectId: "seed-x-prj-ag", date: day("2026-10-04"), rain: 82, wind: 5, pouring: false, stop: "Hündürmərtəbəli iş, dam, fasad, açıq beton", officer: "Vüsal Məlikov" },
      { id: "seed-x-wproof-sum-1", projectId: "seed-prj-sum", date: day("2026-10-10"), rain: 22, wind: 13, pouring: false, stop: "Kran, fasad, hündürlük", officer: "Vüsal Məlikov" },
      { id: "seed-x-wproof-gence-1", projectId: "seed-prj-gence", date: day("2026-09-23"), rain: 70, wind: 12, pouring: true, stop: "Kran, fasad, hündürlük", officer: "Nigar Əliyeva" },
    ],
  })
}
