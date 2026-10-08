# Huecos Tacna 🕳️🚧

PWA (mobile-first) para que los vecinos de Tacna reporten huecos en las pistas con **foto + ubicación**, y un **panel de administración** con el mapa de todos los reportes.

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
Producción: **https://huecos-tacna.vercel.app**

El proyecto de Vercel está conectado a este repositorio:
- Cada `git push` a `main` despliega automáticamente a producción.
- Las demás ramas y los pull requests generan una URL de vista previa.

Las variables `VITE_*` están configuradas en Vercel (Production y Preview). Si cambias alguna, actualízala también allí y vuelve a desplegar. Para desplegar a mano sin hacer push:
```bash
pnpm dlx vercel@latest deploy --prod
```

## Modelo de datos

```
reports/{id}
  lat, lng, geohash          // geohash para la búsqueda de duplicados cercanos
  photos: [{ url, path }]    // 1–2 fotos en Storage: reports/{uid}/{id}/n.webp
  severity: pequeno | mediano | peligroso
  note: string (≤280)
  status: pendiente | verificado | reparado
  confirmations: number
  reporterUid, address
  createdAt, updatedAt, lastConfirmedAt
reports/{id}/confirmations/{uid}   // una confirmación por usuario
rateLimits/{uid}                   // { lastReportAt }
admins/{email}                     // lista de administradores
```
