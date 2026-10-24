export type Coordinates = { lat: number; lng: number };

/**
 * Rounds coordinates so only an approximate area is ever shown publicly.
 * 2 decimals is roughly 1 km, which keeps a business findable without exposing an address.
 */
export function coarsenLocation({ lat, lng }: Coordinates, decimals = 2): Coordinates {
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new RangeError("Invalid coordinates");
  }
  const factor = 10 ** decimals;
  return { lat: Math.round(lat * factor) / factor, lng: Math.round(lng * factor) / factor };
}
