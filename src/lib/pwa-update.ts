/**
 * Utilidades para forzar la actualización de la PWA y limpiar cachés locales.
 * Especialmente útil en iOS (iPhone / Safari) donde el sistema operativo retiene
 * la versión anterior en memoria en modo Standalone (pantalla de inicio).
 */

export async function forzarActualizacionApp(): Promise<void> {
  try {
    // 1. Limpiar todas las cachés locales almacenadas (Cache Storage API)
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }

    // 2. Forzar actualización de todos los Service Workers registrados
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.update();
      }
    }

    // 3. Limpiar almacenamiento de sesión temporal si existiera
    sessionStorage.clear();

    // 4. Recargar la página forzando la solicitud desde el servidor
    window.location.reload();
  } catch (error) {
    console.error('Error al forzar actualización:', error);
    window.location.reload();
  }
}
