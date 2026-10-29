import {PrismaClient} from '@prisma/client';
const p=new PrismaClient();
try {
 const columns=await p.$queryRaw`SELECT table_name,column_name,data_type,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('SmetaLine','PurchaseAct','PurchaseActLine','PurchaseActAdjust') ORDER BY table_name,ordinal_position`;
 const indexes=await p.$queryRaw`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename IN ('SmetaLine','PurchaseAct','PurchaseActLine','PurchaseActAdjust')`;
 const foreign=await p.$queryRaw`SELECT conname FROM pg_constraint WHERE conname IN ('PurchaseActLine_actId_fkey','PurchaseActAdjust_actId_fkey')`;
 console.log(JSON.stringify({columns,indexes,foreign}));
}finally{await p.$disconnect();}
