/**
 * Tool: get_weather
 * Returns current weather conditions for a given city.
 * (Uses a static mock dataset; swap in a real API like OpenWeatherMap in production.)
 */

export interface WeatherResult {
  location: string;
  temperature: number;
  unit: "celsius" | "fahrenheit";
  condition: string;
  humidity: number;
  windSpeed: number;
  windUnit: string;
  forecast: string;
  timestamp: string;
}

interface WeatherEntry {
  location: string;
  temperatureCelsius: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  windUnit: string;
  forecast: string;
}

const WEATHER_DB: Record<string, WeatherEntry> = {
  "new york":  { location: "New York, NY, USA",   temperatureCelsius: 22, condition: "Partly Cloudy", humidity: 65, windSpeed: 12, windUnit: "km/h", forecast: "Rain showers expected tomorrow afternoon." },
  "london":    { location: "London, UK",           temperatureCelsius: 15, condition: "Overcast",      humidity: 80, windSpeed: 18, windUnit: "km/h", forecast: "Continued overcast skies through the week." },
  "tokyo":     { location: "Tokyo, Japan",         temperatureCelsius: 28, condition: "Sunny",         humidity: 55, windSpeed: 8,  windUnit: "km/h", forecast: "Clear skies for the next 5 days." },
  "paris":     { location: "Paris, France",        temperatureCelsius: 18, condition: "Clear",         humidity: 60, windSpeed: 10, windUnit: "km/h", forecast: "Pleasant weather continuing through the week." },
  "sydney":    { location: "Sydney, Australia",    temperatureCelsius: 25, condition: "Sunny",         humidity: 50, windSpeed: 15, windUnit: "km/h", forecast: "Mild and sunny for the next 3 days." },
  "dubai":     { location: "Dubai, UAE",           temperatureCelsius: 38, condition: "Hot & Sunny",   humidity: 30, windSpeed: 20, windUnit: "km/h", forecast: "Extreme heat advisory in effect." },
  "toronto":   { location: "Toronto, Canada",      temperatureCelsius: 10, condition: "Cloudy",        humidity: 70, windSpeed: 22, windUnit: "km/h", forecast: "Light snow possible this weekend." },
  "berlin":    { location: "Berlin, Germany",      temperatureCelsius: 12, condition: "Light Rain",    humidity: 85, windSpeed: 14, windUnit: "km/h", forecast: "Rain clearing by Thursday." },
  "singapore": { location: "Singapore",            temperatureCelsius: 31, condition: "Thunderstorms", humidity: 90, windSpeed: 11, windUnit: "km/h", forecast: "Daily afternoon thunderstorms expected." },
  "mumbai":    { location: "Mumbai, India",        temperatureCelsius: 33, condition: "Humid & Sunny", humidity: 88, windSpeed: 9,  windUnit: "km/h", forecast: "High humidity persisting all week." },
};

function toFahrenheit(c: number): number {
  return Math.round(c * 9 / 5 + 32);
}

export function getWeather(
  location: string,
  unit: "celsius" | "fahrenheit" = "celsius"
): WeatherResult | null {
  const key = location.toLowerCase().trim();
  const entry = Object.entries(WEATHER_DB).find(([k]) => key.includes(k) || k.includes(key));
  if (!entry) return null;

  const base = entry[1];
  const temperature = unit === "fahrenheit" ? toFahrenheit(base.temperatureCelsius) : base.temperatureCelsius;

  return {
    location:    base.location,
    temperature,
    unit,
    condition:   base.condition,
    humidity:    base.humidity,
    windSpeed:   base.windSpeed,
    windUnit:    base.windUnit,
    forecast:    base.forecast,
    timestamp:   new Date().toISOString(),
  };
}

export function listSupportedCities(): string[] {
  return Object.values(WEATHER_DB).map((d) => d.location);
}
