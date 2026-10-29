import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Type,
  Req,
} from '@nestjs/common';
import { AuthUser } from '../auth/auth.service';
import { RecordsService } from './records.service';
import { ResourceSpec } from './resources';

export function createResourceController(spec: ResourceSpec): Type<unknown> {
  @Controller(spec.route)
  class ResourceController {
    constructor(@Inject(RecordsService) readonly records: RecordsService) {}

    @Get()
    findAll(@Req() req:{user:AuthUser}) {
      return this.records.findAll(spec,req.user);
    }

    @Get(':id')
    findOne(@Param('id') id: string,@Req() req:{user:AuthUser}) {
      return this.records.findOne(spec, id,req.user);
    }

    @Post()
    create(@Body() body: Record<string, unknown>,@Req() req:{user:AuthUser}) {
      return this.records.create(spec, body,req.user);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() body: Record<string, unknown>,@Req() req:{user:AuthUser}) {
      return this.records.update(spec, id, body,req.user);
    }

    @Delete(':id')
    @HttpCode(204)
    remove(@Param('id') id: string,@Req() req:{user:AuthUser}) {
      return this.records.remove(spec, id,req.user);
    }
  }

  Object.defineProperty(ResourceController, 'name', {
    value: `${spec.delegate}Controller`,
  });
  return ResourceController;
}
