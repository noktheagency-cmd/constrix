import { AuthUser } from '../auth/auth.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  findAll(@Req() req:{user:AuthUser}) {
    return this.clients.findAll(req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string,@Req() req:{user:AuthUser}) {
    return this.clients.findOne(id,req.user);
  }

  @Post()
  create(@Body() dto: CreateClientDto,@Req() req:{user:AuthUser}) {
    return this.clients.create(dto,req.user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto,@Req() req:{user:AuthUser}) {
    return this.clients.update(id, dto,req.user);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string,@Req() req:{user:AuthUser}) {
    return this.clients.remove(id,req.user);
  }
}
