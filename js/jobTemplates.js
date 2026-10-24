/** Plantillas de job por companyType. Usado por /app/ y /register. */
window.JOB_TEMPLATES = {
  property_management: {
    sitesLabel: 'Edificios',
    searchPlaceholder: 'Buscar edificios…',
    jobs: ['Walkthrough', 'SEMI ANNUAL INSPECTION', 'Window inspection', 'Balcony walk', 'INSPECTION', 'MAINTENANCE']
  },
  maintenance: {
    sitesLabel: 'Sitios',
    searchPlaceholder: 'Buscar sitios…',
    jobs: ['MAINTENANCE', 'Reparacion', 'INSPECTION']
  },
  cleaning: {
    sitesLabel: 'Sitios',
    searchPlaceholder: 'Buscar sitios…',
    jobs: ['Limpieza regular', 'Limpieza profunda', 'Move-out', 'Ventanas']
  },
  inspections: {
    sitesLabel: 'Edificios',
    searchPlaceholder: 'Buscar edificios…',
    jobs: ['Walkthrough', 'INSPECTION', 'SEMI ANNUAL INSPECTION', 'Window inspection']
  },
  landscaping: {
    sitesLabel: 'Sitios',
    searchPlaceholder: 'Buscar sitios…',
    jobs: ['Jardineria', 'Exteriores', 'Mantenimiento']
  },
  technical: {
    sitesLabel: 'Sitios',
    searchPlaceholder: 'Buscar sitios…',
    jobs: ['Servicio tecnico', 'Reparacion', 'INSPECTION']
  },
  other: {
    sitesLabel: 'Sitios',
    searchPlaceholder: 'Buscar sitios…',
    jobs: ['Servicio', 'Reparacion', 'INSPECTION']
  },
  construction: {
    sitesLabel: 'Sitios',
    searchPlaceholder: 'Buscar sitios…',
    jobs: ['Obra nueva', 'Remodelacion', 'Punch list', 'Inspeccion de obra']
  },
  electrical: {
    sitesLabel: 'Sitios',
    searchPlaceholder: 'Buscar sitios…',
    jobs: ['Instalacion electrica', 'Reparacion panel', 'Inspeccion electrica', 'Emergencia']
  },
  plumbing: {
    sitesLabel: 'Sitios',
    searchPlaceholder: 'Buscar sitios…',
    jobs: ['Fuga agua', 'Instalacion tuberias', 'Destape', 'Inspeccion plomeria']
  },
  hvac: {
    sitesLabel: 'Sitios',
    searchPlaceholder: 'Buscar sitios…',
    jobs: ['Instalacion A/C', 'Mantenimiento', 'Reparacion', 'Inspeccion HVAC']
  },
  roofing: {
    sitesLabel: 'Sitios',
    searchPlaceholder: 'Buscar sitios…',
    jobs: ['Reparacion techo', 'Inspeccion techo', 'Instalacion', 'Emergencia filtracion']
  }
};

window.COMPANY_TYPE_OPTIONS = [
  { id: 'property_management', label: 'Administración de propiedades' },
  { id: 'maintenance', label: 'Mantenimiento y reparaciones' },
  { id: 'cleaning', label: 'Limpieza' },
  { id: 'inspections', label: 'Inspecciones' },
  { id: 'landscaping', label: 'Jardinería y exteriores' },
  { id: 'technical', label: 'Servicios técnicos' },
  { id: 'construction', label: 'Construcción' },
  { id: 'electrical', label: 'Electricidad' },
  { id: 'plumbing', label: 'Plomería' },
  { id: 'hvac', label: 'Aire acondicionado (HVAC)' },
  { id: 'roofing', label: 'Techos' },
  { id: 'other', label: 'Otra' }
];
