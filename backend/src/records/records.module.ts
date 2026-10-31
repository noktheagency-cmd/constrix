import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { createResourceController } from './resource.controller';
import { RecordsService } from './records.service';
import { resources } from './resources';
import {ActWorkflowsService} from './act-workflows.service';
import {ActWorkflowsController} from './act-workflows.controller';
import { WarehouseReconciliationController } from './warehouse-reconciliation.controller';
import { WarehouseReconciliationService } from './warehouse-reconciliation.service';
import { RequestWorkflowsController } from './request-workflows.controller';
import { RequestWorkflowsService } from './request-workflows.service';
import { ShipmentWorkflowsController } from './shipment-workflows.controller';
import { ShipmentWorkflowsService } from './shipment-workflows.service';

@Module({
  controllers: [
    CatalogController,
    ActWorkflowsController,
    WarehouseReconciliationController,
    RequestWorkflowsController,
    ShipmentWorkflowsController,
    ...resources.map((resource) => createResourceController(resource)),
  ],
  providers: [RecordsService,ActWorkflowsService,WarehouseReconciliationService,RequestWorkflowsService,ShipmentWorkflowsService],
})
export class RecordsModule {}
