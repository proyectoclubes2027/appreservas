// Coordenadas aproximadas del predio de tenis del Club Atlético Riberas del Paraná
// Hipólito Yrigoyen / Juan José Paso, Empalme Villa Constitución, Santa Fe
export const CLUB_COORDINATES = {
  latitude: -33.26424,
  longitude: -60.38014,
  // Radio permitido en metros (cubre todas las canchas, vestuarios y quincho con margen de señal GPS)
  maxDistanceMeters: 450,
};

/**
 * Fórmula de Haversine para calcular distancia entre dos coordenadas en metros
 */
export function calcularDistanciaMetros(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Radio de la Tierra en metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

