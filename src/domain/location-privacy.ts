export type Coordinates = { lat: number; lng: number };

/**
 * Rounds coordinates so only an approximate area is ever shown publicly.
 * 2 decimals is roughly 1 km, which keeps a business findable without exposing an address.
 */
export function coarsenLocation({ lat, lng }: Coordinates, decimals = 2): Coordinates {
  if (!Number.isInteger(decimals) || decimals < 0) throw new RangeError("Invalid decimals");
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new RangeError("Invalid coordinates");
  }
  const factor = 10 ** decimals;
  return { lat: Math.round(lat * factor) / factor, lng: Math.round(lng * factor) / factor };
}
