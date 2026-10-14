import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { createResourceController } from './resource.controller';
import { RecordsService } from './records.service';
import { resources } from './resources';

@Module({
  controllers: [
    CatalogController,
    ...resources.map((resource) => createResourceController(resource)),
  ],
  providers: [RecordsService],
})
export class RecordsModule {}
