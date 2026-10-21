/** Plantillas de job por companyType. Usado por /app/ y /register. */
window.JOB_TEMPLATES = {
  property_management: {
    sitesLabel: 'Buildings',
    searchPlaceholder: 'Search buildings...',
    jobs: ['SEMI ANNUAL INSPECTION', 'Window inspection', 'Balcony walk', 'INSPECTION', 'MAINTENANCE']
  },
  construction: {
    sitesLabel: 'Clientes/Sitios',
    searchPlaceholder: 'Search sites...',
    jobs: ['Obra nueva', 'Remodelacion', 'Punch list', 'Inspeccion de obra']
  },
  electrical: {
    sitesLabel: 'Clientes/Sitios',
    searchPlaceholder: 'Search sites...',
    jobs: ['Instalacion electrica', 'Reparacion panel', 'Inspeccion electrica', 'Emergencia']
  },
  plumbing: {
    sitesLabel: 'Clientes/Sitios',
    searchPlaceholder: 'Search sites...',
    jobs: ['Fuga agua', 'Instalacion tuberias', 'Destape', 'Inspeccion plomeria']
  },
  hvac: {
    sitesLabel: 'Clientes/Sitios',
    searchPlaceholder: 'Search sites...',
    jobs: ['Instalacion A/C', 'Mantenimiento', 'Reparacion', 'Inspeccion HVAC']
  },
  roofing: {
    sitesLabel: 'Clientes/Sitios',
    searchPlaceholder: 'Search sites...',
    jobs: ['Reparacion techo', 'Inspeccion techo', 'Instalacion', 'Emergencia filtracion']
  },
  cleaning: {
    sitesLabel: 'Clientes/Sitios',
    searchPlaceholder: 'Search sites...',
    jobs: ['Limpieza regular', 'Limpieza profunda', 'Move-out', 'Ventanas']
  },
  other: {
    sitesLabel: 'Clientes/Sitios',
    searchPlaceholder: 'Search sites...',
    jobs: ['Servicio', 'Reparacion', 'Inspeccion', 'Emergencia']
  }
};

window.COMPANY_TYPE_OPTIONS = [
  { id: 'property_management', label: 'Property Management / Condo Inspections' },
  { id: 'construction', label: 'Construcción General' },
  { id: 'electrical', label: 'Electricidad / Electrical' },
  { id: 'plumbing', label: 'Plomería / Plumbing' },
  { id: 'hvac', label: 'HVAC / Aire Acondicionado' },
  { id: 'roofing', label: 'Roofing / Techos' },
  { id: 'cleaning', label: 'Limpieza / Cleaning' },
  { id: 'other', label: 'Otro' }
];
