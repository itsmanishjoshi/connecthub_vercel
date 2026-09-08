export const SECTORS = [
  'Healthcare and Life Sciences',
  'Manufacturing',
  'Real Estate',
  'BFSI',
  'IT Services',
  'Retail',
  'Environmental Services',
  'Research Services',
  'Restaurants',
  'Logistics',
  'Entertainment Providers',
  'Advertising Services',
  'Telecom',
  'Sports',
  'Others',
] as const;

export type Sector = typeof SECTORS[number];
