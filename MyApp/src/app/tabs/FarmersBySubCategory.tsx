import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getToken } from "@/_services/storage";
import api from "../../_services/api"; 

const C = {
  primary: "#3a7d44",
  primaryLight: "#e8f5e0",
  accent: "#FF9800",
  accentLight: "#fff9e6",
  bg: "#F5F8F2",
  card: "#ffffff",
  border: "#efefef",
  text: "#111111",
  textSub: "#666666",
  textMuted: "#999999",
  save: "#c67c00",
};

interface Farmer {
  Id: number;
  cropPrice: number;
  cropQuantity: number;
  imageUrls: string[];
  createdAt: string;
  subCategory: {
    Id: number;
    itemName: string;
    units: { Id: number; unit: string };
    categories: { Id: number; categoryName: string };
  };
  user: {
    id: number;
    username: string;
    email: string;
    phoneNumber: number;
    profileUrl: string;
  };
}

type SortKey = "bulk" | "newest" | "price";

interface FilterOption {
  key: SortKey;
  label: string;
  icon: string;
}

const FILTERS: FilterOption[] = [
  { key: "bulk", label: "Bulk First", icon: "📦" },
  { key: "newest", label: "Newest", icon: "🆕" },
  { key: "price", label: "Lowest Price", icon: "💰" },
];

const DEFAULT_FILTER: SortKey = "bulk";
const PAGE_SIZE = 10;

function sortFarmers(list: Farmer[], key: SortKey): Farmer[] {
  const copy = [...list];
  switch (key) {
    case "bulk":
      return copy.sort((a, b) => b.cropQuantity - a.cropQuantity);
    case "newest":
      return copy.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case "price":
      return copy.sort((a, b) => a.cropPrice - b.cropPrice);
    default:
      return copy;
  }
}

function FarmerCard({ item, activeSort }: { item: Farmer; activeSort: SortKey }) {
  const router = useRouter();
  const unit = item.subCategory?.units?.unit ?? "unit";
  const highlight =
    activeSort === "bulk"
      ? `${item.cropQuantity} ${unit} available`
      : activeSort === "price"
      ? `₹${item.cropPrice}/${unit}`
      : new Date(item.createdAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        });

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.75}
      onPress={() =>
        router.push({
          pathname: "/tabs/CropDetail",
          params: {
            cropDetailId: String(item.Id),
            subCategoryId: String(item.subCategory?.Id ?? ""),
            itemName: item.subCategory?.itemName ?? "",
            unit,
            cropPrice: String(item.cropPrice),
            cropQuantity: String(item.cropQuantity),
            imageUrl: item.imageUrls?.[0] ?? "",
            farmerName: item.user?.username ?? "",
            farmerProfileUrl: item.user?.profileUrl ?? "",
            farmerPhoneNumber: item.user?.phoneNumber != null ? String(item.user.phoneNumber) : "",
            categoryName: item.subCategory?.categories?.categoryName ?? "",
            createdAt: item.createdAt ?? "",
          },
        })
      }
    >
      <View style={styles.avatarBox}>
        {item.user?.profileUrl ? (
          <Image
            source={{ uri: item.user.profileUrl }}
            style={styles.avatar}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.avatarEmoji}>👨‍🌾</Text>
        )}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.farmerName} numberOfLines={1}>
          {item.user?.username ?? "Unknown Farmer"}
        </Text>
        <Text style={styles.cropLine} numberOfLines={1}>
          {item.subCategory?.itemName} •{" "}
          {item.subCategory?.categories?.categoryName}
        </Text>

        {item.imageUrls?.[0] ? (
          <Image
            source={{ uri: item.imageUrls[0] }}
            style={styles.cropThumb}
            resizeMode="cover"
          />
        ) : null}

        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="cube-outline" size={11} color={C.primary} />
            <Text style={styles.metaText}>
              {item.cropQuantity} {unit}
            </Text>
          </View>
          <View style={[styles.metaPill, { backgroundColor: C.accentLight }]}>
            <Ionicons name="pricetag-outline" size={11} color={C.save} />
            <Text style={[styles.metaText, { color: C.save }]}>
              ₹{item.cropPrice}/{unit}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardRight}>
        <View style={styles.highlightBadge}>
          <Text style={styles.highlightText} numberOfLines={2}>
            {highlight}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={C.primary} style={{ marginTop: 8 }} />
      </View>
    </TouchableOpacity>
  );
}

export default function FarmersBySubCategory() {
  const router = useRouter();
  const { subCategoryId, cropName } = useLocalSearchParams<{
    subCategoryId: string;
    cropName: string;
  }>();

  const [activeFilter, setActiveFilter] = useState<SortKey>(DEFAULT_FILTER);
  const [allFarmers, setAllFarmers] = useState<Farmer[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageRef = useRef(0);

  const fetchPage = useCallback(
    async (pageNum: number, replace = false) => {
      if (!subCategoryId) return;
      const isFirst = pageNum === 0;
      isFirst ? setLoading(true) : setLoadingMore(true);
      setError(null);
      const token = await getToken();
    if (!token) {
      router.replace("/auth/login");
      return;
    }
      try {
        const res = await api.get("/crop/getAllFarmars", {
          params: { subCategory: subCategoryId, page: pageNum },
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = res.data;
        const items: Farmer[] = data.content ?? [];

        setAllFarmers((prev) => (replace ? items : [...prev, ...items]));
        setHasMore(!data.last);
        pageRef.current = pageNum;
        setPage(pageNum);
      } catch (e: any) {
        setError(e?.response?.data?.message ?? "Failed to load farmers.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [subCategoryId]
  );

  useEffect(() => {
    fetchPage(0, true);
  }, [fetchPage]);

  const loadMore = () => {
    if (!hasMore || loadingMore || loading) return;
    fetchPage(pageRef.current + 1);
  };

  const sorted = sortFarmers(allFarmers, activeFilter);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.card} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {cropName ?? "Farmers"}
          </Text>
          <Text style={styles.headerSub}>
            {allFarmers.length} farmer{allFarmers.length !== 1 ? "s" : ""} found
          </Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = activeFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setActiveFilter(f.key)}
              activeOpacity={0.75}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={styles.chipIcon}>{f.icon}</Text>
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>Finding farmers…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={C.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchPage(0, true)}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : sorted.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 48 }}>🌾</Text>
          <Text style={styles.emptyTitle}>No farmers yet</Text>
          <Text style={styles.emptySubtitle}>
            No one is selling {cropName ?? "this crop"} right now.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => String(item.Id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <FarmerCard item={item} activeSort={activeFilter} />
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
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
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.card,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: "#e8e8e8",
    backgroundColor: C.card,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "600", color: C.text },
  headerSub: { fontSize: 12, color: C.textMuted, marginTop: 1 },

  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#ddd",
    backgroundColor: "#fafafa",
  },
  chipActive: {
    backgroundColor: C.primaryLight,
    borderColor: C.primary,
  },
  chipIcon: { fontSize: 13 },
  chipLabel: { fontSize: 12, color: C.textSub, fontWeight: "500" },
  chipLabelActive: { color: C.primary },

  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  avatarBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.primaryLight,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  avatar: { width: "100%", height: "100%" },
  avatarEmoji: { fontSize: 26 },

  cardBody: { flex: 1, gap: 4 },
  farmerName: { fontSize: 14, fontWeight: "600", color: C.text },
  cropLine: { fontSize: 11, color: C.textMuted },
  cropThumb: {
    width: "100%",
    height: 90,
    borderRadius: 10,
    marginTop: 6,
    marginBottom: 2,
  },
  metaRow: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  metaText: { fontSize: 11, color: C.primary, fontWeight: "500" },

  cardRight: { alignItems: "center", justifyContent: "flex-start", paddingTop: 2 },
  highlightBadge: {
    backgroundColor: C.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: 80,
    alignItems: "center",
  },
  highlightText: { fontSize: 10, fontWeight: "600", color: C.primary, textAlign: "center" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10 },
  loadingText: { fontSize: 13, color: C.textMuted },
  errorText: { fontSize: 13, color: C.textSub, textAlign: "center", marginHorizontal: 32 },
  retryBtn: {
    marginTop: 4,
    backgroundColor: C.primary,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: "#fff", fontSize: 13, fontWeight: "500" },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: C.text, marginTop: 8 },
  emptySubtitle: { fontSize: 13, color: C.textMuted, textAlign: "center", marginHorizontal: 32 },

  footerLoader: { paddingVertical: 20, alignItems: "center" },
});