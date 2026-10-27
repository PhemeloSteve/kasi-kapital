/** Plain-language reasons why the browser could not share a location (GeolocationPositionError codes). */
export function describeGeolocationFailure(code: number | null, isSecureContext: boolean): string {
  if (!isSecureContext) {
    return "Your browser only shares location on secure pages (https or localhost). Open the app at localhost:3000, or click your area on the map.";
  }
  switch (code) {
    case 1:
      return "Location permission was blocked. Allow it with the lock icon next to the address bar, or click your area on the map.";
    case 2:
      return "Your device couldn't work out where it is. This is common on desktop computers. Click your area on the map instead.";
    case 3:
      return "Finding your location took too long. Try again, or click your area on the map.";
    default:
      return "We couldn't get your location. Click your area on the map instead.";
  }
}
