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
import * as Location from "expo-location";
import {
  fetchNearbyCrops,
  fetchCategories,
  Category,
  NearbyCrop,
} from "../../_services/homeApi";

const C = {
  primary: "#3a7d44",
  bg: "#F5F8F2",
  card: "#ffffff",
  border: "#efefef",
  text: "#111111",
  textMuted: "#999999",
};

const BULK_MIN_QTY = 50;

type SortMode = "nearest" | "fresh" | "bulk" | "priceLowHigh" | "priceHighLow";

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: "nearest", label: "Nearest" },
  { key: "fresh", label: "Fresh" },
  { key: "bulk", label: "Bulk" },
  { key: "priceLowHigh", label: "Price ↑" },
  { key: "priceHighLow", label: "Price ↓" },
];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} activeOpacity={0.7} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Row({ item }: { item: NearbyCrop }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.75}
      onPress={() =>
        router.push({
          pathname: "/tabs/CropDetailsScreen",
          params: {
            cropDetailId: String(item.cropDetailId),
            subCategoryId: String(item.subCategoryId),
            itemName: item.itemName,
            unit: item.unit,
            cropPrice: String(item.cropPrice),
            cropQuantity: String(item.cropQuantity),
            imageUrl: item.imageUrl,
            farmerName: item.farmerName,
            farmerProfileUrl: item.farmerProfileUrl,
            farmerPhoneNumber: item.farmerPhoneNumber,
            categoryName: item.categoryName,
            createdAt: item.createdAt ?? "",
            distanceKm: String(item.distanceKm),
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
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{item.itemName}</Text>
        <Text style={styles.sub}>
          ₹{item.cropPrice}/{item.unit || "unit"} · {item.farmerName}
        </Text>
        <View style={styles.distRow}>
          <Ionicons name="location-outline" size={11} color={C.textMuted} />
          <Text style={styles.dist}>{item.distanceKm.toFixed(1)} km away · {item.cropQuantity} avail</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function AllNearbyCrops() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("nearest");

  const [crops, setCrops] = useState<NearbyCrop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission is needed to show nearby crops.");
        setCrops([]);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const [result, cats] = await Promise.all([
        fetchNearbyCrops(pos.coords.latitude, pos.coords.longitude),
        categories.length ? Promise.resolve(categories) : fetchCategories(),
      ]);
      setCrops(result);
      if (!categories.length) setCategories(cats);
    } catch {
      setError("Couldn't load nearby crops. Pull down to retry.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const displayCrops = useMemo(() => {
    let list = [...crops];
    if (selectedCategoryId != null) {
      const catName = categories.find((c) => c.Id === selectedCategoryId)?.categoryName;
      list = list.filter((c) => c.categoryName === catName);
    }
    if (sortMode === "bulk") {
      list = list.filter((c) => c.cropQuantity >= BULK_MIN_QTY);
      list.sort((a, b) => b.cropQuantity - a.cropQuantity);
    } else if (sortMode === "priceLowHigh") {
      list.sort((a, b) => a.cropPrice - b.cropPrice);
    } else if (sortMode === "priceHighLow") {
      list.sort((a, b) => b.cropPrice - a.cropPrice);
    } else if (sortMode === "fresh") {
      list.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
    } else {
      list.sort((a, b) => a.distanceKm - b.distanceKm);
    }
    return list;
  }, [crops, categories, selectedCategoryId, sortMode]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.card} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nearby Crops</Text>
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
            onPress={() => setSelectedCategoryId(item.Id === -1 ? null : item.Id)}
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
          <Chip label={item.label} active={sortMode === item.key} onPress={() => setSortMode(item.key)} />
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
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : displayCrops.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            {sortMode === "bulk" ? "No bulk listings nearby." : "No crops found nearby."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayCrops}
          keyExtractor={(i) => String(i.cropDetailId)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <Row item={item} />}
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

  listContent: { padding: 14, backgroundColor: C.bg, flexGrow: 1 },
  row: {
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, padding: 12,
    flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12,
  },
  imgBox: {
    width: 64, height: 64, borderRadius: 12,
    backgroundColor: "#f7fdf7", justifyContent: "center", alignItems: "center", overflow: "hidden",
  },
  emoji: { fontSize: 28 },
  img: { width: "100%", height: "100%" },
  name: { fontSize: 14, fontWeight: "600", color: C.text },
  sub: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  distRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  dist: { fontSize: 11, color: C.textMuted },
});