import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import api from "@/_services/api";
import { getToken } from "@/_services/storage";

interface CropItem {
  Id: number;
  createdAt: string;
  cropPrice: number;
  cropQuantity: number;
  imageUrls: string[];
  cropLocation: { latitude: number; longitude: number } | null;
  subCategory: {
    Id: number;
    itemName: string;
    categories: { Id: number; categoryName: string };
    units: { Id: number; unit: string };
  };
}

const C = {
  primary: "#3a7d44",
  primaryLight: "#e8f5e0",
  accent: "#FF9800",
  bg: "#F5F8F2",
  card: "#ffffff",
  border: "#efefef",
  text: "#111111",
  textSub: "#666666",
  textMuted: "#999999",
};

export default function MyCropsScreen() {
  const router = useRouter();
  const { farmerId } = useLocalSearchParams<{ farmerId: string }>();

  const [crops, setCrops] = useState<CropItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (pageToFetch: number, isInitial: boolean) => {
      if (!farmerId) return;
      try {
        const token = await getToken();
        const res = await api.get("/crop/getAllFarmerCrops", {
          params: { farmerId, page: pageToFetch },
          headers: { Authorization: `Bearer ${token}` },
        });
        const pageData = res.data;
        setCrops((prev) =>
          isInitial ? pageData.content : [...prev, ...pageData.content]
        );
        setHasMore(!pageData.last);
        setError(null);
      } catch (e: any) {
        // Backend returns 400 with a "no crops available" message
        // once you've paged past the last page — treat that as end-of-list,
        // not a real failure.
        if (e?.response?.status === 400) {
          setHasMore(false);
          if (isInitial) setCrops([]);
        } else {
          setError("Failed to load crops.");
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [farmerId]
  );

  useEffect(() => {
    fetchPage(0, true);
  }, [fetchPage]);

  const loadMore = () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPage(nextPage, false);
  };

  const renderItem = ({ item }: { item: CropItem }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() =>
        router.push({
          pathname: "/tabs/CropDetail",
          params: { cropDetailId: String(item.Id) },
        })
      }
    >
      <Image
        source={{ uri: item.imageUrls?.[0] }}
        style={styles.cardImage}
      />
      <View style={styles.cardBody}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.subCategory.itemName}
        </Text>
        <Text style={styles.categoryText}>
          {item.subCategory.categories.categoryName}
        </Text>
        <View style={styles.rowBetween}>
          <Text style={styles.priceText}>
            ₹{item.cropPrice}/{item.subCategory.units.unit}
          </Text>
          <Text style={styles.qtyText}>
            {item.cropQuantity} {item.subCategory.units.unit} avail.
          </Text>
        </View>
        {!item.cropLocation && (
          <View style={styles.warnPill}>
            <Ionicons name="location-outline" size={11} color="#e53935" />
            <Text style={styles.warnText}>No location set</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.card} />
        <Header router={router} />
        <View style={styles.centerFill}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.card} />
      <Header router={router} count={crops.length} />

      {error && crops.length === 0 ? (
        <View style={styles.centerFill}>
          <Ionicons name="cloud-offline-outline" size={44} color={C.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setLoading(true);
              fetchPage(0, true);
            }}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : crops.length === 0 ? (
        <View style={styles.centerFill}>
          <Ionicons name="leaf-outline" size={44} color={C.textMuted} />
          <Text style={styles.emptyText}>No crops listed yet</Text>
        </View>
      ) : (
        <FlatList
          data={crops}
          keyExtractor={(item) => String(item.Id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                color={C.primary}
                size="small"
                style={{ marginVertical: 16 }}
              />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function Header({ router, count }: { router: any; count?: number }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
        <Ionicons name="chevron-back" size={24} color={C.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>
        My Crops{typeof count === "number" ? ` (${count})` : ""}
      </Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 17, fontWeight: "600", color: C.text },
  centerFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  errorText: { fontSize: 14, color: C.textSub, textAlign: "center" },
  emptyText: { fontSize: 14, color: C.textMuted },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: C.primary,
    marginTop: 4,
  },
  retryText: { fontSize: 14, color: "#fff", fontWeight: "600" },
  listContent: { padding: 14, gap: 12 },
  card: {
    flexDirection: "row",
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    marginBottom: 12,
  },
  cardImage: { width: 90, height: 90 },
  cardBody: { flex: 1, padding: 10, gap: 3, justifyContent: "center" },
  itemName: { fontSize: 14, fontWeight: "600", color: C.text },
  categoryText: { fontSize: 11, color: C.textMuted },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  priceText: { fontSize: 13, fontWeight: "700", color: C.primary },
  qtyText: { fontSize: 11, color: C.textSub },
  warnPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  warnText: { fontSize: 10, color: "#e53935" },
});