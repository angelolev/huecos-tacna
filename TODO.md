# Pendientes

## Validación de fotos con IA (Claude)

- [x] **Capa 1: revisar la foto antes de subirla.** `api/validate-photo.ts` (Claude Haiku 5.5) + `src/lib/photoCheck.ts`, llamado desde `PhotosStep`. Rechaza fotos que no son de una pista o que son inapropiadas. Si la API falla, deja pasar la foto.
- [ ] Configurar `ANTHROPIC_API_KEY` en Vercel (Production y Preview) y en `.env.local`.
- [ ] Probar con ~20 fotos reales de reportes y ~20 que no lo sean (paisajes, selfies, memes, fotos de noche o borrosas) y ajustar el prompt.
- [ ] **Capa 2: que no se pueda saltar.** Crear los reportes con `moderation: "pendiente"`, ocultarlos del mapa hasta que el servidor (con `firebase-admin`) revise las fotos ya subidas y los marque `aprobado` o `rechazado`, y mostrar los rechazados en el panel de admin.
- [ ] Límite de uso por usuario en `/api/validate-photo`, porque cualquiera puede obtener un token anónimo.

## Páginas legales

- [ ] **Política de privacidad** (`/privacidad`): qué datos se guardan (fotos, ubicación, alias), que las fotos se envían a Anthropic para revisarlas con IA, Google Analytics, y cómo pedir que se borre un reporte.
- [ ] **Acerca de** (`/acerca`, ya existe): mencionar que las fotos se revisan automáticamente con IA y enlazar la política de privacidad.
- [ ] Enlazar la política de privacidad desde el pie de página o la hoja de cuenta, y desde el paso de fotos.
