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
} from '@nestjs/common';
import { RecordsService } from './records.service';
import { ResourceSpec } from './resources';

export function createResourceController(spec: ResourceSpec): Type<unknown> {
  @Controller(spec.route)
  class ResourceController {
    constructor(@Inject(RecordsService) readonly records: RecordsService) {}

    @Get()
    findAll() {
      return this.records.findAll(spec);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
      return this.records.findOne(spec, id);
    }

    @Post()
    create(@Body() body: Record<string, unknown>) {
      return this.records.create(spec, body);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
      return this.records.update(spec, id, body);
    }

    @Delete(':id')
    @HttpCode(204)
    remove(@Param('id') id: string) {
      return this.records.remove(spec, id);
    }
  }

  Object.defineProperty(ResourceController, 'name', {
    value: `${spec.delegate}Controller`,
  });
  return ResourceController;
}
