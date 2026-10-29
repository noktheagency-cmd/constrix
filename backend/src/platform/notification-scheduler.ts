import {Injectable,Logger,OnModuleInit,OnApplicationShutdown} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {MarketService} from './market.service';
@Injectable()
export class NotificationScheduler implements OnModuleInit,OnApplicationShutdown{
 private timer:NodeJS.Timeout|undefined;private running=false;private readonly logger=new Logger(NotificationScheduler.name);
 private state={running:false,lastStartedAt:null as string|null,lastCompletedAt:null as string|null,organizations:0,created:0,failed:0};
 constructor(private readonly prisma:PrismaService,private readonly market:MarketService){}
 onModuleInit(){this.timer=setInterval(()=>void this.run(),15*60*1000);this.timer.unref();void this.run();}
 onApplicationShutdown(){if(this.timer)clearInterval(this.timer);}
 status(){return {...this.state,intervalMinutes:15,externalDelivery:'awaiting_provider'};}
 async run(){
  if(this.running)return this.status();this.running=true;this.state={...this.state,running:true,lastStartedAt:new Date().toISOString(),organizations:0,created:0,failed:0};
  try{
   const organizations=await this.prisma.marketCharge.groupBy({by:['organizationId']});
   for(const row of organizations){try{const result=await this.market.reminders({orgId:row.organizationId,accountId:'system-notifications',kind:null,seat:'direktor',email:'',name:'Bildiriş planlayıcısı',accountRole:'system'});this.state.created+=result.created;this.state.organizations++;}catch(error){this.state.failed++;this.logger.error(`Notification run failed for one organization: ${error instanceof Error?error.name:'unknown'}`);}}
   this.state.lastCompletedAt=new Date().toISOString();
  }catch(error){this.state.failed++;this.logger.error(`Notification scheduler unavailable: ${error instanceof Error?error.name:'unknown'}`);}
  finally{this.running=false;this.state.running=false;}
  return this.status();
 }
}
