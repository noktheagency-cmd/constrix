import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { createResourceController } from './resource.controller';
import { RecordsService } from './records.service';
import { resources } from './resources';
import {ActWorkflowsService} from './act-workflows.service';
import {ActWorkflowsController} from './act-workflows.controller';

@Module({
  controllers: [
    CatalogController,
    ActWorkflowsController,
    ...resources.map((resource) => createResourceController(resource)),
  ],
  providers: [RecordsService,ActWorkflowsService],
})
export class RecordsModule {}
