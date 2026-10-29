import { PrismaClient } from '@prisma/client'
const p=new PrismaClient()
try {
  const org=await p.organization.findUnique({where:{id:'seed-org-afez'}})
  if(!org) throw new Error('Demo organization not found')
  await p.$transaction(async tx=>{
    for(const [key,name,rate] of [['xezer','Xəzər Risk Sığorta',.65],['abseron','Abşeron Sığorta',.8],['baki','Bakı Təminat Sığorta',.55]]) {
      const id=`sample-insurer-${key}`
      await tx.financePartner.upsert({where:{id},update:{},create:{id,kind:'sigorta',name:`${name} (nümunə)`,note:'İnterfeys üçün nümunə tərəfdaş. Rəsmi kommersiya təklifi deyil.',proof:'Nümunə tərəfdaş kartı',proofDate:new Date('2026-10-01'),light:'tesdiq',contact:'',api:'bagli'}})
      await tx.financeProduct.upsert({where:{id:`sample-cover-${key}`},update:{},create:{id:`sample-cover-${key}`,partnerId:id,line:'sigorta',name:'Tikinti riskləri — nümunə təklif',terms:'Demo məlumatıdır; qüvvədə olan sığorta müqaviləsi deyil.',rate,commission:0,termDays:365,confirmed:true,validUntil:new Date('2027-12-31')}})
    }
    await tx.financePartner.upsert({where:{id:'sample-partner-factor'},update:{},create:{id:'sample-partner-factor',kind:'faktorinq',name:'Tikinti Faktorinq (nümunə)',note:'Debitor maliyyələşdirməsi üzrə nümunə kart',light:'gozleme'}})
    for(const [key,partnerId,amount,purpose,status] of [
      ['port','sample-insurer-xezer',250000,'Port Baku — tikinti riskləri','teqdim'],
      ['gear','sample-insurer-abseron',120000,'Sahə texnikası','yoxlanir'],
      ['workers','sample-insurer-baki',75000,'İşçi heyətinin sığortası','elave'],
      ['villa','sample-insurer-xezer',180000,'Villa qrupu — obyekt sığortası','qaralama'],
    ]) {
      const id=`sample-insurance-${key}`
      await tx.financeApplication.upsert({where:{id},update:{},create:{id,organizationId:org.id,partnerId,kind:'sigorta',status,amount,purpose:`${purpose} (nümunə)`,payload:{sample:true,object:purpose},events:{create:{id:`${id}-event`,status,person:'Nümunə qeydi',note:'Demo məlumatıdır. Sığortaçıya müraciət göndərilməyib.',at:new Date('2026-10-27T09:00:00Z')}}}})
    }
  })
  for(const [key,name,rate,on] of [
    ['xidmet','Xidmət üzrə nümunə qayda',7.5,'2026-10-01'],
    ['guzest','Güzəşt üzrə nümunə qayda',5,'2026-10-15'],
    ['sifir','Sıfır dərəcəli nümunə qayda',0,'2026-10-20'],
  ]) await p.taxRule.upsert({where:{id:`sample-tax-${key}`},update:{},create:{id:`sample-tax-${key}`,code:`numune_${key}`,name,rate,effectiveOn:new Date(on),note:'Yalnız interfeys nümunəsidir. Rəsmi vergi dərəcəsi deyil; mühasib yoxlamalıdır.'}})
  console.log(JSON.stringify({samplePartners:4,sampleProducts:3,sampleApplications:4,sampleTaxRules:3}))
}catch(e){console.error(e.code || e.message);process.exitCode=1}finally{await p.$disconnect()}
