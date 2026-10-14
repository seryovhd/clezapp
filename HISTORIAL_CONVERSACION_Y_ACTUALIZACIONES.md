# 📝 Registro Completo de Conversación y Actualizaciones - CLEZAPP PRO (CHASAP)
**Fecha:** 13 de Octubre de 2026  
**Versión del Sistema:** Clezapp-PRO 3.5.5  
**Repositorio:** `d:\PROYECTOS\PHP\chasap-pro`

---

## 1. Contexto Inicial y Recuperación tras Reinicio
- **Situación:** El equipo del usuario se reinició durante el proceso de aplicación de correcciones y actualizaciones.
- **Acción inicial:**
  - Se verificaron e iniciaron todos los servicios locales:
    - **PostgreSQL:** Puerto `5432` (vía Laragon).
    - **MySQL:** Puerto `3306` (vía Laragon).
    - **Redis:** Puerto `6379` (Contenedor Docker `chasappro-redis-1`).
    - **Backend API:** Puerto `4000` (`http://localhost:4000`).
    - **Frontend SPA React:** Puerto `3000` (`http://localhost:3000`).
  - Se recuperó el historial previo a partir de los registros del sistema (sesión `433fdc7d-8feb-475b-a59e-bc1569db75f1`), identificando los requerimientos exactos en curso:
    1. Rebranding de la plataforma a **CLEZAPP**.
    2. Corrección de colores y contrastes en tema claro y oscuro (estilo WhatsApp Web).
    3. Falla en recepción de imágenes enviadas por Typebot vía `/queue-integration`.
    4. Cuelgue y bloqueo indefinido de la web al escanear el código QR con WhatsApp Baileys.

---

## 2. Diagnóstico y Correcciones Aplicadas

### 2.1. Problema de Cuelgue / Congelamiento al Escanear QR en Baileys
#### Diagnóstico:
1. **Llamada destructiva en frontend (`QrcodeModal/index.js`):** El hook `useEffect` ejecutaba `socket.disconnect()` en su función de limpieza al cerrarse el modal o actualizarse el estado, desconectando el WebSocket global de toda la aplicación y dejando la interfaz sin reactividad.
2. **Promesa `initWASocket` no resuelta (`backend/src/libs/wbot.ts`):** `initWASocket` únicamente ejecutaba `resolve(wsocket)` dentro del bloque `connection === "open"` (tras escanear el teléfono). Al solicitar un nuevo QR o conectar, la petición HTTP `POST /whatsappsession/:id` quedaba colgada en estado `pending` en el navegador.
3. **Controlador bloqueante (`backend/src/controllers/WhatsAppSessionController.ts`):** `store` y `update` esperaban síncronamente con `await StartWhatsAppSession`, bloqueando la respuesta de la API.
4. **Saturación por volcado síncrono y mensajes históricos (`backend/src/services/WbotServices/wbotMessageListener.ts`):** Un `console.log(JSON.stringify(messageUpsert, null, 2))` volcaba miles de líneas por stdout al sincronizarse la cuenta, bloqueando el *Event Loop* de Node.js en Windows. Además, mensajes antiguos recibidos con tipo `append` disparaban procesamiento de tickets y bots masivamente.
5. **CronJob inestable (`backend/src/queues.ts`):** `handleInvoiceCreate` se ejecutaba cada 5 segundos (`*/5 * * * * *`) sin `try/catch`. Cualquier parpadeo de conexión en PostgreSQL abortaba el proceso de Node.js con un `unhandledRejection`.

#### Soluciones Implementadas:
- **En `frontend/src/components/QrcodeModal/index.js`:**
  - Se eliminó `socket.disconnect()`.
  - Se reemplazó por desuscripción limpia de eventos específicos (`socket.off`) mediante listeners nombrados (`handleSessionUpdate` y `handleWhatsappUpdate`).
  - Se implementó un polling de respaldo cada 3 segundos en el modal para asegurar que el QR se recupere aunque el socket experimente retrasos.
- **En `frontend/src/context/Socket/SocketContext.js`:**
  - Se optimizó el método `ManagedSocket.off()` para permitir la desuscripción segura tanto con callback como por nombre de evento.
- **En `frontend/src/pages/Connections/index.js`:**
  - Al pulsar *"Conectar"*, *"Reintentar"* o *"Nuevo QR"*, se abre inmediatamente el modal de escaneo (`handleOpenQrModal`), dando feedback interactivo instantáneo al usuario.
- **En `backend/src/libs/wbot.ts`:**
  - Se añadió `resolve(wsocket)` en el bloque `qr !== undefined`, permitiendo que la inicialización retorne inmediatamente cuando el QR ha sido generado.
- **En `backend/src/controllers/WhatsAppSessionController.ts`:**
  - Se desacopló la respuesta HTTP en `store` y `update`: la API responde HTTP 200 de inmediato (`{ message: "Starting session." }`) y la sesión se gestiona de forma asíncrona en background.
- **En `backend/src/services/WbotServices/wbotMessageListener.ts`:**
  - Se eliminó el `JSON.stringify(messageUpsert)`.
  - Se ignoran mensajes con tipo `append` (historial puro) o con antigüedad superior a 5 minutos (`timestampSec > 300`).
- **En `backend/src/queues.ts`:**
  - Se cambió la frecuencia de `handleInvoiceCreate` de cada 5 segundos a cada 30 minutos (`*/30 * * * *`) y se envolvió en un bloque `try / catch` con log defensivo.

---

### 2.2. Problema de Imágenes en Typebot (`backend/src/services/TypebotServices/typebotListener.ts`)
#### Diagnóstico:
- Typebot entrega las imágenes y archivos multimedia con diferentes estructuras según la versión (strings directos, objetos `{ url }`, `{ src }`, `{ link }` o dentro de árboles `richText`).
- Al ejecutar `mediaUrl.trim()`, si `mediaUrl` era un objeto, se producía una excepción `TypeError: mediaUrl.trim is not a function`, devolviendo `null`.
- Al fallar la descarga del buffer, el fallback enviaba `{ image: { url: mediaUrl } }` pasando el objeto en lugar de un string URL válido a Baileys, provocando fallo en el envío al destinatario.

#### Soluciones Implementadas:
- Se implementó la función auxiliar `extractMediaUrl(content)` para extraer URLs válidas desde cualquier estructura de datos de Typebot.
- Se mejoró `downloadMediaBuffer` para validar strings, manejar URLs relativas anteponiendo el host de Typebot y detectar tipos MIME estándar (`image/jpeg`, `image/png`, `image/webp`).
- Se reforzó el envío y registro en base de datos para `image`, `audio` y `video`.

---

### 2.3. Consulta sobre Error al Actualizar en VPS (`install-vps`, Opción 2)
#### Diagnóstico del Error:
```text
Error: Command failed: npm install caniuse-lite baseline-browser-mapping
npm error code ERESOLVE
npm error While resolving: cache-loader@4.1.0
npm error Found: webpack@5.90.0
npm error peer webpack@"^4.0.0" from cache-loader@4.1.0
```
- **Causa:** La herramienta `update-browserslist-db` ejecuta internamente `npm install caniuse-lite` sin la bandera `--legacy-peer-deps`. En versiones recientes de npm, la estricta resolución de dependencias chocaba entre `cache-loader` (que pedía Webpack 4) y `webpack@5.90.0` (Webpack 5).
- **Por qué se regulariza al final:** El script de la VPS posteriormente compila el proyecto usando `npm install --legacy-peer-deps` o `npm run build`, completando el proceso con éxito.

#### Solución Definitiva Aplicada:
1. Se removió la librería deprecada `cache-loader` de `devDependencies` en [frontend/package.json](file:///d:/PROYECTOS/PHP/chasap-pro/frontend/package.json).
2. Se creó el archivo de configuración [frontend/.npmrc](file:///d:/PROYECTOS/PHP/chasap-pro/frontend/.npmrc) con:
   ```ini
   legacy-peer-deps=true
   ```
   Con esto, cualquier comando `npm` en el frontend utilizará resolución compatible automáticamente.

---

## 3. Guía de Extracción de Errores y Logs

### 3.1. Entorno Local (Windows / Laragon)
1. **Asistente AI:** Solicitar *"revisa los logs del backend"* para inspeccionar en vivo la tarea en ejecución.
2. **Navegador (F12):**
   - **Console:** Ver excepciones de JavaScript y eventos WebSocket.
   - **Network (Fetch/XHR):** Ver peticiones HTTP en rojo y consultar la pestaña *Response*.

### 3.2. Servidor VPS (Linux / Producción)
1. **Ver logs de errores en tiempo real:**
   ```bash
   pm2 logs chasap-backend --lines 100 --err
   # o si el proceso se llama backend:
   pm2 logs backend --lines 100 --err
   ```
2. **Archivos físicos de logs en la VPS:**
   ```bash
   ~/.pm2/logs/chasap-backend-error.log   # Errores y caídas
   ~/.pm2/logs/chasap-backend-out.log     # Logs informativos generales
   ```
3. **Si se usa Docker:**
   ```bash
   docker logs --tail 100 -f chasap_backend
   ```

---

## 4. Estado Final de Archivos Modificados en la Sesión

| Archivo | Tipo de Cambio |
| :--- | :--- |
| `backend/src/libs/wbot.ts` | Resolución temprana de `initWASocket` al emitir QR |
| `backend/src/controllers/WhatsAppSessionController.ts` | Desacoplamiento asíncrono no bloqueante en `store` y `update` |
| `backend/src/services/WbotServices/wbotMessageListener.ts` | Filtro de mensajes antiguos/sincronizados y eliminación de logs pesados |
| `backend/src/services/TypebotServices/typebotListener.ts` | Extracción segura de URLs y envío confiable de multimedia |
| `backend/src/queues.ts` | Blindaje con `try/catch` y ajuste de frecuencia del cronjob de vencimientos |
| `frontend/src/components/QrcodeModal/index.js` | Desuscripción selectiva de sockets y polling de respaldo cada 3s |
| `frontend/src/context/Socket/SocketContext.js` | Mejora en `ManagedSocket.off()` |
| `frontend/src/pages/Connections/index.js` | Apertura inmediata del modal QR al interactuar con botones |
| `frontend/package.json` | Eliminación de `cache-loader` incompatible con Webpack 5 |
| `frontend/.npmrc` | Habilitación de `legacy-peer-deps=true` |
