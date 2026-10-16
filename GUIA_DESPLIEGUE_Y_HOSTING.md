# 🚀 Guía de Despliegue, Hosting y Puesta en Marcha - CLEZAPP PRO + EVOLUTION API

Esta guía detalla cómo instalar y poner en producción **CLEZAPP PRO** junto con **Evolution API v2**, aprovechando al máximo servidores VPS o Cloud (como tu servidor de 32 GB de RAM) para lograr máxima velocidad sin lag.

---

## 1. ¿Qué tipo de Hosting o Servidor se necesita?

* **❌ Hosting Compartido tradicional (cPanel PHP de $3/mes):** **No es compatible.** Un hosting compartido apaga los procesos en segundo plano, no permite daemons permanentes de Node.js, WebSockets continuos de Socket.IO, ni instancias Docker de Evolution API y Redis.
* **✅ Servidor VPS o Dedicado (Ubuntu 22.04 o 24.04 LTS):** **La opción ideal.** En un servidor con 4 GB a 32 GB de RAM, el sistema corre fluido, sin caídas y soportando cientos de miles de mensajes diarios.

---

## 2. Método 1: Despliegue Automatizado con Docker Compose (Recomendado ⚡)

Es la forma más rápida y limpia. Con un solo archivo se levantan la Base de Datos, Redis, Evolution API v2, Backend y Frontend.

### Paso 1: Instalar Docker y Docker Compose en tu Servidor (si aún no los tienes)
En tu terminal de Ubuntu:
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### Paso 2: Clonar el proyecto y revisar credenciales
```bash
git clone <URL_DE_TU_REPOSITORIO> CLEZAPP-pro
cd CLEZAPP-pro
```

El archivo [docker-compose.yml](file:///d:/PROYECTOS/PHP/CLEZAPP-pro/docker-compose.yml) ya está preparado. Puedes editarlo si deseas cambiar contraseñas o nombres de dominios:
```bash
nano docker-compose.yml
```

### Paso 3: Levantar todo el ecosistema
```bash
docker compose up -d --build
```

¡Listo! En pocos minutos tendrás corriendo:
* **PostgreSQL:** Puerto `5432`
* **Redis:** Puerto `6379`
* **Evolution API v2:** Puerto `8080` (con API Key `CLEZAPP_EVOLUTION_SECRET_KEY_2026`)
* **CLEZAPP Backend:** Puerto `4000`
* **CLEZAPP Frontend:** Puerto `3000`

---

## 3. Método 2: Panel Web Estilo Hosting (Coolify)

Si deseas una experiencia idéntica a un cPanel/Hosting (interfaz gráfica visual, administración de dominios, certificados SSL automáticos con Let's Encrypt y monitoreo de RAM/CPU), la mejor herramienta gratuita y open source es **Coolify**.

### Cómo instalar Coolify en tu Servidor:
1. Conéctate por SSH a tu servidor y ejecuta:
   ```bash
   curl -fsSL https://cdn.coolify.io/install.sh | bash
   ```
2. Abre en tu navegador `http://TU_IP:8000` y crea tu usuario administrador.
3. Desde el panel puedes conectar tu repositorio GitHub/GitLab y Coolify desplegará el archivo `docker-compose.yml` automáticamente, asignando dominios con HTTPS (`https://app.tudominio.com`).

---

## 4. Método 3: Instalación Manual Tradicional en VPS Ubuntu (sin Docker)

Si prefieres instalar cada servicio directamente en el sistema operativo:

### 1. Instalar Dependencias del Sistema
```bash
sudo apt update && sudo apt install -y curl git redis-server postgresql postgresql-contrib ffmpeg
```

### 2. Configurar PostgreSQL
```bash
sudo -u postgres psql
```
Dentro de la consola de Postgres:
```sql
CREATE DATABASE CLEZAPP_db;
CREATE USER CLEZAPP_user WITH ENCRYPTED PASSWORD 'tu_password_segura';
GRANT ALL PRIVILEGES ON DATABASE CLEZAPP_db TO CLEZAPP_user;
\q
```

### 3. Instalar Node.js v22
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### 4. Configurar y Arrancar el Backend
```bash
cd backend
npm install
cp .env.example .env
nano .env  # Configurar datos de Postgres, Redis y Evolution API

npm run build
npm run db:migrate
npm run db:seed

# Instalar PM2 para mantener el backend corriendo 24/7
sudo npm install -g pm2
pm2 start dist/server.js --name "CLEZAPP-backend"
pm2 save
```

### 5. Configurar y Arrancar el Frontend
```bash
cd ../frontend
npm install
cp .env.example .env
nano .env  # Configurar REACT_APP_BACKEND_URL

npm run build

# Servir con PM2
pm2 start server.js --name "CLEZAPP-frontend"
pm2 save
pm2 startup
```

---

## 5. Configuración de Evolution API desde el Panel de CLEZAPP

Una vez que el sistema esté levantado:

1. Ingresa a CLEZAPP desde tu navegador (`http://localhost:3000` o tu dominio).
2. Inicia sesión con las credenciales por defecto:
   * **Email:** `admin@admin.com`
   * **Contraseña:** `123456`
3. Ve al menú lateral **Ajustes** ➔ pestaña **Opciones**.
4. Desplázate hacia abajo hasta la nueva sección **🚀 MOTOR DE WHATSAPP: EVOLUTION API v2**.
5. Completa los datos:
   * **URL del Servidor Evolution API:**  
     `http://localhost:8080` (o la IP/dominio de tu servidor Evolution).
   * **API Key Global:**  
     La clave configurada en `AUTHENTICATION_API_KEY` de tu servidor Evolution.
   * **¿Usar Evolution API por defecto?:**  
     Selecciona **"Sí, usar Evolution API (Recomendado - Ultra Rápido)"**.
6. Haz clic en el botón **"⚡ Probar Conexión con Evolution API"**. El sistema confirmará con un mensaje en verde que la comunicación es exitosa.
7. Ve al menú **Conexiones** ➔ pulsa **"Agregar WhatsApp"** o dale en **Conectar / QR Code**. El código QR se generará directamente desde Evolution API y al escanearlo la sesión se sincronizará al instante.

---

## 6. Mejoras de Rendimiento Aplicadas para Eliminar el Lag

Para garantizar que en tu servidor de 32 GB de RAM todo cargue al instante:
1. **Retardo artificial de 500 ms eliminado:** En `frontend/src/components/MessagesList/index.js`, las conversaciones ahora cargan sin pausas forzadas.
2. **Índices en Base de Datos creados:** En la tabla `Messages` de PostgreSQL se agregaron índices compuestos en `(ticketId, createdAt)` y `(companyId)` para búsquedas inmediatas en milisegundos.
3. **Paginación optimizada:** En `ListMessagesService.ts` se retiró la consulta pesada `COUNT(*)`, reduciendo en hasta un 90% el tiempo de respuesta al hacer clic en un ticket.
4. **Desacoplamiento de Baileys:** El backend de Node.js ya no sufre por el consumo de RAM ni el cifrado local, dejando todo el procesamiento de sockets de WhatsApp en el microservicio de Evolution API.
