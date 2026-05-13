/**
 * Weather utility using the free Open-Meteo API (no key required).
 * Geocodes a city name to lat/lon, then fetches current conditions.
 */

export type WeatherData = {
  city: string;
  temperature: number; // Celsius
  condition: string;   // e.g. "Clear sky", "Light rain"
  icon: string;        // emoji
};

const WMO_CODES: Record<number, { condition: string; icon: string }> = {
  0:  { condition: "Clear sky", icon: "☀️" },
  1:  { condition: "Mainly clear", icon: "🌤️" },
  2:  { condition: "Partly cloudy", icon: "⛅" },
  3:  { condition: "Overcast", icon: "☁️" },
  45: { condition: "Foggy", icon: "🌫️" },
  48: { condition: "Freezing fog", icon: "🌫️" },
  51: { condition: "Light drizzle", icon: "🌦️" },
  53: { condition: "Drizzle", icon: "🌦️" },
  55: { condition: "Heavy drizzle", icon: "🌧️" },
  61: { condition: "Light rain", icon: "🌧️" },
  63: { condition: "Rain", icon: "🌧️" },
  65: { condition: "Heavy rain", icon: "🌧️" },
  71: { condition: "Light snow", icon: "🌨️" },
  73: { condition: "Snow", icon: "❄️" },
  75: { condition: "Heavy snow", icon: "❄️" },
  80: { condition: "Light showers", icon: "🌦️" },
  81: { condition: "Showers", icon: "🌧️" },
  82: { condition: "Heavy showers", icon: "⛈️" },
  95: { condition: "Thunderstorm", icon: "⛈️" },
};

export async function fetchWeatherByCity(city: string): Promise<WeatherData | null> {
  try {
    // Step 1: Geocode the city name
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    );
    const geoData = await geoRes.json();
    const location = geoData?.results?.[0];
    if (!location) return null;

    const { latitude, longitude, name } = location;

    // Step 2: Fetch current weather
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=celsius&timezone=auto`
    );
    const weatherData = await weatherRes.json();
    const current = weatherData?.current;
    if (!current) return null;

    const wmo = WMO_CODES[current.weather_code] ?? { condition: "Unknown", icon: "🌡️" };

    return {
      city: name,
      temperature: Math.round(current.temperature_2m),
      condition: wmo.condition,
      icon: wmo.icon,
    };
  } catch (error) {
    console.error("Weather fetch error:", error);
    return null;
  }
}

export function buildWeatherContext(weather: WeatherData | null): string {
  if (!weather) return "";
  return `\n\nCurrent Weather in ${weather.city}: ${weather.temperature}°C, ${weather.condition}. Factor this into your outfit recommendation (e.g. suggest outerwear if cold or rainy, light breathable clothing if warm).`;
}
