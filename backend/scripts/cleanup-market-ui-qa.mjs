import {PrismaClient} from '@prisma/client';
import {readFileSync,unlinkSync,existsSync} from 'node:fs';
const metadata='.local-backups/market-ui-schema.json';
if(existsSync(metadata)){
 const {schema}=JSON.parse(readFileSync(metadata,'utf8'));
 if(!/^market_qa_[a-f0-9]{32}$/.test(schema))throw new Error('Refusing to clean an unexpected schema');
 const db=new PrismaClient();try{await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);unlinkSync(metadata);console.log('Isolated Market UI QA schema removed');}finally{await db.$disconnect();}
}
