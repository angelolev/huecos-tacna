# Pendientes

## Validación de fotos con IA (Claude)

- [x] **Capa 1: revisar la foto antes de subirla.** `api/validate-photo.ts` (Claude Haiku 5.5) + `src/lib/photoCheck.ts`, llamado desde `PhotosStep`. Rechaza fotos que no son de una pista o que son inapropiadas. Si la API falla, deja pasar la foto.
- [ ] Configurar `ANTHROPIC_API_KEY` en Vercel (Production y Preview) y en `.env.local`.
- [ ] Probar con ~20 fotos reales de reportes y ~20 que no lo sean (paisajes, selfies, memes, fotos de noche o borrosas) y ajustar el prompt.
- [ ] **Capa 2: que no se pueda saltar.** Crear los reportes con `moderation: "pendiente"`, ocultarlos del mapa hasta que el servidor (con `firebase-admin`) revise las fotos ya subidas y los marque `aprobado` o `rechazado`, y mostrar los rechazados en el panel de admin.
- [ ] Límite de uso por usuario en `/api/validate-photo`, porque cualquiera puede obtener un token anónimo.

## Páginas legales

- [x] **Política de privacidad** (`/privacidad`): responsable (Coding Latam), datos que se recogen, revisión de fotos con IA (Anthropic), proveedores (Google, Vercel, Anthropic), conservación y derechos ARCO (Ley 29733).
- [x] **Acerca de**: pregunta frecuente sobre por qué se rechaza una foto y enlace a la política.
- [x] Enlaces a la política desde la hoja de cuenta y el paso de fotos; `/privacidad` en `sitemap.xml`.
- [ ] Que un abogado revise la política, sobre todo la edad mínima (14 años) y si hay que inscribir el banco de datos ante la Autoridad Nacional de Protección de Datos Personales.
