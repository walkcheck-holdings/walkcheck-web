/**
 * Monthly property Walkthrough: work instructions + common-area checklist.
 * DATA ONLY (no screens, no roles). Each role folder renders its own view:
 *   /web/empleado  → worker fills the checklist inside the job
 *   /web/compania  → office reads what the worker marked
 * Job field written by the worker: job.wtAreas = { [areaId]: {status, where, what, danger, photos[]} }
 */
(function (w) {
  var AREAS = [
    { id: 'hallways', icon: '🚪', es: 'Pasillos y escaleras', en: 'Hallways & stairs',
      lookEs: 'Objetos personales, zapatos, cajas, bicicletas, muebles, basura, obstáculos, pisos deteriorados o barandas flojas.',
      lookEn: 'Personal items, shoes, boxes, bikes, furniture, trash, obstacles, damaged floors or loose railings.' },
    { id: 'lobby', icon: '🏢', es: 'Entradas y lobby', en: 'Entrances & lobby',
      lookEs: 'Puertas que no cierran bien, cerraduras dañadas, cristales rotos, luces apagadas o áreas sucias.',
      lookEn: "Doors that don't close properly, damaged locks, broken glass, lights out or dirty areas." },
    { id: 'lights', icon: '💡', es: 'Luces', en: 'Lighting',
      lookEs: 'Revisa la iluminación de pasillos, escaleras, entradas, lobby y estacionamientos.',
      lookEn: 'Check lighting in hallways, stairs, entrances, lobby and parking.' },
    { id: 'structure', icon: '🧱', es: 'Paredes, techos y concreto', en: 'Walls, ceilings & concrete',
      lookEs: 'Grietas, desprendimientos, manchas de humedad, filtraciones, concreto deteriorado o varillas expuestas.',
      lookEn: 'Cracks, spalling, damp stains, leaks, deteriorated concrete or exposed rebar.' },
    { id: 'safety', icon: '🧯', es: 'Equipos de seguridad', en: 'Safety equipment',
      lookEs: 'Extintores, gabinetes contra incendios, alarmas y salidas de emergencia obstruidos, dañados o fuera de lo normal.',
      lookEn: 'Extinguishers, fire cabinets, alarms and emergency exits that are blocked, damaged or unusual.' },
    { id: 'parking', icon: '🅿️', es: 'Estacionamientos', en: 'Parking',
      lookEs: 'Objetos almacenados, filtraciones, concreto deteriorado, basura o condiciones inseguras.',
      lookEn: 'Stored items, leaks, deteriorated concrete, trash or unsafe conditions.' },
    { id: 'trash', icon: '🗑️', es: 'Cuartos de basura y servicio', en: 'Trash & service rooms',
      lookEs: 'Acumulación de basura, objetos almacenados, filtraciones o condiciones inusuales.',
      lookEn: 'Trash build-up, stored items, leaks or unusual conditions.' },
    { id: 'amenities', icon: '🏊', es: 'Piscina, patios y otras áreas comunes', en: 'Pool, patios & other common areas',
      lookEs: 'Condiciones visibles que necesiten limpieza, mantenimiento o atención.',
      lookEn: 'Visible conditions that need cleaning, maintenance or attention.' }
  ];

  // Work rules from the office, grouped by topic.
  var RULES = [
    { id: 'role', es: 'Tu trabajo', en: 'Your job',
      es_items: [
        'Recorre las áreas comunes, observa las condiciones generales y toma fotos de todo lo que necesite atención.',
        'No tienes que conocer las leyes del condominio, decidir si hay una violación, hablar con residentes ni preparar avisos. Eso lo hace la oficina.'
      ],
      en_items: [
        'Walk the common areas, observe general conditions and photograph anything that needs attention.',
        "You don't need to know condo rules, decide if something is a violation, talk to residents or prepare notices. The office handles that."
      ] },
    { id: 'items', es: 'Objetos personales', en: 'Personal items',
      es_items: [
        'No puede haber ningún objeto personal en las áreas comunes, ni un zapato.',
        'Si ves zapatos, alfombras, macetas, bicicletas, coches de bebé, muebles o cajas: foto clara y la ubicación exacta (unidad, pasillo, lado del edificio).',
        'No hables con el residente ni retires nada. La oficina hace el seguimiento.'
      ],
      en_items: [
        'No personal items may be left in common areas, not even one shoe.',
        'If you see shoes, rugs, planters, bikes, strollers, furniture or boxes: take a clear photo and note the exact location (unit, hallway, side of building).',
        "Don't talk to the resident or remove anything. The office follows up."
      ] },
    { id: 'photos', es: 'Cómo tomar las fotos', en: 'How to take photos',
      es_items: [
        'Primero una foto general para ubicar el lugar.',
        'Si hay un problema, otra foto de cerca donde se vea claro el daño.',
        'Nada de fotos borrosas, muy oscuras o repetidas.',
        'Indica edificio, piso y área de cada problema.',
        'Cada mes toma fotos parecidas de los mismos lugares para poder comparar. Ten fotos de todas las áreas comunes.'
      ],
      en_items: [
        'First a wide photo to show where you are.',
        'If there is a problem, a close-up where the damage is clearly visible.',
        'No blurry, very dark or repeated photos.',
        'Note building, floor and area for every problem.',
        'Each month take similar photos of the same spots so they can be compared. Cover every common area.'
      ] },
    { id: 'comms', es: 'Comunicación', en: 'Communication',
      es_items: [
        'El reporte tiene un límite de fotos: las demás mándalas a la oficina por WhatsApp, indicando el edificio.',
        'PELIGRO INMEDIATO (concreto cayéndose, cables expuestos, una salida bloqueada o algo parecido): avisa a la oficina YA por WhatsApp o teléfono. No esperes al reporte.',
        'Si algo se ve fuera de lo normal y no sabes si importa, toma la foto y mándala. La oficina decide.'
      ],
      en_items: [
        'The report has a photo limit: send the rest to the office by WhatsApp, noting the building.',
        "IMMEDIATE DANGER (falling concrete, exposed wires, a blocked exit or similar): tell the office NOW by WhatsApp or phone. Don't wait for the report.",
        "If something looks unusual and you're not sure it matters, take the photo and send it. The office decides."
      ] },
    { id: 'report', es: 'Para el reporte', en: 'For the report',
      es_items: [
        'Una foto sola no basta: en cada problema escribe DÓNDE está y QUÉ viste.',
        'Comunica cada problema y su ubicación a quien prepara el reporte, para que no se pierda.'
      ],
      en_items: [
        'A photo alone is not enough: for every problem write WHERE it is and WHAT you saw.',
        'Pass every problem and its location to whoever prepares the report so nothing gets lost.'
      ] }
  ];

  function lang() {
    try { return (localStorage.getItem('wkLang') || document.documentElement.lang || 'es').slice(0, 2); }
    catch (e) { return 'es'; }
  }

  // Plain-text version saved into job.instructions so every client (web and
  // mobile app) shows the instructions even without the checklist UI.
  function instructionsText(l) {
    var en = (l || 'es') === 'en';
    var out = [en ? 'MONTHLY WALKCHECK — work instructions' : 'WALKCHECK MENSUAL — instrucciones de trabajo', ''];
    out.push(en ? 'AREAS TO CHECK' : 'ÁREAS QUE DEBES REVISAR');
    AREAS.forEach(function (a) { out.push('• ' + (en ? a.en : a.es) + ': ' + (en ? a.lookEn : a.lookEs)); });
    RULES.forEach(function (r) {
      out.push('');
      out.push((en ? r.en : r.es).toUpperCase());
      (en ? r.en_items : r.es_items).forEach(function (t) { out.push('• ' + t); });
    });
    return out.join('\n');
  }

  function isWalkthrough(job) {
    var k = String((job && (job.kind || job.type || job.jobType)) || '').toLowerCase().replace(/[^a-z]/g, '');
    // 'Walkcheck' is the visible name; 'Walkthrough' kept so older jobs still match.
    return k === 'walkcheck' || k === 'walkcheckmensual' || k === 'monthlywalkcheck' ||
      k === 'walkthrough' || k === 'walkthroughmensual' || k === 'monthlywalkthrough';
  }

  // Summary for headers/cards: how many areas checked, problems, dangers.
  function summary(job) {
    var m = (job && job.wtAreas) || {};
    var s = { total: AREAS.length, checked: 0, ok: 0, issues: 0, dangers: 0 };
    AREAS.forEach(function (a) {
      var v = m[a.id];
      if (!v || !v.status) return;
      s.checked++;
      if (v.status === 'ok') s.ok++;
      if (v.status === 'issue') s.issues++;
      if (v.danger) s.dangers++;
    });
    return s;
  }

  w.WK_WALKTHROUGH = {
    typeName: 'Walkcheck',
    icon: '🚶',
    color: '#0E7C66',
    areas: AREAS,
    rules: RULES,
    lang: lang,
    instructionsText: instructionsText,
    isWalkthrough: isWalkthrough,
    summary: summary
  };
})(window);
