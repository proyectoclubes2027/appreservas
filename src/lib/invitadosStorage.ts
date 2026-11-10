export interface InvitadoDato {
  nombre: string;
  dni: string;
}

const STORAGE_KEY = 'caec_invitados_frecuentes';

export function getInvitadosFrecuentes(): InvitadoDato[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function guardarInvitadoFrecuente(invitado: InvitadoDato): void {
  const cleanNombre = (invitado.nombre || '').trim();
  const cleanDni = (invitado.dni || '').trim();
  if (!cleanNombre && !cleanDni) return;

  try {
    const lista = getInvitadosFrecuentes();
    // Evitar duplicados por DNI o Nombre idéntico
    const filtrada = lista.filter(item => {
      const matchDni = cleanDni && item.dni === cleanDni;
      const matchNom = cleanNombre && item.nombre.toLowerCase() === cleanNombre.toLowerCase();
      return !matchDni && !matchNom;
    });

    const actualizada = [
      { nombre: cleanNombre, dni: cleanDni },
      ...filtrada,
    ].slice(0, 10); // Guardamos hasta los 10 más recientes

    localStorage.setItem(STORAGE_KEY, JSON.stringify(actualizada));
  } catch (e) {
    console.warn('Error guardando invitado frecuente:', e);
  }
}
