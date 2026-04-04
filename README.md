# Reserva de Canchas - Club Atlético Empalme Central (Tenis)

Esta es la PWA (Progressive Web App) para la gestión y reserva de canchas de tenis del club.

## Requisitos previos
- Node.js instalado (para poder ejecutar NPM)
- Un proyecto gratuito creado en [Supabase](https://supabase.com).

## Configuración de Base de Datos (Supabase)
1. Ve al SQL Editor en tu panel de Supabase.
2. Copia y pega el contenido del archivo `supabase_setup.sql` que se encuentra en la raíz de este proyecto.
3. Ejecútalo. Esto creará el esquema necesario, las políticas de seguridad (RLS) y los datos por defecto (Canchas y usuario Administrador).

## Variables de Entorno
1. Crea un archivo llamado `.env` en la raíz del proyecto.
2. Agrega las siguientes variables obtenidas de la configuración de tu proyecto en Supabase (Settings > API):

```env
VITE_SUPABASE_URL=tu_url_aqui
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

## Creación del Primer Usuario (Auth)
Como la aplicación usa Supabase Auth, debes crear los usuarios en la pestaña **Authentication** de Supabase para poder ingresar, ya que nuestro script solo crea la "ficha" del socio pero no la cuenta real de login.
1. Ve a **Authentication > Users > Add user**.
2. Email: `admin@empalmecentral.com`
3. Contraseña: `1234` (O los últimos 4 dígitos si usaras un DNI real de un admin).

Para usuarios normales (socios):
1. Desde la plataforma (o creándolos aquí en Auth), sus emails deben ser `{DNI}@empalmecentral.com` y su password los 4 últimos dígitos del DNI. El sistema cruzará esto de forma automática con la tabla `socios`.

## Ejecución Local
Para probar la aplicación en tu computadora:

```bash
npm install
npm run dev
```

Esto abrirá la aplicación web en `http://localhost:5173`.

## Compilación y Despliegue (Netlify / Vercel / GitHub Pages)
Dado que es una PWA basada en React (Vite), compilarla es tan sencillo como:

```bash
npm run build
```

Esto generará una carpeta `dist/`. Puedes simplemente arrastrar y soltar esa carpeta en la carga manual de [Netlify DROP](https://app.netlify.com/drop) para que el sitio quede online de manera instantánea o linkear tu repositorio de GitHub a Vercel/Netlify.
Al publicarlo, los usuarios podrán abrir la web y si están en celular, seleccionar "Añadir a la pantalla de inicio" para instalarla como una App Nativa.
