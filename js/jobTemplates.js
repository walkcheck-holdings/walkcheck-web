/**
 * Trade packs: everything a company gets automatically from the trade it picks
 * when it signs up. Used by /register, the company panel and the worker panel.
 *
 *  jobs      job types (names are also the price keys in Billing: never rename
 *            an existing one, or companies lose the price they set for it)
 *  steps     what the tech checks off on site (jobSteps overrides per job type)
 *  photos    what the BEFORE and AFTER photos should show
 *  materials quick picks for field expenses
 *  unit      how this trade usually charges (shown next to Qty on invoices)
 *  group     section in the sign-up list
 */
(function () {
  var P = {
    // ---------- Propiedades y mantenimiento ----------
    property_management: {
      group: 'props', sitesLabel: 'Edificios', unit: 'visita',
      jobs: ['Walkcheck', 'SEMI ANNUAL INSPECTION', 'Window inspection', 'Balcony walk', 'INSPECTION', 'MAINTENANCE'],
      steps: ['Revisar el área indicada', 'Documentar problemas con fotos', 'Hacer el trabajo o anotar lo que falta', 'Dejar el área limpia'],
      photos: { before: 'El problema o el área antes', after: 'Cómo quedó' },
      materials: ['Bombillos', 'Pintura de retoque', 'Silicón', 'Baterías detector de humo', 'Filtros de A/C', 'Tornillería']
    },
    maintenance: {
      group: 'props', sitesLabel: 'Sitios', unit: 'hora',
      jobs: ['MAINTENANCE', 'Reparacion', 'INSPECTION'],
      steps: ['Confirmar el problema con el cliente', 'Hacer la reparación', 'Probar que funciona', 'Limpiar el área'],
      photos: { before: 'El daño antes de reparar', after: 'La reparación terminada' },
      materials: ['Tornillería', 'Silicón', 'Pintura', 'Piezas de repuesto', 'Cinta', 'Masilla']
    },
    handyman: {
      group: 'props', sitesLabel: 'Propiedades', unit: 'hora',
      jobs: ['Reparación general', 'Montaje', 'Instalación de accesorios', 'Pequeños arreglos'],
      steps: ['Confirmar la lista de arreglos', 'Hacer cada arreglo', 'Probar y mostrar al cliente', 'Recoger y limpiar'],
      photos: { before: 'Cada arreglo antes', after: 'Cada arreglo terminado' },
      materials: ['Tornillería', 'Anclajes', 'Silicón', 'Masilla', 'Pintura', 'Herrajes']
    },
    cleaning: {
      group: 'props', sitesLabel: 'Propiedades', unit: 'visita',
      jobs: ['Limpieza regular', 'Limpieza profunda', 'Move-out', 'Ventanas'],
      steps: ['Cocina', 'Baños', 'Cuartos', 'Pisos (barrer y trapear)', 'Sacar la basura', 'Revisión final'],
      photos: { before: 'Las áreas sucias', after: 'Las áreas limpias' },
      materials: ['Productos de limpieza', 'Bolsas de basura', 'Toallas', 'Guantes', 'Desinfectante']
    },
    inspections: {
      group: 'props', sitesLabel: 'Edificios', unit: 'visita',
      jobs: ['Walkcheck', 'INSPECTION', 'SEMI ANNUAL INSPECTION', 'Window inspection'],
      steps: ['Recorrer todas las áreas', 'Anotar cada problema con su ubicación', 'Fotos de cerca de cada problema', 'Marcar lo urgente'],
      photos: { before: 'Cada problema encontrado', after: 'Vista general de cada área' },
      materials: []
    },
    pest_control: {
      group: 'props', sitesLabel: 'Propiedades', unit: 'visita',
      jobs: ['Fumigación general', 'Control de termitas', 'Roedores', 'Servicio mensual'],
      steps: ['Inspeccionar las áreas con plaga', 'Aplicar el tratamiento', 'Poner trampas o estaciones', 'Explicar al cliente los cuidados'],
      photos: { before: 'Señales de plaga', after: 'Tratamiento y trampas puestas' },
      materials: ['Insecticida', 'Cebos', 'Trampas', 'Estaciones de roedores', 'Equipo de protección']
    },
    pressure_washing: {
      group: 'props', sitesLabel: 'Propiedades', unit: 'pie²',
      jobs: ['Lavado a presión', 'Techos y paredes', 'Aceras y entradas', 'Parqueos'],
      steps: ['Proteger plantas y ventanas', 'Aplicar el producto', 'Lavar a presión', 'Enjuagar y revisar'],
      photos: { before: 'Superficie sucia', after: 'Superficie limpia' },
      materials: ['Químico de limpieza', 'Gasolina', 'Boquillas', 'Mangueras']
    },
    pools: {
      group: 'props', sitesLabel: 'Propiedades', unit: 'visita',
      jobs: ['Mantenimiento de piscina', 'Limpieza profunda', 'Reparación de bomba', 'Balance químico'],
      steps: ['Medir químicos', 'Limpiar cesta y filtro', 'Aspirar y cepillar', 'Ajustar químicos', 'Revisar la bomba'],
      photos: { before: 'El agua y la piscina antes', after: 'La piscina limpia' },
      materials: ['Cloro', 'Ácido', 'Tabletas', 'Filtro', 'Clarificador']
    },
    landscaping: {
      group: 'props', sitesLabel: 'Propiedades', unit: 'visita',
      jobs: ['Jardineria', 'Exteriores', 'Mantenimiento'],
      jobSteps: {
        Jardineria: ['Cortar la grama', 'Bordear', 'Podar arbustos', 'Soplar aceras', 'Recoger y botar los restos']
      },
      steps: ['Cortar la grama', 'Bordear', 'Soplar aceras y entradas', 'Recoger los restos'],
      photos: { before: 'El jardín antes', after: 'El jardín terminado' },
      materials: ['Gasolina', 'Hilo de bordeadora', 'Abono', 'Mulch', 'Plantas', 'Bolsas']
    },
    technical: {
      group: 'props', sitesLabel: 'Sitios', unit: 'hora',
      jobs: ['Servicio tecnico', 'Reparacion', 'INSPECTION'],
      steps: ['Diagnosticar el problema', 'Reparar o instalar', 'Probar que funciona', 'Explicar al cliente'],
      photos: { before: 'El equipo antes', after: 'El equipo funcionando' },
      materials: ['Piezas de repuesto', 'Cables', 'Conectores', 'Cinta']
    },
    locksmith: {
      group: 'props', sitesLabel: 'Propiedades', unit: 'visita',
      jobs: ['Apertura', 'Cambio de cerradura', 'Copia de llaves', 'Rekey'],
      steps: ['Confirmar quién autoriza', 'Hacer el trabajo', 'Probar con la llave nueva', 'Entregar las llaves'],
      photos: { before: 'La cerradura antes', after: 'La cerradura nueva' },
      materials: ['Cerradura', 'Cilindro', 'Llaves', 'Pines']
    },

    // ---------- Construcción y oficios ----------
    construction: {
      group: 'build', sitesLabel: 'Obras', unit: 'trabajo',
      jobs: ['Obra nueva', 'Remodelacion', 'Punch list', 'Inspeccion de obra'],
      steps: ['Revisar planos o alcance', 'Preparar el área', 'Hacer la etapa del día', 'Limpiar y asegurar la obra'],
      photos: { before: 'El área antes de empezar', after: 'El avance del día' },
      materials: ['Madera', 'Cemento', 'Tornillería', 'Drywall', 'Alquiler de equipo']
    },
    remodeling: {
      group: 'build', sitesLabel: 'Obras', unit: 'trabajo',
      jobs: ['Remodelación de cocina', 'Remodelación de baño', 'Gabinetes', 'Topes (countertops)'],
      steps: ['Proteger pisos y muebles', 'Demoler lo viejo', 'Instalar lo nuevo', 'Terminaciones', 'Limpieza final'],
      photos: { before: 'La cocina o el baño antes', after: 'El trabajo terminado' },
      materials: ['Gabinetes', 'Topes', 'Losas', 'Grifería', 'Silicón']
    },
    concrete: {
      group: 'build', sitesLabel: 'Obras', unit: 'pie²',
      jobs: ['Aceras', 'Parqueos', 'Entradas (driveway)', 'Losas', 'Reparación de grietas', 'Sellado y líneas de parqueo'],
      steps: ['Marcar y medir el área', 'Excavar y nivelar', 'Formaletas y malla', 'Fundir el concreto', 'Terminado y curado'],
      photos: { before: 'El área o las grietas antes', after: 'El concreto terminado' },
      materials: ['Concreto', 'Malla', 'Varilla', 'Formaletas', 'Alquiler de equipo', 'Sellador']
    },
    masonry: {
      group: 'build', sitesLabel: 'Obras', unit: 'pie²',
      jobs: ['Muros de bloque', 'Pavers', 'Piedra decorativa', 'Reparación de muro'],
      steps: ['Medir y marcar', 'Preparar la base', 'Colocar bloques o piedra', 'Juntas y limpieza'],
      photos: { before: 'El área antes', after: 'El muro o los pavers terminados' },
      materials: ['Bloques', 'Pavers', 'Arena', 'Cemento', 'Mortero']
    },
    drywall: {
      group: 'build', sitesLabel: 'Obras', unit: 'pie²',
      jobs: ['Instalación de drywall', 'Reparación de huecos', 'Masillado', 'Techos falsos'],
      steps: ['Medir y cortar', 'Instalar las planchas', 'Cinta y masilla', 'Lijar', 'Dejar listo para pintar'],
      photos: { before: 'La pared o el hueco antes', after: 'La pared lista' },
      materials: ['Planchas de drywall', 'Masilla', 'Cinta', 'Tornillos', 'Lija']
    },
    painting: {
      group: 'build', sitesLabel: 'Propiedades', unit: 'pie²',
      jobs: ['Pintura interior', 'Pintura exterior', 'Retoque', 'Pintura de pasillos'],
      steps: ['Proteger pisos y muebles', 'Reparar y lijar', 'Primera mano', 'Segunda mano', 'Recoger y limpiar'],
      photos: { before: 'Las paredes antes', after: 'Las paredes pintadas' },
      materials: ['Pintura', 'Primer', 'Rodillos', 'Brochas', 'Cinta de pintor', 'Plástico']
    },
    flooring: {
      group: 'build', sitesLabel: 'Obras', unit: 'pie²',
      jobs: ['Instalación de losas', 'Piso laminado', 'Piso de vinilo', 'Reparación de piso'],
      steps: ['Quitar el piso viejo', 'Nivelar la base', 'Instalar el piso', 'Juntas y zócalos', 'Limpieza'],
      photos: { before: 'El piso antes', after: 'El piso nuevo' },
      materials: ['Losas', 'Laminado', 'Vinilo', 'Pegamento', 'Lechada (grout)', 'Zócalos']
    },
    carpentry: {
      group: 'build', sitesLabel: 'Obras', unit: 'trabajo',
      jobs: ['Gabinetes', 'Puertas', 'Molduras', 'Closets'],
      steps: ['Medir', 'Cortar y armar', 'Instalar', 'Ajustar y terminar'],
      photos: { before: 'El área antes', after: 'El trabajo instalado' },
      materials: ['Madera', 'Plywood', 'Bisagras', 'Tornillería', 'Barniz']
    },
    roofing: {
      group: 'build', sitesLabel: 'Sitios', unit: 'pie²',
      jobs: ['Reparacion techo', 'Inspeccion techo', 'Instalacion', 'Emergencia filtracion'],
      steps: ['Revisar el techo y la filtración', 'Quitar lo dañado', 'Reparar o instalar', 'Sellar', 'Limpiar escombros'],
      photos: { before: 'El daño o la filtración', after: 'El techo reparado' },
      materials: ['Tejas', 'Membrana', 'Sellador', 'Clavos', 'Plywood']
    },
    waterproofing: {
      group: 'build', sitesLabel: 'Obras', unit: 'pie²',
      jobs: ['Impermeabilización de techo', 'Balcones', 'Muros', 'Sótanos'],
      steps: ['Limpiar la superficie', 'Reparar grietas', 'Aplicar el impermeabilizante', 'Segunda capa', 'Revisar'],
      photos: { before: 'La superficie y las grietas', after: 'La superficie impermeabilizada' },
      materials: ['Impermeabilizante', 'Malla', 'Sellador', 'Rodillos']
    },
    glass: {
      group: 'build', sitesLabel: 'Sitios', unit: 'pie²',
      jobs: ['Cambio de vidrio', 'Instalación de ventanas', 'Puerta de baño en vidrio', 'Espejos', 'Sellado de ventanas', 'Emergencia vidrio roto'],
      steps: ['Tomar las medidas', 'Retirar el vidrio dañado', 'Instalar el vidrio nuevo', 'Sellar', 'Limpiar y revisar'],
      photos: { before: 'El vidrio roto y la medida', after: 'El vidrio instalado' },
      materials: ['Vidrio', 'Silicón', 'Herrajes', 'Burletes', 'Espejo']
    },
    fencing: {
      group: 'build', sitesLabel: 'Propiedades', unit: 'pie lineal',
      jobs: ['Cerca nueva', 'Reparación de cerca', 'Portones', 'Barandas'],
      steps: ['Marcar la línea', 'Poner los postes', 'Instalar los paneles', 'Portón y cierre', 'Limpiar'],
      photos: { before: 'El área o la cerca dañada', after: 'La cerca terminada' },
      materials: ['Postes', 'Paneles', 'Concreto', 'Bisagras', 'Cerrojo']
    },
    welding: {
      group: 'build', sitesLabel: 'Obras', unit: 'trabajo',
      jobs: ['Rejas', 'Barandas', 'Portones', 'Reparación de metal'],
      steps: ['Medir', 'Cortar y soldar', 'Instalar', 'Pintar contra óxido'],
      photos: { before: 'El área o el metal dañado', after: 'El trabajo instalado' },
      materials: ['Tubo', 'Platina', 'Electrodos', 'Pintura anticorrosiva', 'Anclajes']
    },
    stucco: {
      group: 'build', sitesLabel: 'Obras', unit: 'pie²',
      jobs: ['Estuco nuevo', 'Reparación de estuco', 'Textura', 'Fachadas'],
      steps: ['Preparar la superficie', 'Malla', 'Primera capa', 'Capa final y textura', 'Limpieza'],
      photos: { before: 'La pared antes', after: 'El estuco terminado' },
      materials: ['Estuco', 'Malla', 'Cemento', 'Arena']
    },
    insulation: {
      group: 'build', sitesLabel: 'Obras', unit: 'pie²',
      jobs: ['Aislamiento de ático', 'Paredes', 'Espuma (spray foam)'],
      steps: ['Medir el área', 'Proteger el área', 'Instalar el aislamiento', 'Revisar que no queden huecos'],
      photos: { before: 'El ático o la pared antes', after: 'El aislamiento instalado' },
      materials: ['Fibra de vidrio', 'Espuma', 'Barrera de vapor', 'Grapas']
    },
    demolition: {
      group: 'build', sitesLabel: 'Obras', unit: 'trabajo',
      jobs: ['Demolición interior', 'Demolición de estructura', 'Retiro de escombros'],
      steps: ['Cortar agua y electricidad del área', 'Proteger lo que se queda', 'Demoler', 'Sacar los escombros', 'Limpiar'],
      photos: { before: 'El área antes', after: 'El área demolida y limpia' },
      materials: ['Contenedor (dumpster)', 'Alquiler de equipo', 'Bolsas', 'Plástico']
    },
    excavation: {
      group: 'build', sitesLabel: 'Obras', unit: 'yarda³',
      jobs: ['Excavación', 'Nivelación de terreno', 'Zanjas', 'Relleno'],
      steps: ['Marcar líneas de servicios (811)', 'Excavar o nivelar', 'Compactar', 'Retirar el material'],
      photos: { before: 'El terreno antes', after: 'El terreno terminado' },
      materials: ['Relleno', 'Grava', 'Alquiler de equipo', 'Combustible']
    },
    gutters: {
      group: 'build', sitesLabel: 'Propiedades', unit: 'pie lineal',
      jobs: ['Canaletas nuevas', 'Limpieza de canaletas', 'Reparación de canaletas'],
      steps: ['Revisar las canaletas', 'Limpiar o quitar las viejas', 'Instalar o reparar', 'Probar con agua'],
      photos: { before: 'Las canaletas antes', after: 'Las canaletas terminadas' },
      materials: ['Canaletas', 'Bajantes', 'Soportes', 'Sellador']
    },
    solar: {
      group: 'build', sitesLabel: 'Propiedades', unit: 'trabajo',
      jobs: ['Instalación de paneles', 'Mantenimiento de paneles', 'Revisión del sistema'],
      steps: ['Revisar el techo', 'Montar los rieles', 'Instalar los paneles', 'Conectar el inversor', 'Probar el sistema'],
      photos: { before: 'El techo antes', after: 'Los paneles instalados' },
      materials: ['Paneles', 'Rieles', 'Inversor', 'Cable', 'Conectores']
    },

    // ---------- Instalaciones ----------
    electrical: {
      group: 'systems', sitesLabel: 'Sitios', unit: 'hora',
      jobs: ['Instalacion electrica', 'Reparacion panel', 'Inspeccion electrica', 'Emergencia'],
      steps: ['Cortar la energía del circuito', 'Diagnosticar', 'Reparar o instalar', 'Probar con el medidor', 'Restablecer la energía'],
      photos: { before: 'El panel o el problema antes', after: 'El trabajo terminado' },
      materials: ['Cable', 'Breakers', 'Tomacorrientes', 'Interruptores', 'Tubo conduit', 'Lámparas']
    },
    plumbing: {
      group: 'systems', sitesLabel: 'Sitios', unit: 'hora',
      jobs: ['Fuga agua', 'Instalacion tuberias', 'Destape', 'Inspeccion plomeria'],
      steps: ['Cerrar el agua', 'Encontrar la fuga o el tapón', 'Reparar', 'Abrir el agua y revisar que no haya fugas', 'Limpiar'],
      photos: { before: 'La fuga o el problema', after: 'La reparación sin fugas' },
      materials: ['Tubería PVC', 'Conexiones', 'Válvulas', 'Sellador', 'Teflón', 'Llave de paso']
    },
    hvac: {
      group: 'systems', sitesLabel: 'Sitios', unit: 'hora',
      jobs: ['Instalacion A/C', 'Mantenimiento', 'Reparacion', 'Inspeccion HVAC'],
      steps: ['Revisar el termostato', 'Cambiar o limpiar el filtro', 'Revisar el refrigerante', 'Limpiar el serpentín', 'Probar la temperatura'],
      photos: { before: 'El equipo y el filtro antes', after: 'El equipo funcionando' },
      materials: ['Filtros', 'Refrigerante', 'Capacitor', 'Contactor', 'Tubería de cobre']
    },
    low_voltage: {
      group: 'systems', sitesLabel: 'Sitios', unit: 'hora',
      jobs: ['Cámaras de seguridad', 'Alarmas', 'Redes e internet', 'Control de acceso'],
      steps: ['Revisar dónde va cada equipo', 'Pasar el cable', 'Instalar los equipos', 'Configurar', 'Probar con el cliente'],
      photos: { before: 'El área antes', after: 'Los equipos instalados' },
      materials: ['Cámaras', 'Cable de red', 'Conectores', 'DVR / NVR', 'Fuente de poder']
    },
    fire_protection: {
      group: 'systems', sitesLabel: 'Edificios', unit: 'visita',
      jobs: ['Inspección de extintores', 'Rociadores (sprinklers)', 'Alarma contra incendio', 'Luces de emergencia'],
      steps: ['Revisar cada equipo', 'Probar', 'Etiquetar con la fecha', 'Anotar lo que falla'],
      photos: { before: 'Cada equipo revisado', after: 'Las etiquetas puestas' },
      materials: ['Extintores', 'Etiquetas', 'Baterías', 'Rociadores']
    },

    other: {
      group: 'other', sitesLabel: 'Sitios', unit: 'trabajo',
      jobs: ['Servicio', 'Reparacion', 'INSPECTION'],
      steps: ['Revisar el trabajo con el cliente', 'Hacer el trabajo', 'Revisar que quedó bien', 'Limpiar'],
      photos: { before: 'Antes', after: 'Después' },
      materials: []
    }
  };

  window.JOB_TEMPLATES = P;

  var L = [
    ['property_management', 'Administración de propiedades', 'Property management'],
    ['maintenance', 'Mantenimiento y reparaciones', 'Maintenance and repairs'],
    ['handyman', 'Handyman', 'Handyman'],
    ['cleaning', 'Limpieza', 'Cleaning'],
    ['inspections', 'Inspecciones', 'Inspections'],
    ['landscaping', 'Jardinería y exteriores', 'Landscaping'],
    ['pools', 'Piscinas', 'Pools'],
    ['pest_control', 'Control de plagas', 'Pest control'],
    ['pressure_washing', 'Lavado a presión', 'Pressure washing'],
    ['locksmith', 'Cerrajería', 'Locksmith'],
    ['technical', 'Servicios técnicos', 'Technical services'],
    ['construction', 'Construcción general', 'General construction'],
    ['remodeling', 'Remodelación de cocinas y baños', 'Kitchen and bath remodeling'],
    ['concrete', 'Concreto y pavimento', 'Concrete and paving'],
    ['masonry', 'Albañilería, bloques y pavers', 'Masonry and pavers'],
    ['drywall', 'Drywall', 'Drywall'],
    ['painting', 'Pintura', 'Painting'],
    ['flooring', 'Pisos y losas', 'Flooring and tile'],
    ['carpentry', 'Carpintería y gabinetes', 'Carpentry and cabinets'],
    ['roofing', 'Techos', 'Roofing'],
    ['waterproofing', 'Impermeabilización', 'Waterproofing'],
    ['glass', 'Vidrios y ventanas', 'Glass and windows'],
    ['fencing', 'Cercas y portones', 'Fencing and gates'],
    ['welding', 'Herrería y soldadura', 'Welding and ironwork'],
    ['stucco', 'Estuco', 'Stucco'],
    ['insulation', 'Aislamiento', 'Insulation'],
    ['demolition', 'Demolición', 'Demolition'],
    ['excavation', 'Excavación y movimiento de tierra', 'Excavation and grading'],
    ['gutters', 'Canaletas', 'Gutters'],
    ['solar', 'Paneles solares', 'Solar panels'],
    ['electrical', 'Electricidad', 'Electrical'],
    ['plumbing', 'Plomería', 'Plumbing'],
    ['hvac', 'Aire acondicionado (HVAC)', 'Air conditioning (HVAC)'],
    ['low_voltage', 'Cámaras, alarmas y redes', 'Cameras, alarms and networks'],
    ['fire_protection', 'Protección contra incendios', 'Fire protection'],
    ['other', 'Otra', 'Other']
  ];
  window.COMPANY_TYPE_OPTIONS = L.map(function (x) {
    return { id: x[0], label: x[1], labelEn: x[2], group: P[x[0]].group };
  });
  window.COMPANY_TYPE_GROUPS = [
    { id: 'props', label: 'Propiedades y mantenimiento', labelEn: 'Property and maintenance' },
    { id: 'build', label: 'Construcción y oficios', labelEn: 'Construction and trades' },
    { id: 'systems', label: 'Instalaciones', labelEn: 'Building systems' },
    { id: 'other', label: 'Otra', labelEn: 'Other' }
  ];

  /** Steps the tech checks off for a job type of this trade. */
  window.tradeSteps = function (type, kind) {
    var p = P[type] || P.other;
    return (p.jobSteps && p.jobSteps[kind]) || p.steps || [];
  };
  window.tradePack = function (type) { return P[type] || P.other; };
})();
