# Guía de Git, GitHub y Vercel para Reservas CAEC

## 1. ¿Qué es lo que hicimos hoy?

Armamos el "puente" automático entre tu computadora y la nube para que tu página esté siempre online. Hicimos tres cosas clave:

1. **Iniciamos Git en tu computadora (`git init`)**: Esto creó una especie de "máquina del tiempo" local que registra y vigila todos los cambios en los archivos de tu proyecto.
2. **Subimos todo a GitHub (`git push`)**: GitHub es un pendrive seguro en la nube. Allí guardamos todo el código fuente de tu aplicación. 
3. **Conectamos GitHub con Vercel**: Vercel es el servidor web de alta velocidad. Quedó vinculado a tu repositorio de GitHub para "escuchar" los cambios y reconstruir tu página para el público general en la dirección: `https://reservas-caec.vercel.app/`

> **Aclaración de seguridad:** Por protección, dejamos configurado tu archivo `.gitignore` para que tus contraseñas y contraseñas de base de datos (`.env` y `clavebasededatos.txt`) NUNCA se suban a Internet y queden seguras solo en tu computadora y en el panel interno de Vercel.

---

## 2. ¿Cómo actualizar la página a partir de ahora?

El proceso desde ahora es increíblemente fácil porque Vercel hace todo el trabajo pesado automáticamente cada vez que enviás algo nuevo a GitHub.

Si mañana agregás un botón nuevo, cambiás un color de Tailwind, o modificás algún archivo `.tsx` de tu proyecto, solo tenés que hacer estos **3 pasos en la terminal** de comandos estando en la carpeta de tu proyecto.

### Paso 1: Agregar los cambios
Este comando le dice a Git "prepará TODOS los archivos que modifiqué o creé hoy para ser guardados". No te olvides del punto (`.`) al final seguido de un espacio, significa "todo".
```bash
git add .
```

### Paso 2: Ponerle un nombre a la versión (El Commit)
Acá empaquetás esos cambios y les ponés un título descriptivo para acordarte qué hiciste. Cambiá el mensaje dentro de las comillas por lo que tenga sentido.
```bash
git commit -m "Cambié el color del botón principal a rojo"
```

### Paso 3: Subirlo a la nube (El Push)
Este es el comando mágico. Sube el "paquete" que armaste en el paso 2 directamente a tu repositorio en GitHub.
```bash
git push
```

### ¡Y listo!
Al instante en que haces el `git push`, pasan **AUTOMÁTICAMENTE** dos cosas:
1. Tu código nuevo se sube y actualiza en GitHub.
2. **Vercel se da cuenta** de la actualización, agarra tu código y empieza a reconstruir la página (*deploy*) él solo en el servidor real. En 1 o 2 minutos, la gente que entre a `https://reservas-caec.vercel.app/` va a ver los cambios automáticamente sin que vos tengas que hacer click en ningún otro lado.
