import OneSignal from 'react-onesignal';

// Promise-based guard para evitar inicializaciones paralelas (race condition)
let initPromise: Promise<void> | null = null;

const doInit = async (): Promise<void> => {
  await OneSignal.init({
    appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
    allowLocalhostAsSecureOrigin: true,
    serviceWorkerPath: '/sw.js',
    serviceWorkerParam: { scope: '/' },
    welcomeNotification: {
      title: '¡CAEC Tenis!',
      message: 'Notificaciones activadas. Te avisaremos cuando se libere un turno.',
    },
  });
};

export const isPushNotificationsSupported = (): boolean => {
  if (!('Notification' in window)) return false;
  
  // En iOS, las notificaciones Push Web solo funcionan si es PWA (agregada a pantalla de inicio)
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  if (isIos) {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as any).standalone === true);
    if (!isStandalone) {
      return false;
    }
  }
  
  return true;
};

/** Inicializa OneSignal una sola vez. Puede llamarse múltiples veces de forma segura. */
export const initOneSignal = (): Promise<void> => {
  if (!initPromise) {
    initPromise = doInit().catch(err => {
      console.error('[OneSignal] Error al inicializar:', err);
      initPromise = null; // Permite reintentar si falla
    }) as Promise<void>;
  }
  return initPromise;
};

/** Vincula el DNI del socio como external_id en OneSignal. */
export const loginOneSignal = async (dni: string): Promise<void> => {
  try {
    await initOneSignal();
    await OneSignal.login(String(dni));
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        await (OneSignal.User as any)?.PushSubscription?.optIn?.();
      } catch (_) {}
    }
    console.log(`[OneSignal] Usuario vinculado: ${dni}`);
  } catch (err) {
    console.error('[OneSignal] Error al vincular usuario:', err);
  }
};

/** Solicita permiso de notificaciones al usuario con timeout de seguridad para no colgar la UI. */
export const requestNotificationPermission = async (): Promise<boolean> => {
  const withTimeout = <T>(promise: Promise<T>, ms = 4000): Promise<T | null> =>
    Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);

  try {
    if (!('Notification' in window)) return false;

    // 1. Pedir permiso directamente al navegador con el gesto de clic activo
    let perm = Notification.permission;
    if (perm === 'default') {
      const requested = await withTimeout(window.Notification.requestPermission());
      perm = requested || Notification.permission;
    }

    // 2. Si fue otorgado, inicializar OneSignal y activar PushSubscription
    if (perm === 'granted') {
      await withTimeout(initOneSignal(), 3000);
      try {
        await withTimeout((OneSignal.User as any)?.PushSubscription?.optIn?.(), 3000);
      } catch (optErr) {
        console.warn('[OneSignal] Advertencia al activar PushSubscription:', optErr);
      }
    }

    return perm === 'granted';
  } catch (err) {
    console.error('[OneSignal] Error al pedir permiso:', err);
    return false;
  }
};

/** Devuelve true si el usuario ya concedió permiso de notificaciones. */
export const getNotificationPermission = async (): Promise<boolean> => {
  try {
    await initOneSignal();
    return OneSignal.Notifications.permission;
  } catch {
    return false;
  }
};
