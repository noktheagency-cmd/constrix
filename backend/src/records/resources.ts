export type ChildSpec = {
  field: string;
  foreignKey: string;
};

export type ResourceSpec = {
  route: string;
  delegate: string;
  children?: ChildSpec[];
};

export const resources: ResourceSpec[] = [
  { route: 'users', delegate: 'user' },
  { route: 'crews', delegate: 'crew' },
  { route: 'leads', delegate: 'lead' },
  { route: 'deals', delegate: 'deal' },
  { route: 'tasks', delegate: 'crmTask' },
  { route: 'files', delegate: 'crmFile' },
  { route: 'activities', delegate: 'crmActivity' },
  { route: 'invoices', delegate: 'invoice' },
  { route: 'expenses', delegate: 'expense' },
  { route: 'payables', delegate: 'payable' },
  { route: 'suppliers', delegate: 'supplier' },
  { route: 'quotes', delegate: 'quote' },
  {
    route: 'smetas',
    delegate: 'smeta',
    children: [{ field: 'lines', foreignKey: 'smetaId' }],
  },
  {
    route: 'contracts',
    delegate: 'contract',
    children: [{ field: 'schedule', foreignKey: 'contractId' }],
  },
  {
    route: 'acts',
    delegate: 'act',
    children: [{ field: 'lines', foreignKey: 'actId' }],
  },
  {
    route: 'forma3',
    delegate: 'forma3',
    children: [{ field: 'lines', foreignKey: 'forma3Id' }],
  },
  {
    route: 'reports',
    delegate: 'dailyReport',
    children: [
      { field: 'lines', foreignKey: 'reportId' },
      { field: 'machines', foreignKey: 'reportId' },
      { field: 'attendance', foreignKey: 'reportId' },
    ],
  },
  { route: 'documents', delegate: 'document' },
  {
    route: 'changes',
    delegate: 'changeOrder',
    children: [{ field: 'lines', foreignKey: 'changeId' }],
  },
  { route: 'locations', delegate: 'location' },
  { route: 'materials', delegate: 'material' },
  { route: 'stocks', delegate: 'stock' },
  { route: 'movements', delegate: 'movement' },
  {
    route: 'shipments',
    delegate: 'shipment',
    children: [{ field: 'lines', foreignKey: 'shipmentId' }],
  },
  { route: 'purchase-orders', delegate: 'purchaseOrder' },
  {
    route: 'purchase-acts',
    delegate: 'purchaseAct',
    children: [
      { field: 'lines', foreignKey: 'actId' },
      { field: 'adjustments', foreignKey: 'actId' },
    ],
  },
  { route: 'requests', delegate: 'materialRequest' },
  {
    route: 'recipes',
    delegate: 'recipe',
    children: [{ field: 'items', foreignKey: 'recipeId' }],
  },
  { route: 'plants', delegate: 'plant' },
  {
    route: 'work-orders',
    delegate: 'workOrder',
    children: [{ field: 'issued', foreignKey: 'orderId' }],
  },
  { route: 'assets', delegate: 'asset' },
  { route: 'drivers', delegate: 'driver' },
  { route: 'trips', delegate: 'trip' },
  { route: 'fuels', delegate: 'fuelFill' },
  { route: 'fleet-docs', delegate: 'fleetDoc' },
  { route: 'gear', delegate: 'gear' },
  { route: 'gear-events', delegate: 'gearEvent' },
  { route: 'services', delegate: 'serviceJob' },
  { route: 'people', delegate: 'person' },
  { route: 'offices', delegate: 'office' },
  { route: 'departments', delegate: 'department' },
  { route: 'terminals', delegate: 'terminal' },
  { route: 'attendance', delegate: 'attendance' },
  { route: 'leaves', delegate: 'leaveRequest' },
  { route: 'hr-payments', delegate: 'hrPayment' },
  { route: 'hr-moves', delegate: 'hrMove' },
  {
    route: 'payrolls',
    delegate: 'payroll',
    children: [{ field: 'lines', foreignKey: 'payrollId' }],
  },
  { route: 'journal', delegate: 'journalEntry' },
  { route: 'audit', delegate: 'auditEntry' },
  { route: 'periods', delegate: 'closedPeriod' },
  { route: 'companies', delegate: 'subCompany' },
  { route: 'complexes', delegate: 'complex' },
  { route: 'buildings', delegate: 'building' },
  { route: 'units', delegate: 'unit' },
  { route: 'buyers', delegate: 'buyer' },
  {
    route: 'sale-contracts',
    delegate: 'saleContract',
    children: [{ field: 'schedule', foreignKey: 'contractId' }],
  },
];
