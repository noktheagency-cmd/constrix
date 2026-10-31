export type Role =
  | 'director'
  | 'pm'
  | 'site'
  | 'warehouse'
  | 'procurement'
  | 'accountant'
  | 'sales';

export type Area =
  | 'dashboard'
  | 'projects'
  | 'reports'
  | 'site'
  | 'assets'
  | 'production'
  | 'people'
  | 'finance'
  | 'audit'
  | 'warehouse'
  | 'supply'
  | 'crm'
  | 'clients'
  | 'acts';

const ACCESS: Record<Role, Area[] | ['*']> = {
  director: ['*'],
  pm: [
    'dashboard',
    'projects',
    'reports',
    'site',
    'assets',
    'production',
    'people',
    'finance',
    'audit',
    'clients',
    'acts',
  ],
  site: ['site', 'reports', 'projects', 'assets'],
  warehouse: ['warehouse', 'supply', 'reports'],
  procurement: ['supply', 'warehouse', 'dashboard'],
  accountant: ['finance', 'dashboard', 'audit', 'projects', 'acts'],
  sales: ['crm', 'clients', 'dashboard'],
};

export const ROUTE_AREAS: Record<string, Area | Area[]> = {
  'blob-files':['dashboard','supply','finance','acts','people','reports','projects','assets','production','crm'],
  market:['dashboard','supply','finance','acts','people','reports','projects','assets','production','crm'],
  'act-workflows':['acts','supply'],
  'request-workflows':['supply','warehouse'],
  'shipment-workflows':['warehouse','site'],
  clients: 'clients',
  projects: 'projects',
  leads: 'crm',
  deals: 'crm',
  tasks: 'crm',
  files: 'crm',
  activities: 'crm',
  companies: 'crm',
  complexes: 'crm',
  buildings: 'crm',
  units: 'crm',
  buyers: 'crm',
  'sale-contracts': 'crm',
  invoices: 'finance',
  expenses: 'finance',
  payables: 'finance',
  periods: 'finance',
  payrolls: ['people', 'finance'],
  suppliers: 'supply',
  quotes: 'supply',
  'purchase-orders': 'supply',
  'purchase-acts': 'supply',
  requests: ['supply', 'warehouse'],
  smetas: ['acts', 'projects'],
  contracts: ['acts', 'projects'],
  acts: 'acts',
  forma3: 'acts',
  reports: 'reports',
  documents: 'projects',
  changes: 'projects',
  journal: ['reports', 'site'],
  locations: 'warehouse',
  'warehouse-reconciliation': 'warehouse',
  materials: 'warehouse',
  stocks: 'warehouse',
  movements: 'warehouse',
  shipments: ['warehouse','site'],
  recipes: 'production',
  plants: 'production',
  'work-orders': 'production',
  assets: 'assets',
  drivers: 'assets',
  trips: 'assets',
  fuels: 'assets',
  'fleet-docs': 'assets',
  gear: 'assets',
  'gear-events': 'assets',
  services: 'assets',
  people: 'people',
  crews: 'people',
  offices: 'people',
  departments: 'people',
  terminals: 'people',
  attendance: 'people',
  leaves: 'people',
  'hr-payments': 'people',
  'hr-moves': 'people',
  audit: 'audit',
};

export function isRole(value: string): value is Role {
  return value in ACCESS;
}

export function can(role: Role, area: Area | Area[]) {
  const list = ACCESS[role];
  if (!list) return false;
  if (list[0] === '*') return true;
  const areas = Array.isArray(area) ? area : [area];
  return areas.some((item) => (list as Area[]).includes(item));
}
