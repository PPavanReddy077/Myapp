import { useEffect, useState } from "react";
import * as Location from "expo-location";
import {
  fetchUserGreeting,
  fetchCategories,
  fetchFreshProducts,
  fetchNearbyCrops,
  fetchMarketPrices,
  fetchCartCount,
  deduplicateBySubCategory,
  Category,
  FreshProduct,
  NearbyCrop,
  MarketPrice,
  UserGreeting,
} from "./homeApi";

interface HomeData {
  greeting: UserGreeting | null;
  categories: Category[];
  freshProducts: FreshProduct[];
  nearbyCrops: NearbyCrop[];
  marketPrices: MarketPrice[];
  cartCount: number;
}

interface HomeState extends HomeData {
  loading: boolean;
  error: string | null;
  refetch: () => void;
  fetchByCategory: (categoryId: number) => void;
  loadMoreProducts: () => void;
  productsLoadingMore: boolean;
  productsHasMore: boolean;
}

// Falls back to this location if the user denies permission / location fails
// (kept close to the sample data used during development).
const DEFAULT_COORDS = { latitude: 79.0, longitude: 71.89 };

async function getCurrentCoords(): Promise<{ latitude: number; longitude: number }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return DEFAULT_COORDS;
    const pos = await Location.getCurrentPositionAsync({});
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return DEFAULT_COORDS;
  }
}

export function useHomeData(): HomeState {
  const [state, setState] = useState<HomeData>({
    greeting: null,
    categories: [],
    freshProducts: [],
    nearbyCrops: [],
    marketPrices: [],
    cartCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // ── Fresh-products pagination ──────────────────────────────────────────────
  const [productPage, setProductPage] = useState(0);
  const [productsHasMore, setProductsHasMore] = useState(true);
  const [productsLoadingMore, setProductsLoadingMore] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    setProductPage(0);
    setProductsHasMore(true);

    try {
      const coords = await getCurrentCoords();

      const [greeting, categories, freshPage, nearbyCrops, marketPrices, cart] =
        await Promise.allSettled([
          fetchUserGreeting(),
          fetchCategories(),
          fetchFreshProducts(0),
          fetchNearbyCrops(coords.latitude, coords.longitude),
          fetchMarketPrices(),
          fetchCartCount(),
        ]);

      const rawProducts =
        freshPage.status === "fulfilled" ? freshPage.value.content : [];

      if (freshPage.status === "fulfilled") {
        setProductsHasMore(!freshPage.value.last);
      }

      setState({
        greeting:      greeting.status      === "fulfilled" ? greeting.value                         : null,
        categories:    categories.status    === "fulfilled" ? categories.value                       : [],
        // Deduplicate: one card per subcategory, showing the latest listing
        freshProducts: deduplicateBySubCategory(rawProducts),
        nearbyCrops:   nearbyCrops.status   === "fulfilled" ? nearbyCrops.value                       : [],
        marketPrices:  marketPrices.status  === "fulfilled" ? marketPrices.value                     : [],
        cartCount:     cart.status          === "fulfilled" ? (cart.value?.count ?? 0)               : 0,
      });
    } catch {
      setError("Failed to load. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadMoreProducts = async () => {
    if (productsLoadingMore || !productsHasMore) return;
    setProductsLoadingMore(true);
    try {
      const nextPage = productPage + 1;
      const result = await fetchFreshProducts(nextPage);
      setProductPage(nextPage);
      setProductsHasMore(!result.last);
      setState((prev) => ({
        ...prev,
        // Merge new page into existing list, then re-deduplicate
        freshProducts: deduplicateBySubCategory([
          ...prev.freshProducts,
          ...result.content,
        ]),
      }));
    } catch {
      // keep existing list silently
    } finally {
      setProductsLoadingMore(false);
    }
  };

  const fetchByCategory = async (categoryId: number) => {
    try {
      const result = await fetchFreshProducts(0);
      setProductPage(0);
      setProductsHasMore(!result.last);
      setState((prev) => ({
        ...prev,
        freshProducts: deduplicateBySubCategory(result.content),
      }));
    } catch {
      // keep existing list silently
    }
  };

  useEffect(() => {
    loadAll();
  }, [tick]);

  return {
    ...state,
    loading,
    error,
    refetch: () => setTick((t) => t + 1),
    fetchByCategory,
    loadMoreProducts,
    productsLoadingMore,
    productsHasMore,
  };
}