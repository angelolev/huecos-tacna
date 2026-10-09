# Huecazo 🕳️🚧

**https://huecazo.com** · PWA mobile-first para que los vecinos reporten los huecos de las pistas con **foto + ubicación**, y un **panel de administración** con el mapa de todos los reportes.

Empezó en Tacna tras las lluvias. Está lista para funcionar en varias ciudades del Perú: cada ciudad se agrega y se activa desde el panel admin, sin tocar código (ver [Ciudades](#ciudades)).

## Funcionalidades

**Ciudadano** (`/`)
- Mapa público con los huecos activos (marcadores agrupados; se pueden mostrar los reparados).
- **Reportar hueco** en 3 pasos: 1–2 fotos (comprimidas en el celular a WebP de ~1280 px) → ubicación con pin fijo sobre Google Maps, centrado en el GPS → severidad y nota opcional.
- **Anti-duplicados**: si ya existe un reporte activo a ≤ 25 m, se ofrece *confirmarlo* (+1) en vez de crear otro.
- "Sigue ahí": cualquier vecino puede confirmar un reporte (1 vez por usuario).
- **Login híbrido**: anónimo e invisible por defecto (Firebase Anonymous Auth) y opción de **vincular Google** sin perder los reportes.
- Mis reportes (`/mis-reportes`).
- Instalable como app (PWA).

**Admin** (`/admin`)
- Login con Google; solo los correos que estén en la colección `admins`.
- Mapa con los reportes coloreados por estado, filtros (estado, severidad, periodo, búsqueda) y orden (recientes, más confirmados, más graves).
- Cambiar el estado (pendiente → verificado → reparado) y eliminar reportes falsos (borra también las fotos).
- **Exportar CSV** de los reportes filtrados (con enlaces a fotos y a Google Maps).

**Seguridad** (en `firestore.rules` y `storage.rules`)
- Validación de campos, coordenadas limitadas a la región Tacna y fotos de máximo 1.5 MB (solo imágenes).
- Máximo **1 reporte cada 2 minutos** por usuario (colección `rateLimits`).
- Confirmaciones únicas por usuario (subcolección `reports/{id}/confirmations/{uid}`).

## Stack
Vite · React 19 · TypeScript · Tailwind v3 · Firebase (Auth, Firestore, Storage) · `@vis.gl/react-google-maps` · `@googlemaps/markerclusterer` · `geofire-common` · `vite-plugin-pwa`.

## Configuración

### 1. Firebase
1. Crea un proyecto en <https://console.firebase.google.com> y registra una **app web**.
2. **Authentication → Método de acceso**: habilita **Anónimo** y **Google**. En *Configuración → Dominios autorizados* agrega tu dominio de producción.
3. **Firestore**: crea la base de datos. Te recomiendo la región `southamerica-west1` (Santiago), que es la más cercana a Tacna.
4. **Storage**: requiere el plan **Blaze**. Actívalo y crea una **alerta de presupuesto** (p. ej. US$1) en Google Cloud Billing. Con fotos de ~150 KB la cuota gratis alcanza para decenas de miles de reportes.
5. **Admins**: en Firestore crea la colección `admins` y un documento cuyo **ID sea el correo** del administrador (p. ej. `tucorreo@gmail.com`). Puede tener cualquier campo (`{ "nombre": "Angel" }`).
6. Despliega las reglas:
   ```bash
   pnpm dlx firebase-tools login
   pnpm dlx firebase-tools use --add      # elige tu proyecto
   pnpm dlx firebase-tools deploy --only firestore:rules,storage
   ```
   La primera vez, Firebase pedirá permiso para que las reglas de Storage consulten Firestore (para el borrado de fotos por parte del admin). Acéptalo.

### 2. Google Maps
En <https://console.cloud.google.com> (puede ser el mismo proyecto de Firebase):
1. Habilita **Maps JavaScript API** y **Geocoding API**. Geocoding es opcional: sirve para mostrar la dirección; sin ella solo se ven las coordenadas.
2. Crea una **API key** y restríngela por *referentes HTTP* (`http://localhost:5173/*` y `https://tu-dominio/*`) a esas 2 APIs.
3. (Producción) En *Google Maps Platform → Administración de mapas* crea un **Map ID** de tipo JavaScript/Vector. En desarrollo sirve `DEMO_MAP_ID`.

### 3. Variables de entorno
```bash
cp .env.example .env.local
```
Completa los valores de Firebase y de Google Maps.

### 4. Ejecutar
```bash
pnpm install
pnpm dev
```
Para probar en el celular (misma red WiFi):
```bash
pnpm dev:phone
```
Abre en el celular la URL `https://192.168.x.x:5173` que muestra la terminal y acepta la advertencia del certificado. Tiene que ser **https**: por `http://` el navegador bloquea el GPS y la cámara. Agrega también ese origen a las restricciones de tu API key de Google Maps.

> En computadoras de escritorio la ubicación viene del WiFi o la IP y puede tener cientos de metros de error. Para probar la precisión real, usa el celular con el GPS activado.

### 5. Desplegar
Producción: **https://huecazo.com** (también responde en https://huecos-tacna.vercel.app; `www.huecazo.com` redirige al dominio principal).

El proyecto de Vercel está conectado a este repositorio:
- Cada `git push` a `main` despliega automáticamente a producción.
- Las demás ramas y los pull requests generan una URL de vista previa.

Las variables `VITE_*` están configuradas en Vercel (Production y Preview). Si cambias alguna, actualízala también allí y vuelve a desplegar. Para desplegar a mano sin hacer push:
```bash
pnpm dlx vercel@latest deploy --prod
```

## Ciudades

Las ciudades viven en la colección `cities` de Firestore. Agregar una ciudad no requiere código ni redesplegar.

1. Entra a `/admin` y pulsa el ícono de **edificio** (Ciudades).
2. **Agregar ciudad** → escribe el nombre (p. ej. "Moquegua") → **Buscar**. Google ubica la ciudad y propone dos zonas que puedes ajustar arrastrando sus bordes:
   - **Zona de reportes** (coral): dónde se aceptan reportes. Incluye los alrededores de la ciudad.
   - **Zona urbana** (lavanda): lo que se muestra en la vista "Toda la ciudad".
3. Guarda. La ciudad queda **pausada**. Cuando quieras abrirla, activa su interruptor.

Comportamiento:
- **Al reportar**, la app asigna la ciudad cuya zona contiene el pin. Las reglas de Firestore verifican que la ciudad exista, esté **activa** y que el punto esté dentro de su zona.
- **Fuera de las ciudades activas**, la app avisa "Huecazo aún no llega a tu zona" y no deja confirmar el pin.
- **"Toda la ciudad"** encuadra la ciudad donde está la persona, o la primera ciudad activa si está fuera de todas.
- **En el admin** se filtra por ciudad, y el CSV incluye la columna Ciudad (`huecazo-<ciudad>-AAAA-MM-DD.csv`).
- **Pausar una ciudad** deja de aceptar reportes nuevos, pero los existentes se siguen viendo. Las ciudades no se borran.
- **La primera vez que un admin abre el panel**, se crea automáticamente la ciudad **Tacna** y se asigna `cityId` a los reportes antiguos.

## Puntos y ranking

Los puntos **no se guardan**: se calculan en `src/lib/points.ts` a partir de los reportes, las confirmaciones y el bono de Google, que ya están protegidos por las reglas. Nadie puede editarse su puntaje.

| Acción | Puntos |
|---|---|
| Enviar un reporte | +10 |
| El admin lo verifica | +10 |
| Lo marcan como reparado | +10 |
| Otro vecino confirma tu reporte | +2 c/u (máx. +10 por reporte) |
| Confirmar el reporte de otro vecino | +2 |
| Entrar con Google por primera vez (una vez por cuenta, `googleBonus/{uid}`) | +10 |
| El admin lo marca como **falso** | −20 (y se pierden los demás puntos de ese reporte) |

- **Ranking** (`/ranking`): "Este mes" (reportes y confirmaciones del mes) e "Histórico", por ciudad. Solo aparece quien eligió un **alias + emoji** (`profiles/{uid}`) y tiene puntos positivos. Nunca se muestra el nombre real.
- **Campeón del mes** 👑: al terminar cada mes, quien más puntos sumó ese mes en su ciudad (con alias) gana una coronita y anillo dorado en su avatar, en el ranking, en "Mis reportes" y en la tabla de vecinos del admin. Se calcula (`monthlyChampions` en `src/lib/points.ts`), no se guarda: si el admin marca un reporte como falso, el campeón de ese mes se recalcula. El ranking del mes muestra al campeón del mes anterior y el histórico lista a todos los campeones.
- **Perfil de vecino** (`/vecino/:uid`): al tocar a alguien en el ranking (o su alias en la tabla del admin) se ve su resumen: puntos, nivel, huecos reportados, reparados, apoyos recibidos, reportes confirmados, puesto en su ciudad y coronas. Solo existe para quien tiene alias; nunca muestra el nombre real ni dónde reportó.
- **"¡Fuiste el campeón!"**: al abrir la app tras ganar un mes, aparece una celebración con confeti. Para no cargar datos de más en el inicio, se revisa una vez al mes por dispositivo.
- **Niveles**: 🌱 Nuevo vecino (0) → 🙂 Vecino atento (10) → 🔦 Cazahuecos (100) → 🚧 Inspector de pistas (300) → 🏆 Huecazo de oro (800).
- **Aviso al abrir la app**: "¡Ganaste X puntos!" cuando un reporte tuyo fue verificado, reparado o confirmado por otros.
- **Admin**: el botón **"Es falso"** marca el reporte como `rechazado` (desaparece del mapa y resta puntos). "Eliminar definitivamente" sigue disponible, pero no resta puntos.
- **Alias ofensivos**: el admin puede borrar el documento `profiles/{uid}` desde la consola de Firestore (las reglas lo permiten).
- **Escala**: el ranking se calcula en el navegador con todos los reportes y confirmaciones. Funciona bien hasta unos miles de reportes; más allá conviene precalcularlo con una Cloud Function.

## Métricas (panel admin)

Pestaña **Métricas** en `/admin` (`/admin?vista=metricas`), filtrable por ciudad y periodo (7, 30, 90 días o todo). Se calcula en el navegador (`src/lib/metrics.ts`) y se actualiza en tiempo real.

- **Reportes**: recibidos (vs. el periodo anterior), por atender (y cuántos peligrosos), reparados, tasa de resolución, tiempo de reparación (mediana entre el reporte y el cambio a "Reparado", tomado de `updatedAt`) y % de falsos.
- **Nuevos vs. reparados**: por día, semana o mes según el periodo, con vista de tabla.
- **Pendientes por antigüedad y severidad**.
- **Atender primero**: pendientes ordenados por severidad × apoyos de vecinos × antigüedad. Al tocar uno, se abre en el mapa.
- **Zonas con más huecos**: pendientes agrupados por geohash de 6 caracteres (~1 km).
- **Vecinos**: cuántos hay (reportaron, confirmaron, eligieron alias o entraron con Google), activos, nuevos, con Google, recurrentes; y una tabla de los más activos (reportes, reparados, falsos ⚠️, confirmaciones, puntos) exportable a CSV. Nunca muestra nombres reales ni correos. Quien solo miró el mapa no se cuenta: contar todas las cuentas de Firebase Auth requiere una Cloud Function con el Admin SDK.

## SEO y redes

- **Metadatos base** en `index.html`: título y descripción con foco local ("huecos en las pistas de Tacna"), Open Graph y Twitter con `public/og-image.png` (1200×630), y datos estructurados JSON-LD (`WebSite` y `WebApplication`).
- **Metadatos por página**: `useDocumentMeta()` (`src/hooks/useDocumentMeta.ts`) ajusta título, descripción, URL canónica y robots. `/admin` y `/mis-reportes` llevan `noindex`, también como cabecera `X-Robots-Tag` en `vercel.json`.
- **Contenido indexable**: `/acerca` ("¿Qué es Huecazo?") con pasos, estados y preguntas frecuentes, más JSON-LD `FAQPage`.
- **`robots.txt` y `sitemap.xml`** en `public/`. Si agregas páginas públicas, añádelas al sitemap.
- **Compartir un reporte**: `https://huecazo.com/h/<id>`. La función `api/share.ts` devuelve el HTML con la **foto del hueco**, la dirección y la gravedad como vista previa (WhatsApp, Facebook y X no ejecutan JavaScript). En el navegador redirige al reporte en el mapa. Las fotos se guardan en JPEG para que todas las redes las acepten.

Después de desplegar:
1. **Google Search Console**: verifica `huecazo.com` (registro DNS TXT en Vercel → Domains) y envía `https://huecazo.com/sitemap.xml`.
2. **Probar vistas previas**: [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) (también actualiza la caché de WhatsApp) y [Rich Results Test](https://search.google.com/test/rich-results) para las FAQ.

## Seguridad

- **Reglas de Firestore y Storage** (`firestore.rules`, `storage.rules`). Validan cada campo y verifican:
  - **Reportes**: que la ciudad esté activa y el punto dentro de su zona; fotos propias en el bucket del proyecto (nunca URLs externas); 1 reporte cada 2 minutos.
  - **Confirmaciones**: una por persona, y nunca del propio reporte.
  - **Perfiles**: solo alias y emoji válidos.
  - **Traspasos**: con código secreto y vencimiento de 10 minutos.
  - **Admin**: correo verificado más un documento en `admins/{email}`.
- **Cabeceras** (`vercel.json`): CSP estricta, `X-Frame-Options: DENY` y `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (cámara y GPS solo en el propio sitio) y COOP compatible con el login de Google. HSTS lo pone Vercel.
  - La CSP permite `'wasm-unsafe-eval'` porque Google Maps compila WebAssembly. No habilita `eval()` de JavaScript.
- **Si agregas un servicio externo**, súmalo a la CSP y prueba el build con la CSP como `<meta>` antes de publicar.
- **Dependencias**: Dependabot (`.github/dependabot.yml`). Para revisarlas a mano: `pnpm audit --prod`. `@grpc/grpc-js` está forzado a ≥1.13.6 con `pnpm.overrides`.
- **Claves públicas**: las claves web de Firebase y de Google Maps van dentro del código del navegador; es normal. Deben estar **restringidas por dominio** en Google Cloud → Credenciales.

## Modelo de datos

```
profiles/{uid}                     // alias + emoji para el ranking (opcional)
cities/{id}                        // id = slug: "tacna", "moquegua"
  name, department, enabled, order
  bounds      {north, south, east, west}   // zona donde se aceptan reportes
  viewBounds  {north, south, east, west}   // zona urbana para "Toda la ciudad"
  center      {lat, lng}
reports/{id}
  cityId                     // ciudad del reporte
  lat, lng, geohash          // geohash para la búsqueda de duplicados cercanos
  photos: [{ url, path }]    // 1–2 fotos en Storage: reports/{uid}/{id}/n.webp
  severity: pequeno | mediano | peligroso
  note: string (≤280)
  status: pendiente | verificado | reparado | rechazado
  confirmations: number
  reporterUid, address
  createdAt, updatedAt, lastConfirmedAt
reports/{id}/confirmations/{uid}   // una confirmación por usuario
rateLimits/{uid}                   // { lastReportAt }
admins/{email}                     // lista de administradores
```
