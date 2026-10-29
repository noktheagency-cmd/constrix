import {Controller,Get,Post,Param,Req,Res,StreamableFile,BadRequestException} from '@nestjs/common';
import type {Response} from 'express';
import {AuthUser} from '../auth/auth.service';
import {TenantService} from '../platform/tenant.service';
import {BlobFilesService} from './blob-files.service';
type FileRequest={user:AuthUser;body:unknown;headers:Record<string,string|string[]|undefined>};
@Controller('blob-files')
export class BlobFilesController{
 constructor(private readonly files:BlobFilesService,private readonly tenant:TenantService){}
 @Get() async list(@Req()req:FileRequest){return this.files.list(await this.tenant.load(req.user));}
 @Post() async upload(@Req()req:FileRequest){if(!Buffer.isBuffer(req.body))throw new BadRequestException('Binar fayl göndərilməlidir');let name:string;try{name=decodeURIComponent(String(req.headers['x-file-name']||''))}catch{throw new BadRequestException('Fayl adı düzgün deyil')};return this.files.upload(await this.tenant.load(req.user),req.body,{name,kind:String(req.headers['x-file-kind']||'commercial'),parentId:String(req.headers['x-parent-id']||''),key:String(req.headers['x-upload-key']||'')});}
 @Post(':id/rescan') async rescan(@Req()req:FileRequest,@Param('id')id:string){return this.files.rescan(await this.tenant.load(req.user),id);}
 @Get(':id/download') async download(@Req()req:FileRequest,@Param('id')id:string,@Res({passthrough:true})response:Response){const file=await this.files.download(await this.tenant.load(req.user),id);response.setHeader('Content-Type',file.mime);response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Cache-Control','private, no-store');response.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);return new StreamableFile(Buffer.from(file.original));}
}
