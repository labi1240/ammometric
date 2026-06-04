export interface Retailer {
  id: number;
  name: string;
  domain: string | null;
  logo: string | null;
}

export interface Offer {
  id: number;
  itemId: string;
  retailerId: number;
  url: string;
  inStock: boolean;
  price: number;
  shippingCost: number;
  total: number | null;
  shippingNote?: string | null;
  freeShipping: boolean;
  retailer: Retailer;
  // Specific to ammo offers (e.g., box count)
  roundCount?: number;
  cpr?: number; // Cost Per Round
}

export interface Brand {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
}

export interface Product {
  id: string;
  slug: string; // Added slug
  kind: 'FIREARM' | 'AMMO' | 'ACCESSORY';
  title: string;
  image: string;
  brand: Brand;
  offers: Offer[];
  // Firearm Specs
  caliber?: string;
  caliberSlug?: string; // Added slug for SEO
  capacity?: string;
  barrelLength?: string;
  // Ammo Specs
  grain?: number;
  gauge?: string; // e.g., '12 Gauge'
  casing?: string; // e.g., 'Brass', 'Steel'
  velocity?: number; // FPS
  type?: string; // e.g., 'FMJ', 'JHP'
  ballisticsData?: any;
  // Full raw spec sheet (every captured field) from the feed, stored in the
  // AmmoSpecs/FirearmSpecs `specs` JSONB column. Rendered as the spec table.
  specs?: Record<string, string>;
  // Market Data
  priceHistory?: PriceHistoryPoint[]; // Array of lowest prices over time
}

export interface PriceHistoryPoint {
  time: string;
  price: number;
  unitPrice?: number;
  retailerName: string;
}