import { ProjectMaterialPlanController } from './project-material-plan.controller';
import { ProjectMaterialPlanService } from './project-material-plan.service';
import { WarehouseControlController } from './warehouse-control.controller';
import { WarehouseControlService } from './warehouse-control.service';
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
import { MaterialHandoverController } from './material-handover.controller';
import { MaterialHandoverService } from './material-handover.service';
import { ReturnablePackagingController } from './returnable-packaging.controller';
import { ReturnablePackagingService } from './returnable-packaging.service';
import { SupplierGoodsReturnController } from './supplier-goods-return.controller';
import { SupplierGoodsReturnService } from './supplier-goods-return.service';

@Module({
  controllers: [
    CatalogController,
    ProjectMaterialPlanController,
    WarehouseControlController,
    ActWorkflowsController,
    WarehouseReconciliationController,
    RequestWorkflowsController,
    ShipmentWorkflowsController,
    MaterialHandoverController,
    ReturnablePackagingController,
    SupplierGoodsReturnController,
    ...resources.map((resource) => createResourceController(resource)),
  ],
  providers: [ProjectMaterialPlanService,WarehouseControlService,RecordsService,ActWorkflowsService,WarehouseReconciliationService,RequestWorkflowsService,ShipmentWorkflowsService,MaterialHandoverService,ReturnablePackagingService,SupplierGoodsReturnService],
})
export class RecordsModule {}
