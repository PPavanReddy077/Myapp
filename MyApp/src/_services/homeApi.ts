import API from "../_services/api";
import { getToken } from "./storage";

export interface Category {
  Id: number;
  categoryName: string;
  emoji: string;
  subCategoryCount: number;
}

export interface FreshProduct {
  cropDetailId: number;
  subCategoryId: number;       // ← for dedup key
  itemName: string;
  unit: string;
  cropPrice: number;
  cropQuantity: number;
  imageUrl: string;
  farmerName: string;
  farmerProfileUrl: string;
  categoryName: string;
  createdAt: string | null;    // ← ISO date string from backend
}

export interface NearbyFarmer {
  farmerId: number;
  farmerName: string;
  profileUrl: string;
  phoneNumber: string;
  totalCrops: number;
  memberSince: string;
}

export interface MarketPrice {
  subCategoryId: number;
  cropName: string;
  unit: string;
  emoji: string;
  farmerPrice: number;
  marketPrice: number;
  savings: number;
}

export interface CartCount {
  count: number;
}

export interface UserGreeting {
  message: string;
  deliveryLocation: string;
}

// ─── Time helper ──────────────────────────────────────────────────────────────

/**
 * Returns a human-readable relative time string, e.g. "2h ago", "Just now".
 * Falls back to empty string if date is null / invalid.
 */
export function timeAgo(isoDate: string | null): string {
  if (!isoDate) return "";
  const diff = Date.now() - new Date(isoDate).getTime();
  if (isNaN(diff) || diff < 0) return "";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ──────────────────────────────────────────────────────────────────────────────

export const fetchUserGreeting = async (): Promise<UserGreeting> => {
  const token = await getToken();
  const res = await API.get("/greetMessage", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

const CATEGORY_EMOJI_MAP: Record<string, string> = {
  Vegetables:     "🥦",
  Fruits:         "🍎",
  "Leafy Greens": "🥬",
  "Grains & Cereals":         "🌾",
  Spices:         "🌶️",
  "Pulses": "🫘",
  "Oil Seeds":      "🌻",
  "Dry Fruits": "🥜",
  "Flowers":        "🌸",
  "Herbs": "🌿",
  "Animal Products": "🐄",
  "Sugar Crops": "🎋",
  "Millets": "🌾",
  "Plantation Crops": "🌴",
};

export const fetchCategories = async (): Promise<Category[]> => {
  const token = await getToken();
  const res = await API.get("/category/getCategories", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (res.data as Category[]).map((c) => ({
    ...c,
    emoji: CATEGORY_EMOJI_MAP[c.categoryName] ?? "🌿",
  }));
};

function mapFreshProduct(raw: any): FreshProduct {
  return {
    cropDetailId:     raw.Id,
    subCategoryId:    raw.subCategory?.Id ?? raw.Id,
    itemName:         raw.subCategory?.itemName ?? "Unknown",
    unit:             raw.subCategory?.units?.unit ?? "",
    cropPrice:        raw.cropPrice,
    cropQuantity:     raw.cropQuantity,
    imageUrl:         raw.imageUrls?.[0] ?? "",
    farmerName:       raw.user?.username ?? "Farmer",
    farmerProfileUrl: raw.user?.profileUrl ?? "",
    categoryName:     raw.subCategory?.categories?.categoryName ?? "",
    createdAt:        raw.createdAt ?? null,
  };
}

/**
 * Deduplicates a list of products by subCategoryId, keeping the entry
 * with the most recent createdAt for each subcategory.
 */
export function deduplicateBySubCategory(products: FreshProduct[]): FreshProduct[] {
  const map = new Map<number, FreshProduct>();
  for (const p of products) {
    const existing = map.get(p.subCategoryId);
    if (!existing) {
      map.set(p.subCategoryId, p);
    } else {
      // Keep whichever has the newer createdAt
      const existingTime = existing.createdAt ? new Date(existing.createdAt).getTime() : 0;
      const thisTime     = p.createdAt         ? new Date(p.createdAt).getTime()         : 0;
      if (thisTime > existingTime) {
        map.set(p.subCategoryId, p);
      }
    }
  }
  // Sort newest-first so the scroll order reflects recency
  return Array.from(map.values()).sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
}

export interface FreshProductPage {
  content: FreshProduct[];
  last: boolean;
}

export const fetchFreshProducts = async (page = 0): Promise<FreshProductPage> => {
  const token = await getToken();
  const res = await API.get(`/crop/getFreshCrops?page=${page}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    content: (res.data.content as any[]).map(mapFreshProduct),
    last: res.data.last ?? true,
  };
};

export const fetchNearbyFarmers = async (): Promise<NearbyFarmer[]> => {
  const token = await getToken();
  const res = await API.get("/api/farmers/nearby", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const fetchMarketPrices = async (): Promise<MarketPrice[]> => {
  const token = await getToken();
  const res = await API.get("/api/market-prices/today", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const fetchCartCount = async (): Promise<CartCount> => {
  const token = await getToken();
  const res = await API.get("/api/cart/count", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};