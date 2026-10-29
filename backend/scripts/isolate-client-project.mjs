import {readFileSync,writeFileSync} from 'node:fs';
for(const [folder,plural,singular,dto] of [['clients','clients','client','CreateClientDto'],['projects','projects','project','CreateProjectDto']]){
 const file=`src/${folder}/${plural}.controller.ts`;
 let s=readFileSync(file,'utf8').replace('  Post,','  Post,\n  Req,');
 s=`import { AuthUser } from '../auth/auth.service';\n`+s;
 s=s.replace('findAll() {','findAll(@Req() req:{user:AuthUser}) {').replace(`this.${plural}.findAll()`,`this.${plural}.findAll(req.user)`);
 for(const method of ['findOne','procedures','remove']){
  s=s.replace(`${method}(@Param('id') id: string) {`,`${method}(@Param('id') id: string,@Req() req:{user:AuthUser}) {`).replace(`this.${plural}.${method}(id)`,`this.${plural}.${method}(id,req.user)`);
 }
 s=s.replace(`create(@Body() dto: ${dto}) {`,`create(@Body() dto: ${dto},@Req() req:{user:AuthUser}) {`).replace(`this.${plural}.create(dto)`,`this.${plural}.create(dto,req.user)`);
 const updateDto=dto.replace('Create','Update');
 s=s.replace(`update(@Param('id') id: string, @Body() dto: ${updateDto}) {`,`update(@Param('id') id: string, @Body() dto: ${updateDto},@Req() req:{user:AuthUser}) {`).replace(`this.${plural}.update(id, dto)`,`this.${plural}.update(id, dto,req.user)`);
 writeFileSync(file,s);
 const sf=`src/${folder}/${plural}.service.ts`;s=readFileSync(sf,'utf8');
 s=`import { AuthUser } from '../auth/auth.service';\nimport { TenantDataService } from '../prisma/tenant-data.service';\n`+s;
 s=s.replace('constructor(private readonly prisma: PrismaService) {}','constructor(private readonly prisma: PrismaService,private readonly scope:TenantDataService) {}');
 s=s.replace('async findAll():', 'async findAll(user:AuthUser):').replace('async procedures(id: string)', 'async procedures(id: string,user:AuthUser)').replace('async findOne(id: string):','async findOne(id: string,user:AuthUser):').replace('async findRecord(id: string):','async findRecord(id: string,user:AuthUser):').replace(`async create(dto: ${dto}):`,`async create(dto: ${dto},user:AuthUser):`).replace(`async update(id: string, dto: ${updateDto}):`,`async update(id: string, dto: ${updateDto},user:AuthUser):`).replace('async remove(id: string):','async remove(id: string,user:AuthUser):');
 s=s.replaceAll('this.findOne(id)','this.findOne(id,user)').replaceAll('this.findRecord(id)','this.findRecord(id,user)');
 s=s.replaceAll('where: { id },','where: { id,organizationId:await this.scope.org(user) },');
 s=s.replace(`this.prisma.${singular}.findMany({`,`this.prisma.${singular}.findMany({\n      where:{organizationId:await this.scope.org(user)},`);
 s=s.replace('...(dto.id ? { id: dto.id } : {}),','...(dto.id ? { id: dto.id } : {}),\n          organizationId:await this.scope.org(user),');
 if(singular==='project'){
  s=s.replaceAll('where: { name: dto.client }','where: { name: dto.client,organizationId:await this.scope.org(user) }');
  s=s.replaceAll('this.prisma.client.findUnique','this.prisma.client.findFirst');
  s=s.replace('    const client = await this.prisma.client.findFirst({','    if(dto.smetaId)await this.scope.requireOwned("smeta",dto.smetaId,await this.scope.org(user));\n    const client = await this.prisma.client.findFirst({');
  s=s.replace('    await this.findOne(id,user);','    await this.findOne(id,user);\n    if(dto.smetaId)await this.scope.requireOwned("smeta",dto.smetaId,await this.scope.org(user));',1);
 }
 writeFileSync(sf,s);
}
