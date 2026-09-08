const COUNTRIES = new Set([
  'india',
  'usa',
  'us',
  'united states',
  'united states of america',
  'uk',
  'united kingdom',
  'uae',
  'united arab emirates',
  'australia',
  'china',
  'japan',
  'germany',
  'france',
  'canada',
  'malaysia',
  'philippines',
  'indonesia',
  'thailand',
  'vietnam',
  'sri lanka',
  'bangladesh',
  'nepal',
  'pakistan',
  'south africa',
  'netherlands',
  'ireland',
  'switzerland',
  'sweden',
  'norway',
  'denmark',
  'finland',
  'spain',
  'italy',
  'brazil',
  'mexico',
  'korea',
  'south korea',
  'taiwan',
  'new zealand',
  'qatar',
  'saudi arabia',
  'kuwait',
  'oman',
  'bahrain',
]);

const CITY_ALIASES: Record<string, string> = {
  bangalore: 'Bengaluru',
  bengaluru: 'Bengaluru',
  gurgaon: 'Gurugram',
  gurugram: 'Gurugram',
  bombay: 'Mumbai',
  mumbai: 'Mumbai',
  calcutta: 'Kolkata',
  kolkata: 'Kolkata',
  madras: 'Chennai',
  chennai: 'Chennai',
  'new delhi': 'New Delhi',
  delhi: 'New Delhi',
  pune: 'Pune',
  hyderabad: 'Hyderabad',
  noida: 'Noida',
  singapore: 'Singapore',
  dubai: 'Dubai',
  london: 'London',
};

const COUNTRY_LABELS: Record<string, string> = {
  usa: 'United States',
  us: 'United States',
  'united states': 'United States',
  'united states of america': 'United States',
  uk: 'United Kingdom',
  'united kingdom': 'United Kingdom',
  uae: 'UAE',
  'united arab emirates': 'UAE',
};

function asText(value?: string | null): string {
  return String(value || '').trim();
}

function key(value?: string | null): string {
  return asText(value).toLowerCase().replace(/\s+/g, ' ');
}

function isCountryName(value?: string | null): boolean {
  return COUNTRIES.has(key(value));
}

function prettyCountry(value?: string | null): string | null {
  if (!isCountryName(value)) return null;
  return COUNTRY_LABELS[key(value)] || asText(value);
}

function canonicalCity(value?: string | null): string | null {
  const text = asText(value);
  if (!text) return null;
  const parts = text.split(/[,/|]/).map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    if (isCountryName(part)) continue;
    const mapped = CITY_ALIASES[key(part)];
    if (mapped) return mapped;
    if (part.length >= 3 && part.length <= 40 && !/\b(gcc|head|lead|director)\b/i.test(part)) {
      return part;
    }
  }
  return null;
}

export function displayPlace(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const city = canonicalCity(value);
    if (city) return city;
  }
  for (const value of values) {
    const country = prettyCountry(value);
    if (country && country !== 'India') return country;
  }
  return asText(values.find((value) => asText(value)));
}
