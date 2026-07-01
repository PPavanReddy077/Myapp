import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchFreshProducts,
  fetchCropsByCategory,
  fetchCategories,
  Category,
  FreshProduct,
  timeAgo,
} from "../../_services/homeApi";

const C = {
  primary: "#3a7d44",
  primaryLight: "#e8f5e0",
  bg: "#F5F8F2",
  card: "#ffffff",
  border: "#efefef",
  text: "#111111",
  textMuted: "#999999",
};

const BULK_MIN_QTY = 50;

type SortMode = "fresh" | "bulk" | "priceLowHigh" | "priceHighLow";

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: "fresh", label: "Fresh" },
  { key: "bulk", label: "Bulk" },
  { key: "priceLowHigh", label: "Price ↑" },
  { key: "priceHighLow", label: "Price ↓" },
];

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Card({ item }: { item: FreshProduct }) {
  const router = useRouter();
  const ago = timeAgo(item.createdAt);
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.75}
      onPress={() =>
        router.push({
          pathname: "/tabs/FarmersBySubCategory",
          params: {
            subCategoryId: String(item.subCategoryId),
            cropName: item.itemName,
          },
        })
      }
    >
      <View style={styles.imgBox}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.img} resizeMode="cover" />
        ) : (
          <Text style={styles.emoji}>🌿</Text>
        )}
        {item.categoryName ? (
          <View style={styles.catChip}>
            <Text style={styles.catChipText} numberOfLines={1}>{item.categoryName}</Text>
          </View>
        ) : null}
        {ago ? (
          <View style={styles.timePill}>
            <Ionicons name="time-outline" size={9} color="#fff" />
            <Text style={styles.timePillText}>{ago}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.name} numberOfLines={1}>{item.itemName}</Text>
      <Text style={styles.priceRow}>
        ₹{item.cropPrice}/{item.unit || "unit"} · {item.cropQuantity} avail
      </Text>
    </TouchableOpacity>
  );
}

export default function AllFreshProducts() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("fresh");
  const [products, setProducts] = useState<FreshProduct[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchPage = useCallback(
    (pageNum: number, catId: number | null) =>
      catId != null ? fetchCropsByCategory(catId, pageNum) : fetchFreshProducts(pageNum),
    []
  );
  const loadFirstPage = useCallback(async (catId: number | null) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPage(0, catId);
      setProducts(result.content);
      setPage(0);
      setHasMore(!result.last);
    } catch {
      setError("Couldn't load products. Pull down to retry.");
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => setCategories([]));
    loadFirstPage(null);
  }, [loadFirstPage]);

  const handleCategoryPress = (catId: number | null) => {
    setSelectedCategoryId(catId);
    loadFirstPage(catId);
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await fetchPage(nextPage, selectedCategoryId);
      setPage(nextPage);
      setHasMore(!result.last);
      setProducts((prev) => [...prev, ...result.content]);
    } catch {
    } finally {
      setLoadingMore(false);
    }
  };

  const displayProducts = useMemo(() => {
    let list = [...products];
    if (sortMode === "bulk") {
      list = list.filter((p) => p.cropQuantity >= BULK_MIN_QTY);
      list.sort((a, b) => b.cropQuantity - a.cropQuantity);
    } else if (sortMode === "priceLowHigh") {
      list.sort((a, b) => a.cropPrice - b.cropPrice);
    } else if (sortMode === "priceHighLow") {
      list.sort((a, b) => b.cropPrice - a.cropPrice);
    } else {
      list.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
    }
    return list;
  }, [products, sortMode]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.card} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fresh Today</Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chipRowContent}
        data={[{ Id: -1, categoryName: "All" } as any, ...categories]}
        keyExtractor={(c) => String(c.Id)}
        renderItem={({ item }) => (
          <Chip
            label={item.categoryName}
            active={item.Id === -1 ? selectedCategoryId === null : selectedCategoryId === item.Id}
            onPress={() => handleCategoryPress(item.Id === -1 ? null : item.Id)}
          />
        )}
      />

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chipRowContent}
        data={SORT_OPTIONS}
        keyExtractor={(o) => o.key}
        renderItem={({ item }) => (
          <Chip
            label={item.label}
            active={sortMode === item.key}
            onPress={() => setSortMode(item.key)}
          />
        )}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={C.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadFirstPage(selectedCategoryId)}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : displayProducts.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            {sortMode === "bulk" ? "No bulk listings here yet." : "No products found."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayProducts}
          keyExtractor={(i) => String(i.cropDetailId)}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item }) => <Card item={item} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator size="small" color={C.primary} />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.card },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10, paddingHorizontal: 32 },
  errorText: { fontSize: 13, color: C.textMuted, textAlign: "center" },
  retryBtn: { backgroundColor: C.primary, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 10 },
  retryText: { color: "#fff", fontSize: 13, fontWeight: "500" },
  emptyText: { fontSize: 13, color: C.textMuted, textAlign: "center" },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { width: 32, height: 32, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 16, fontWeight: "600", color: C.text },

  chipRow: { backgroundColor: C.card, flexGrow: 0, flexShrink: 0 },
  chipRowContent: { paddingHorizontal: 14, paddingVertical: 6, alignItems: "center", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "#f5f5f5", borderWidth: 1, borderColor: "#eee", marginRight: 8,
  },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 12, lineHeight: 16, color: "#555", fontWeight: "500" },
  chipTextActive: { color: "#fff" },

  gridContent: { padding: 14, backgroundColor: C.bg, flexGrow: 1 },
  gridRow: { justifyContent: "space-between" },

  card: {
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, padding: 10,
    width: "48%", marginBottom: 14,
  },
  imgBox: {
    width: "100%", height: 120, backgroundColor: "#f7fdf7",
    borderRadius: 12, justifyContent: "center", alignItems: "center",
    marginBottom: 8, position: "relative", overflow: "hidden",
  },
  emoji: { fontSize: 46 },
  img: { width: "100%", height: "100%", borderRadius: 12 },
  catChip: {
    position: "absolute", top: 6, left: 6,
    backgroundColor: "rgba(58,125,68,0.85)", borderRadius: 20,
    paddingHorizontal: 7, paddingVertical: 2, maxWidth: 90,
  },
  catChipText: { color: "#fff", fontSize: 9, fontWeight: "600" },
  timePill: {
    position: "absolute", bottom: 6, right: 6,
    backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 20,
    paddingHorizontal: 6, paddingVertical: 2,
    flexDirection: "row", alignItems: "center", gap: 3,
  },
  timePillText: { color: "#fff", fontSize: 9, fontWeight: "500" },
  name: { fontSize: 13, fontWeight: "600", color: C.text, marginBottom: 3 },
  priceRow: { fontSize: 11, color: C.textMuted },
});