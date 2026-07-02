import type { Location } from "@/api/types";

export const getLocationDisplayText = (location: Location): string => {
  return location.placeholder || `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
};

export const getLocationCoordinatesText = (location: Location, digits = 4): string => {
  return `${location.latitude.toFixed(digits)}°, ${location.longitude.toFixed(digits)}°`;
};
