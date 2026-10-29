import { PrismaClient } from '@prisma/client'

// Additive, repeatable local examples; existing records and stock are untouched.
const prisma = new PrismaClient()
try {
  const org = await prisma.organization.findUnique({ where: { id: 'seed-org-afez' } })
  if (!org) throw new Error('Demo construction organization not found')
  const projects = await prisma.project.findMany({ take: 3, orderBy: { id: 'asc' }, select: { id: true, name: true } })
  if (!projects.length) throw new Error('Projects are required')
  const examples = [
    { key:'armatur', date:'2026-10-21', person:'Rauf Hüseynov', lines:[['Armatur A500 Ø16','ton',12,1120,'Kür Armatur və İnert'],['Bağlama məftili','kq',80,2.5,'Kür Armatur və İnert']] },
    { key:'boya', date:'2026-10-24', person:'Səbinə Əhmədova', lines:[['Fasad boyası ağ','kq',600,4.8,'Azər Boya İstehsalat'],['Astar','kq',120,3.2,'Azər Boya İstehsalat']] },
    { key:'profil', date:'2026-10-27', person:'Elvin Məmmədov', lines:[['Alüminium profil 60 mm','m',450,11.5,'Xəzər Alüminium Sistemləri'],['Şüşə paket 24 mm','m2',40,92,'Abşeron Şüşə']] },
  ]
  const result = await prisma.$transaction(async (tx) => {
    const ids=[]
    for (const [index, item] of examples.entries()) {
      const id=`sample-purchase-act-${item.key}`
      const project=projects[index % projects.length]
      await tx.purchaseAct.upsert({where:{id},update:{},create:{
        id,number:`AA-N${String(index+1).padStart(3,'0')}`,organizationId:org.id,projectId:project.id,project:project.name,objectName:project.name,person:item.person,date:item.date,status:'qaralama',net:item.lines.reduce((sum,line)=>sum+line[2]*line[3],0),note:'Nümunə alış aktı. Anbar qəbulundan əvvəl yoxlanılmalıdır.',
        lines:{create:item.lines.map(([materialName,unit,qty,unitPrice,firmName],sort)=>({id:`${id}-line-${sort}`,sort,materialName,unit,qty,unitPrice,amount:Math.round(qty*unitPrice*100)/100,firmName,sender:item.person,note:''}))},
        ...(index === 0 ? {adjustments:{create:[{id:`${id}-adjust-1`,sort:0,materialName:'Armatur A500 Ø16',unit:'ton',qty:12,unitPrice:1120,amount:13440,diff:5,diffAmount:60,actLabel:'Nümunə qiymət fərqi'}]}} : {}),
      }})
      ids.push(id)
    }
    return ids
  })
  console.log(JSON.stringify({purchaseActs:result.length,ids:result}))
} catch(error) { console.error(error.code || error.message); process.exitCode=1 }
finally { await prisma.$disconnect() }
