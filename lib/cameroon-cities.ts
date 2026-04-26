import { City } from "country-state-city";

export function getCameroonCities(): string[] {
  const cities = City.getCitiesOfCountry("CM") ?? [];
  return cities
    .map((c) => c.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "fr"));
}
