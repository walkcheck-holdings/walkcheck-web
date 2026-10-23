# WalkCheck web

Public site and web panels for walkcheck.app (GitHub Pages, repo `walkcheck-holdings/walkcheck-web`).
One website, one Firestore database (`walkcheck-a4f1e`). Data security is enforced by
`firestore.rules` in the `walkthrough` repo, not by hiding buttons.

## ROLES WALKCHECK — REGLA DE ORO — NO MEZCLAR

### 1. PLATAFORMA (`/web/plataforma/`) — Dueño de la app
- **Quién:** solo `maikelramirez55@gmail.com` (lista `SUPER` en `/web/entrar.js`, igual a `isSuperAdmin()` en `firestore.rules`).
- **SOLO ve:** lista de compañías y botón Suspender / Activar.
- **NO ve:** Billing, ganancias, Jobs, Reports, Buildings ni clientes de ninguna compañía. Por privacidad.

### 2. COMPAÑÍA (`/web/compania/`) — Dueño / oficina de una compañía (ej. Pega App LLC)
- **Ve TODO de SU compañía:** Schedule, Jobs, Billing, Reports, Timesheets, Clientes y Buildings.
- **NO ve:** otras compañías.

### 3. EMPLEADO (`/web/empleado/`) — Trabajador de campo
- **SÍ ve:** en el Job que le asignan, el nombre del cliente, la dirección y el teléfono para llamarlo y llegar. Ve las fotos, notas y checklist de ESE Job.
- **NO ve:** Billing, Reports, Timesheets, precios globales ni la lista completa de clientes.
- **Puede hacer dentro del Job:** completar el trabajo, agregar fotos, borrar o cambiar una foto si salió mal, y poner notas.
- **NO puede hacer:** editar el nombre del cliente, la dirección ni el precio. No puede crear Jobs.

## Carpetas por rol (una web, archivos separados)

```
/web
  entrar.html / entrar.js  → único lugar que decide a qué carpeta va cada cuenta
  /plataforma              → dueño de la app
  /compania                → dueño / oficina de la compañía
  /empleado                → trabajador
  /compartido              → login, Firebase, $, esc, CSS básico (no sabe de roles)
```

1. Cada rol tiene su propio layout (barra y menú viven en su carpeta).
2. Ningún módulo toca las pantallas de otro rol. Si dos roles necesitan algo parecido con
   distinto comportamiento, se duplica el archivo en vez de un `if (role)` compartido.
3. Lo compartido no sabe de roles.
4. Una cuenta sin perfil en `/users` o sin `companyId` no entra (`WK_hasAccess` en `entrar.js`).

## Publicar

- Cada cambio se publica con commit + push a `main`; GitHub Pages actualiza walkcheck.app en ~1 minuto.
- Probar en PC y a 390px antes de publicar.
- Las reglas de Firestore se publican desde el repo `walkthrough`:
  `firebase deploy --only firestore:rules --project walkcheck-a4f1e`.
