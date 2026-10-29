import {ConflictException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {PrismaService} from './prisma.service';
export async function serializable<T>(prisma:PrismaService,work:(tx:Prisma.TransactionClient)=>Promise<T>,timeout=30000):Promise<T>{
 for(let attempt=0;attempt<3;attempt++){
  try{return await prisma.$transaction(work,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout,maxWait:15000});}
  catch(error){const code=(error as {code?:string})?.code;if(!['P2034','P2002'].includes(code||''))throw error;if(attempt===2)throw new ConflictException('Paralel dəyişiklik aşkarlandı. Məlumatı yeniləyib eyni əməliyyat açarı ilə təkrar yoxlayın.');}
 }
 throw new ConflictException('Əməliyyat tamamlanmadı');
}
