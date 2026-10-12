# 📖 Documentación Integral del Sistema - CHASAP PRO

## 1. Visión General del Proyecto

**CHASAP PRO** es una solución omnicanal y CRM de atención al cliente multi-agente y multi-empresa (SaaS), construida a partir de la evolución y ampliación de *Whaticket*. Su propósito central es centralizar, automatizar y gestionar conversaciones de **WhatsApp** y otros canales de mensajería para empresas de cualquier tamaño, optimizando tiempos de respuesta, productividad de agentes y satisfacción de clientes.

### Capacidades Principales
- **Multi-Tenant (Multi-Empresa):** Gestión de múltiples organizaciones aisladas, cada una con sus propios usuarios, conexiones, colas, planes de suscripción y configuraciones.
- **Conectividad Dual WhatsApp:** 
  1. Conexión estándar mediante código QR vía **Baileys** (WhatsApp Web multi-dispositivo).
  2. Conexión oficial **WhatsApp Cloud / Business API** (Meta Graph API).
- **Atención Multi-Agente:** Bandeja compartida organizada por departamentos/colas (`Queues`), estados de ticket (`pending`, `open`, `closed`), asignación automática o manual de agentes y notas internas.
- **Automatización & Chatbots Tri-Modal:**
  1. **Menú de Opciones por Colas:** IVR interactivo con subniveles numéricos.
  2. **FlowBuilder:** Constructor visual arrastrable (drag-and-drop con React Flow) para crear flujos conversacionales dinámicos y envío de multimedia/audios.
  3. **Typebot:** Integración directa con bots conversacionales avanzados.
- **Inteligencia Artificial Integrada:** Soporte nativo para **OpenAI (GPT)** y **DeepSeek**, con configuración de prompts personalizados, roles del sistema, control de temperatura y límites de tokens, además de síntesis de voz (Text-to-Speech) mediante Microsoft Azure Cognitive Services.
- **Campañas y Difusión Masiva:** Envíos programados a listas segmentadas de contactos con variables dinámicas (`Mustache`), intervalos de retardo (anti-baneo) y reportes de entrega.
- **Integraciones y Omnicanalidad:** NotificaMe Hub (Instagram, Facebook Messenger, Telegram, Mercado Libre), Webhooks configurables, pasarelas de pago (Gerencianet/Efí, Asaas) y sistemas de gestión de ISP (IXC Soft, MK-Auth).

---

## 2. Herramientas, Tecnologías y Stack Técnico

El proyecto está dividido en dos partes principales: **Backend** (API REST, WebSockets y Workers) y **Frontend** (Single Page Application en React).

### 2.1. Backend

| Categoría | Tecnología / Librería | Versión / Detalle | Propósito |
|---|---|---|---|
| **Entorno de Ejecución** | [Node.js](https://nodejs.org/) | v22+ (Recomendado) | Motor de ejecución del servidor en TypeScript/JavaScript |
| **Lenguaje** | [TypeScript](https://www.typescriptlang.org/) | ~4.6 / 5.x | Tipado estático y compilación estructurada |
| **Framework Web** | [Express](https://expressjs.com/) | ^4.17.3 | Servidor HTTP, middleware y enrutamiento REST |
| **Base de Datos & ORM** | [PostgreSQL](https://www.postgresql.org/) / [Sequelize](https://sequelize.org/) | `pg` ^8.7.3, `sequelize` ^5.22.5, `sequelize-typescript` | Persistencia relacional, migraciones, seeders y modelos fuertemente tipados |
| **Tiempo Real (WebSockets)** | [Socket.IO](https://socket.io/) | ^4.8.1 | Comunicación bidireccional en tiempo real (mensajes, estados de tickets, presencia) |
| **Colas de Tareas & Caché** | [Bull](https://optimalbits.github.io/bull/) & [Redis](https://redis.io/) | `bull` ^4.10.4 | Procesamiento en segundo plano de campañas masivas, monitores y limitadores de tasa |
| **Caché en Memoria** | [Node-Cache](https://github.com/node-cache/node-cache) | ^5.1.2 | Caché local de reintentos de mensajes y tokens temporales |
| **Conexión WhatsApp** | [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) | ^7.0.0-rc.6 | Implementación del protocolo WhatsApp Web mediante WebSockets sin navegador |
| **Procesamiento Multimedia** | [Fluent-FFmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) & [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) | ^2.1.2 / ^5.2.0 | Transcodificación de notas de voz a formato Opus/OGG para WhatsApp |
| **Inteligencia Artificial** | [OpenAI SDK](https://github.com/openai/openai-node) & DeepSeek API | `openai` 3.3.0 + HTTP Client | Procesamiento de lenguaje natural, chatbots inteligentes y respuestas automáticas |
| **Síntesis de Voz (TTS)** | [Microsoft Cognitive Services Speech SDK](https://learn.microsoft.com/azure/ai-services/speech-service/) | 1.31.0 | Conversión de respuestas generadas por IA en notas de voz habladas |
| **Chatbots Visuales** | Typebot API | Integración nativa | Motor de diálogo e integración de flujos Typebot |
| **Canales Externos** | [NotificaMe Hub SDK](https://notificame.com.br/) | ^0.0.19 | Pasarela omnicanal (Facebook, Instagram, Telegram) |
| **Planificador de Tareas** | [node-cron](https://github.com/merencia/node-cron) & [cron](https://github.com/kelektiv/node-cron) | ^3.0.2 / ^2.1.0 | Cron jobs (transferencia de tickets, cierre automático por inactividad) |
| **Seguridad & Auth** | [JSON Web Tokens (JWT)](https://jwt.io/), [bcryptjs](https://github.com/dcodeIO/bcrypt.js), [Helmet](https://helmetjs.github.io/) | `jsonwebtoken`, `bcryptjs`, `helmet`, `express-rate-limit` | Autenticación basada en token + refresh token en cookie segura, hash de claves y rate limiting |
| **Monitoreo de Errores** | [Sentry](https://sentry.io/) | `@sentry/node` ^6.18.1 | Captura de errores y excepciones no controladas |
| **Subida de Archivos** | [Multer](https://github.com/expressjs/multer) | ^1.4.4 | Carga y gestión de archivos adjuntos e imágenes en el servidor |
| **Manejo de Plantillas** | [Mustache](https://mustache.github.io/) | ^4.2.0 | Sustitución de variables dinámicas (`{{name}}`, `{{greeting}}`) en mensajes |
| **Exportación de Datos** | [XLSX](https://github.com/SheetJS/sheetjs) | ^0.18.3 | Importación y exportación de listas de contactos en Excel/CSV |

---

### 2.2. Frontend

| Categoría | Tecnología / Librería | Versión / Detalle | Propósito |
|---|---|---|---|
| **Librería UI Base** | [React](https://react.dev/) | ^17.0.1 | Librería para interfaces de usuario SPA reactivas |
| **Enrutador** | [React Router DOM](https://v5.reactrouter.com/) | ^5.2.0 | Enrutamiento SPA, rutas protegidas (`isPrivate`) y anidadas |
| **Componentes Visuales** | [Material-UI](https://v4.mui.com/) & [MUI v5](https://mui.com/) | `@material-ui/core` 4.12.3, `@mui/material` ^5.10.13 | Sistema de diseño de interfaces, temas claro/oscuro, modales, iconos y tablas |
| **Estilos Complementarios** | [Styled Components](https://styled-components.com/) & [Bootstrap](https://getbootstrap.com/) | `styled-components` ^5.3.5, `bootstrap` ^5.2.3 | Estilización modular y utilidades CSS responsivas |
| **Constructor de Flujos** | [React Flow](https://reactflow.dev/) | `reactflow` ^11.11.4 / `react-flow-renderer` | Canvas interactivo con nodos y conexiones para el FlowBuilder de bots |
| **Gestión de Estado & Cache** | Context API & [React Query](https://tanstack.com/query/v3) | `react-query` ^3.39.3 | Estados globales (Auth, WhatsApps, Tickets, Socket) y caché de consultas |
| **Cliente WebSocket** | [Socket.IO Client](https://socket.io/docs/v4/client-api/) | ^4.7.5 | Conexión en tiempo real con el backend mediante `ManagedSocket` |
| **Formularios & Validación** | [Formik](https://formik.org/) & [Yup](https://github.com/jquense/yup) | `formik` ^2.4.0, `yup` ^0.32.8 | Validación y control de formularios (registro, configuración, creación de bots) |
| **Gráficos & Métricas** | [Chart.js](https://www.chartjs.org/) & [Recharts](https://recharts.org/) | `chart.js` ^3.9.1, `react-chartjs-2` ^4.3.1, `recharts` | Tableros de rendimiento, volumen de atención, métricas por agente |
| **Internacionalización (i18n)** | [i18next](https://www.i18next.com/) | ^19.8.2 | Soporte multi-idioma (Español, Inglés, Portugués, Turco) |
| **Grabador de Audio** | [mic-recorder-to-mp3](https://github.com/dalphyx/mic-recorder-to-mp3) | ^2.2.2 | Grabación directa de notas de voz desde el micrófono del navegador |
| **Kanban** | [react-trello](https://github.com/rcdexta/react-trello) | ^2.2.11 | Tableros tipo Trello/Kanban para administración de leads y tickets |
| **Códigos QR** | [qrcode.react](https://github.com/zpao/qrcode.react) & `react-qr-code` | ^1.0.0 / ^2.0.7 | Renderizado instantáneo del código QR para escanear con WhatsApp |

---

## 3. Arquitectura del Sistema

```mermaid
flowchart TB
    subgraph Clientes ["Clientes Finales & Canales"]
        WA[WhatsApp App / Móvil]
        FB[Facebook / Instagram]
        TG[Telegram]
    end

    subgraph Redes ["Puertas de Entrada"]
        MetaAPI["Meta Cloud API / Webhook"]
        NotificaMe["NotificaMe Hub"]
    end

    subgraph ChasapPro ["Plataforma CHASAP PRO"]
        subgraph FrontendApp ["Frontend (React 17 SPA)"]
            UI["Módulos UI / Material-UI"]
            SocketCtx["Socket Context (ManagedSocket)"]
            AxiosApi["Cliente Axios HTTP"]
        end

        subgraph BackendApp ["Backend (Express + TypeScript)"]
            ExpressRoutes["Rutas Express & Middlewares (Auth, RateLimit)"]
            Controllers["Controladores & Validaciones (Yup)"]
            Services["Capa de Servicios de Negocio"]
            SocketServer["Servidor Socket.IO (Tiempo Real)"]
            QueueProcessor["Workers Bull (Colas Redis)"]
            CronManager["Node-Cron (Transferencias & Cierres)"]
            WbotManager["Motor Baileys / Wbot (WhatsApp Web)"]
        end

        subgraph Almacenamiento ["Capa de Datos & Caché"]
            PostgreSQL[(PostgreSQL Relacional)]
            RedisCache[(Redis Queue & Cache)]
        end

        subgraph ServiciosExternos ["Integraciones & Servicios Externos"]
            OpenAI["OpenAI / DeepSeek (LLM)"]
            AzureSpeech["Azure Speech SDK (TTS Voz)"]
            Typebot["Typebot Service"]
            PaymentGateways["Asaas / Gerencianet (Cobros)"]
        end
    end

    %% Conexiones
    WA <-->|Protocolo WebSocket Baileys| WbotManager
    WA <-->|HTTP Webhook & Graph API| MetaAPI
    FB <--> NotificaMe
    TG <--> NotificaMe
    MetaAPI <--> ExpressRoutes
    NotificaMe <--> ExpressRoutes

    UI <--> AxiosApi
    UI <--> SocketCtx
    AxiosApi <-->|HTTP REST / Cookies JWT| ExpressRoutes
    SocketCtx <-->|WebSockets (ws)| SocketServer

    ExpressRoutes --> Controllers --> Services
    Services <--> PostgreSQL
    Services <--> RedisCache
    Services <--> SocketServer
    Services <--> QueueProcessor
    Services <--> WbotManager
    Services <--> OpenAI
    Services <--> AzureSpeech
    Services <--> Typebot
    Services <--> PaymentGateways

    QueueProcessor <--> RedisCache
    QueueProcessor <--> Services
    CronManager --> Services
```

---

## 4. Módulos y Cómo Funciona Cada Uno

### 4.1. Conexiones y Canales (`Connections`)
- **Baileys (WhatsApp Web):** Al crear una conexión, el backend genera una clave de sesión criptográfica en la base de datos (tabla `Baileys`) y solicita un código QR. El evento se transmite vía Socket.IO al frontend para ser renderizado con `qrcode.react`. Una vez escaneado, la sesión queda registrada en memoria (`sessions[]` en `wbot.ts`) y se mantiene sincronizada.
- **WhatsApp Business API:** Permite conectar números mediante OAuth de Meta y Graph API de Facebook, recibiendo eventos a través de webhooks dedicados (`/whatsapp/business/callback`).
- **Hub NotificaMe:** Permite unificar mensajes procedentes de canales externos como Instagram Direct, Facebook Messenger y Telegram en la misma bandeja de entrada.

### 4.2. Bandeja de Entrada & Ciclo de Vida de Tickets (`Tickets`)
Todo mensaje recibido o enviado se agrupa dentro de un **Ticket** asociado a un Contacto (`Contact`), un Canal (`Whatsapp`), una Empresa (`Company`) y opcionalmente un Agente (`User`) y una Cola (`Queue`):
1. **Estado `pending` (Pendiente):** Cuando entra un mensaje nuevo y aún no tiene agente asignado, o cuando está interactuando con el chatbot / menú de opciones.
2. **Estado `open` (Abierto):** Cuando un agente hace clic en "Aceptar" ticket. El agente toma control exclusivo del diálogo humano.
3. **Estado `closed` (Cerrado):** Cuando la atención finaliza. Puede reabrirse automáticamente si el cliente vuelve a escribir dentro o fuera de la ventana de tiempo configurada.
4. **Métricas (`TicketTraking`):** Registra marcas de tiempo precisas para auditoría: momento de creación, primer tiempo de respuesta (FRT), tiempo de atención activa y tiempo total de resolución.

### 4.3. Automatización, Colas y Chatbots

#### A. Colas de Atención Tradicionales (`Queues` & `QueueOptions`)
- Permiten organizar la atención por departamentos (ej. 1: Soporte, 2: Ventas, 3: Facturación).
- Cada opción puede tener sub-opciones hijas de múltiples niveles. Al recibir un número o letra correspondiente, el sistema navega en el árbol de opciones y redirige al departamento adecuado.

#### B. FlowBuilder (Constructor Visual con ReactFlow)
- Permite construir flujos conversacionales mediante una interfaz gráfica tipo diagrama de bloques.
- Nodos soportados: Nodos de mensaje de texto, envío de imágenes (`FlowImg`), envío de notas de voz pregrabadas (`FlowAudio`), condiciones de bifurcación, disparadores por palabras clave e integración con Webhooks externos (`ActionsWebhookService`).

#### C. Integración con Inteligencia Artificial (`Prompts` - OpenAI & DeepSeek)
- Configuración de instrucciones del sistema (*System Prompts*), temperatura (creatividad) y tokens máximos.
- Permite que una cola o canal sea respondido por IA manteniendo el contexto de los últimos mensajes intercambiados.
- Si está configurado el SDK de Microsoft Azure Speech, el sistema sintetiza la respuesta de la IA en formato de audio de voz natural y lo envía como nota de voz por WhatsApp.

#### D. Integración con Typebot
- Conecta un canal o cola directamente a un flujo interactivo de Typebot mediante webhook e intercambio de eventos en tiempo real (`typebotListener.ts`).

### 4.4. Envíos Masivos y Campañas (`Campaigns`)
- **Listas de Contactos:** Creación de grupos de destinatarios (`ContactList` / `ContactListItem`) importables mediante archivos Excel/CSV con soporte de campos personalizados.
- **Campañas Programadas:** Definición de plantillas de mensaje con variables tipo Mustache (`{{name}}`, `{{phone}}`, `{{email}}`).
- **Frases Dinámicas (`CampaignsPhrase`):** Rotación de frases y textos para mitigar bloqueos o detecciones de spam por parte de WhatsApp.
- **Motor de Despacho (Bull Queue):** La cola `campaignQueue` en Redis dosifica el envío con pausas aleatorias entre mensajes (`limiterDuration`), garantizando estabilidad operativa.
- **Reportes:** Estadísticas en tiempo real de mensajes pendientes, entregados, fallidos y cancelados.

### 4.5. Agendamientos y Tareas (`Schedules` & `ToDoList`)
- **Mensajes Programados:** Los operadores pueden programar mensajes para ser enviados en una fecha y hora futura específica a cualquier contacto (ideal para recordatorios de citas o cobranza).
- **Cola `SendScheduledMessages`:** Worker de Bull que monitorea cada minuto si hay mensajes cuya fecha programada ya se ha cumplido para procesar el envío.
- **ToDo List:** Tablero de tareas pendientes interno para que los agentes organicen su flujo de trabajo diario.

### 4.6. Chat Interno entre Usuarios (`Chat`)
- Sistema de mensajería instantánea interna entre los colaboradores de la empresa, sin salir de la plataforma y sin consumir envíos de WhatsApp.

### 4.7. Sistema Multi-Empresa & Facturación SaaS (`Financeiro`, `Plans`, `Subscriptions`)
- Permite operar el software como un modelo SaaS (Software as a Service).
- **Planes:** Controlan límites de usuarios concurrentes, conexiones de WhatsApp simultáneas, acceso a colas, campañas y constructor de flujos.
- **Facturación:** Emisión y control de facturas (`Invoices`) con soporte de pasarelas de pago brasileñas e internacionales (Asaas, Gerencianet / Efí).

### 4.8. Tableros, Reportes y Auditoría (`Dashboard` & `Reports`)
- Panel interactivo con estadísticas de volumen de mensajes por día/semana.
- Tiempos promedio de espera y atención por cola y por agente.
- Encuestas de satisfacción del cliente (`UserRating`) con puntuaciones y comentarios recibidos al finalizar la atención.

---

## 5. Estructura de Directorios del Repositorio

```text
chasap-pro/
├── backend/                        # Servidor Node.js / Express / TypeScript
│   ├── src/
│   │   ├── @types/                 # Definiciones de tipos TypeScript personalizadas
│   │   ├── config/                 # Configuraciones (upload de archivos, base de datos)
│   │   ├── controllers/            # Controladores de las rutas HTTP
│   │   ├── database/
│   │   │   ├── migrations/         # Migraciones de base de datos con Sequelize
│   │   │   ├── seeds/              # Datos semilla iniciales (usuario admin, settings)
│   │   │   └── index.ts            # Conexión Sequelize e importación de modelos
│   │   ├── errors/                 # Clases de error personalizadas (AppError)
│   │   ├── helpers/                # Funciones auxiliares (Mustache, JWT, Auth, Debounce)
│   │   ├── libs/                   # Librerías centrales
│   │   │   ├── wbot.ts             # Instanciación y gestión de sesiones Baileys
│   │   │   ├── socket.ts           # Inicialización y emisores de Socket.IO
│   │   │   ├── cache.ts            # Capa de caché con Redis
│   │   │   └── in-memory-store.ts  # Almacén de chats y mensajes de WhatsApp en memoria
│   │   ├── middleware/             # Middlewares (isAuth, rate limiting, validadores)
│   │   ├── models/                 # Modelos Sequelize (Ticket, User, Message, Whatsapp, etc.)
│   │   ├── routes/                 # Enrutadores REST organizados por recurso
│   │   ├── services/               # Lógica de negocio (WbotServices, TicketServices, etc.)
│   │   ├── utils/                  # Logger (Pino) y utilitarios generales
│   │   ├── app.ts                  # Configuración de Express, middlewares y rutas
│   │   ├── server.ts               # Punto de entrada: arranque de Express, Sockets y Cron
│   │   ├── queues.ts               # Definición y procesadores de colas Bull (Redis)
│   │   └── wbotTransferTicketQueue.ts # Lógica de transferencia automática de tickets
│   ├── .env.example                # Variables de entorno de ejemplo para el backend
│   ├── package.json                # Dependencias y scripts del backend
│   └── tsconfig.json               # Configuración del compilador TypeScript
│
├── frontend/                       # Aplicación Web React 17
│   ├── public/                     # Archivos estáticos, manifest, favicons
│   ├── src/
│   │   ├── assets/                 # Logotipos, sonidos de notificación, imágenes
│   │   ├── components/             # Componentes reutilizables (modales, tablas, tickets)
│   │   ├── context/                # Contextos React (Auth, Tickets, Socket, WhatsApp)
│   │   ├── hooks/                  # Hooks personalizados (useTickets, useAuth, etc.)
│   │   ├── layout/                 # Layout principal con barra lateral y menú superior
│   │   ├── pages/                  # Vistas completas del sistema (Tickets, Kanban, etc.)
│   │   ├── routes/                 # Definición de rutas con react-router-dom
│   │   ├── services/               # Clientes Axios y conexión WebSocket gestionada
│   │   ├── translate/              # Archivos de idioma (es, en, pt, tr) con i18next
│   │   ├── App.js                  # Componente raíz con tema y proveedores
│   │   └── index.js                # Punto de entrada de ReactDOM
│   ├── .env.example                # Variables de entorno de ejemplo para el frontend
│   ├── package.json                # Dependencias y scripts del frontend
│   └── server.js                   # Servidor Express ligero para producción
│
├── INSTALL_LINUX                   # Guía rápida de comandos para instalación en Linux
├── FIXES                           # Registro de errores y bugs
└── README.md                       # Documento introductorio general
```

---

## 6. Flujo de Ejecución Detallado

### 6.1. Arranque del Backend (`server.ts`)
1. Se carga la configuración de entorno (`dotenv`).
2. Se inicia la conexión con la base de datos PostgreSQL a través de Sequelize (`./database`).
3. Se monta el servidor Express en el puerto configurado (`PORT=4000`).
4. Se consultan todas las empresas activas (`Company.findAll({ where: { status: true } })`).
5. Por cada empresa activa, se ejecuta `StartAllWhatsAppsSessions(companyId)`, reconectando automáticamente los canales que estuvieran vinculados previamente.
6. Se inicia el procesamiento de colas en segundo plano (`startQueueProcess()`).
7. Se programa el cron job que ejecuta `TransferTicketQueue()` cada 5 minutos para transferir tickets abandonados o sin respuesta.
8. Se asocia el servidor HTTP con Socket.IO (`initIO(server)`).

### 6.2. Ciclo de un Mensaje Entrante por WhatsApp
1. El evento de mensaje llega desde los servidores de WhatsApp a través del WebSocket de Baileys (`messages.upsert`).
2. El listener central `wbotMessageListener.ts` intercepta el payload.
3. Se verifica si el remitente existe en `Contacts`. Si no, se crea automáticamente descargando nombre y foto de perfil (`GetProfilePicUrl`).
4. Se busca o crea el ticket correspondiente (`FindOrCreateTicketService`).
5. Se almacena el mensaje en la base de datos (`CreateMessageService`), descargando archivos multimedia (audio, imagen, video, pdf) a la carpeta `/public` si aplica.
6. Se emite un evento Socket.IO al canal de la empresa (`appMessage`, `ticket`) para actualizar la interfaz del frontend de todos los agentes conectados en tiempo real.
7. Se evalúa el estado del ticket:
   - Si está en horario de atención o fuera de horario (mensaje de bienvenida / ausencia).
   - Si la cola tiene asociado un chatbot de texto, un flujo visual (`FlowBuilder`), un Typebot o un modelo de IA (`Prompt` con OpenAI o DeepSeek).
   - Si responde el bot o la IA, el sistema genera la respuesta y la envía de vuelta mediante `SendWhatsAppMessage` o `SendWhatsAppMedia`.

### 6.3. Ciclo de un Mensaje Saliente (Enviado por Agente)
1. El operador escribe o adjunta un archivo en el chat del frontend y presiona enviar.
2. El frontend realiza una petición `POST /messages/:ticketId` con el contenido y el token JWT de autenticación.
3. El controlador valida la solicitud y despacha el servicio correspondiente (`SendWhatsAppMessage` o `SendWhatsAppMedia`).
4. Si el canal es Baileys, la sesión de socket envía el paquete a los servidores de WhatsApp. Si es WhatsApp Business Cloud API, se hace un llamado a la API de Meta.
5. El mensaje se inserta en PostgreSQL y se notifica al frontend vía Socket.IO confirmando el estado del mensaje (`ack: 1` enviado, `ack: 2` recibido en teléfono, `ack: 3` leído/azul).

---

## 7. Variables de Entorno Clave

### Backend (`backend/.env`)
```ini
NODE_ENV=production
BACKEND_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000
PORT=4000

# Base de Datos
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=tu_contraseña
DB_NAME=chasap_pro

# Autenticación JWT
JWT_SECRET=super_clave_secreta_jwt
JWT_REFRESH_SECRET=super_clave_secreta_refresh

# Redis & Colas
REDIS_URI=redis://127.0.0.1:6379
REDIS_OPT_LIMITER_MAX=1
REDIS_OPT_LIMITER_DURATION=3000

# Parámetros Operativos
USER_LIMIT=10000
CONNECTIONS_LIMIT=100000
CLOSED_SEND_BY_ME=true
```

### Frontend (`frontend/.env`)
```ini
NODE_ENV=production
REACT_APP_BACKEND_URL=http://localhost:4000
REACT_APP_HOURS_CLOSE_TICKETS_AUTO=24
FAST_REFRESH=false
WATCHPACK_POLLING=true
```

---

## 8. Guía de Puesta en Marcha Rápida

### 8.1. Requisitos Previos
- **Node.js:** Versión 22 o superior
- **PostgreSQL:** Versión 12 o superior
- **Redis:** Servidor Redis activo en el puerto 6379
- **FFmpeg:** Instalado en el sistema operativo para conversión de audios

### 8.2. Pasos para el Backend
```bash
# 1. Acceder al directorio backend
cd backend

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# (Editar .env con los datos correctos de Postgres y Redis)

# 4. Compilar TypeScript
npm run build

# 5. Crear la base de datos y ejecutar migraciones y semillas
npx sequelize db:create
npm run db:migrate
npm run db:seed

# 6. Iniciar el servidor
npm start
# (O para desarrollo: npm run dev:server)
```

> **Credenciales creadas por defecto por los seeds:**  
> - **Usuario:** `admin@admin.com`  
> - **Contraseña:** `123456`

### 8.3. Pasos para el Frontend
```bash
# 1. Acceder al directorio frontend
cd ../frontend

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# (Verificar REACT_APP_BACKEND_URL)

# 4. Iniciar en modo desarrollo
npm start

# (Para producción)
npm run build
npm run serve
```

---

## 9. Resumen de Seguridad y Buenas Prácticas
1. **Autenticación en dos niveles:** Acceso protegido mediante Access Token JWT de corta duración y Refresh Token almacenado en cookies `HttpOnly` y `SameSite`.
2. **Rate Limiting:** Protección anti-fuerza bruta en rutas críticas como `/auth` mediante `express-rate-limit`.
3. **Control de Flujo Anti-Baneo:** Delays y rotación aleatoria de frases en campañas para proteger las cuentas de WhatsApp frente a bloqueos de Meta.
4. **Manejo de Errores Centralizado:** Captura de errores con middleware global en Express, loggeo estructurado con Pino y reporte de excepciones en producción con Sentry.
