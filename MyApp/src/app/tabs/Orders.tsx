import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import api from "@/_services/api";
import { getToken } from "@/_services/storage";

/* ---------------------------------- Types --------------------------------- */

interface UserProfile {
  id: number;
  username: string;
  email: string;
  phoneNumber: number;
  profileUrl: string | null;
  totalRating: number;
  favouriteCount: number;
  count: number;
  createdAt: string;
  updatedAt: string;
}

interface Unit {
  Id: number;
  unit: string;
}

interface Category {
  Id: number;
  categoryName: string;
}

interface SubCategory {
  Id: number;
  itemName: string;
  units: Unit;
  categories: Category;
}

interface CropLocation {
  id: number;
  latitude: number;
  longitude: number;
}

interface CropDetails {
  Id: number;
  cropDetailsStatus: string;
  cropPrice: number;
  cropQuantity: number;
  imageUrls: string[];
  cropLocation: CropLocation;
  subCategory: SubCategory;
  user: UserProfile; // farmer
  createdAt: string;
  updatedAt: string;
}

interface OrderItem {
  id: number;
  orderStatus: string;
  createdAt: string;
  updatedAt: string;
  buyer: UserProfile;
  cropDetails: CropDetails;
}

interface OrdersPage {
  content: OrderItem[];
  totalElements: number;
  totalPages: number;
  number: number;
  last: boolean;
}

/* --------------------------------- Palette --------------------------------- */

const C = {
  primary: "#3a7d44",
  primaryLight: "#e8f5e0",
  primaryMid: "#c8e6c9",
  accent: "#FF9800",
  accentLight: "#fff9e6",
  bg: "#F5F8F2",
  card: "#ffffff",
  border: "#efefef",
  text: "#111111",
  textSub: "#666666",
  textMuted: "#999999",
  danger: "#e53935",
  dangerLight: "#fdecea",
  blue: "#1e88e5",
  blueLight: "#e3f2fd",
};

/* ---------------------------------- Helpers -------------------------------- */

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type StatusStyle = { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap; label: string };

function getStatusStyle(status: string): StatusStyle {
  switch (status) {
    case "ORDERED":
      return { bg: C.blueLight, fg: C.blue, icon: "time-outline", label: "Ordered" };
    case "CONFIRMED":
    case "ACCEPTED":
      return { bg: C.primaryLight, fg: C.primary, icon: "checkmark-circle-outline", label: "Confirmed" };
    case "SHIPPED":
    case "DISPATCHED":
      return { bg: C.accentLight, fg: C.accent, icon: "cube-outline", label: "Shipped" };
    case "DELIVERED":
      return { bg: C.primaryLight, fg: C.primary, icon: "checkmark-done-outline", label: "Delivered" };
    case "CANCELLED":
    case "CANCELED":
      return { bg: C.dangerLight, fg: C.danger, icon: "close-circle-outline", label: "Cancelled" };
    case "REJECTED":
      return { bg: C.dangerLight, fg: C.danger, icon: "close-circle-outline", label: "Rejected" };
    default:
      return { bg: "#f0f0f0", fg: C.textSub, icon: "ellipse-outline", label: status };
  }
}

const CANCELLABLE_STATUSES = new Set(["ACCEPTED"]);

/* --------------------------------- Subviews --------------------------------- */

function StatusBadge({ status }: { status: string }) {
  const s = getStatusStyle(status);
  return (
    <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
      <Ionicons name={s.icon} size={12} color={s.fg} />
      <Text style={[styles.statusBadgeText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

function SkeletonBlock({ w, h, radius = 8 }: { w: number | string; h: number; radius?: number }) {
  return (
    <View
      style={{
        width: w as any,
        height: h,
        borderRadius: radius,
        backgroundColor: "#e0e0e0",
        opacity: 0.6,
      }}
    />
  );
}

function OrderCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <SkeletonBlock w={72} h={72} radius={12} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBlock w="70%" h={14} radius={6} />
          <SkeletonBlock w="40%" h={12} radius={6} />
          <SkeletonBlock w="50%" h={20} radius={20} />
        </View>
      </View>
    </View>
  );
}

function OrdersSkeleton() {
  return (
    <View style={{ paddingTop: 14 }}>
      <OrderCardSkeleton />
      <OrderCardSkeleton />
      <OrderCardSkeleton />
    </View>
  );
}

function EmptyState({ onBrowse }: { onBrowse: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="receipt-outline" size={30} color={C.primary} />
      </View>
      <Text style={styles.emptyTitle}>No orders yet</Text>
      <Text style={styles.emptyText}>
        Orders you place with farmers will show up here.
      </Text>
      <TouchableOpacity style={styles.browseBtn} onPress={onBrowse} activeOpacity={0.85}>
        <Text style={styles.browseBtnText}>Browse Crops</Text>
      </TouchableOpacity>
    </View>
  );
}

interface OrderCardProps {
  order: OrderItem;
  cancelling: boolean;
  onCancel: (order: OrderItem) => void;
  onPress: (order: OrderItem) => void;
}

function OrderCard({ order, cancelling, onCancel, onPress }: OrderCardProps) {
  const crop = order.cropDetails;
  const image = crop?.imageUrls?.[0];
  const unit = crop?.subCategory?.units?.unit ?? "";
  const total = (crop?.cropPrice ?? 0) * (crop?.cropQuantity ?? 0);
  const canCancel = CANCELLABLE_STATUSES.has(order.orderStatus);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => onPress(order)}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {image ? (
          <Image source={{ uri: image }} style={styles.cropImage} />
        ) : (
          <View style={[styles.cropImage, styles.cropImageFallback]}>
            <Ionicons name="leaf-outline" size={24} color={C.primary} />
          </View>
        )}

        <View style={{ flex: 1 }}>
          <View style={styles.cardTopRow}>
            <Text style={styles.itemName} numberOfLines={1}>
              {crop?.subCategory?.itemName ?? "Item"}
            </Text>
            <StatusBadge status={order.orderStatus} />
          </View>

          <Text style={styles.categoryText}>
            {crop?.subCategory?.categories?.categoryName ?? ""}
          </Text>

          <Text style={styles.qtyPriceText}>
            {crop?.cropQuantity?.toLocaleString("en-IN")} {unit} · {formatCurrency(crop?.cropPrice ?? 0)}/{unit}
          </Text>

          <Text style={styles.totalText}>{formatCurrency(total)}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.cardBottomRow}>
        <View style={styles.farmerRow}>
          {crop?.user?.profileUrl ? (
            <Image source={{ uri: crop.user.profileUrl }} style={styles.farmerAvatar} />
          ) : (
            <View style={styles.farmerAvatarFallback}>
              <Text style={styles.farmerAvatarInitials}>
                {initialsOf(crop?.user?.username ?? "F")}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.farmerName} numberOfLines={1}>
              {crop?.user?.username ?? "Farmer"}
            </Text>
            <Text style={styles.orderDate}>Ordered {formatDate(order.createdAt)}</Text>
          </View>
        </View>

        {canCancel ? (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => onCancel(order)}
            disabled={cancelling}
            activeOpacity={0.7}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color={C.danger} />
            ) : (
              <Text style={styles.cancelBtnText}>Cancel</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

/* ---------------------------------- Screen ---------------------------------- */

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [isLast, setIsLast] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const tokenRef = useRef<string | null>(null);

  const fetchOrders = useCallback(
    async (pageNum: number, mode: "initial" | "refresh" | "more") => {
      try {
        if (mode === "initial") setLoading(true);
        if (mode === "refresh") setRefreshing(true);
        if (mode === "more") setLoadingMore(true);
        setError(null);

        let token = tokenRef.current;
        if (!token) {
          token = await getToken();
          if (!token) {
            router.replace("/auth/login");
            return;
          }
          tokenRef.current = token;
        }

        const res = await api.get(`/order/getYourOrders?page=${pageNum}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: OrdersPage = res.data;

        setOrders((prev) => (pageNum === 0 ? data.content ?? [] : [...prev, ...(data.content ?? [])]));
        setTotalElements(data.totalElements ?? 0);
        setIsLast(data.last ?? true);
        setPage(data.number ?? pageNum);
      } catch (e) {
        if (pageNum === 0) {
          setOrders([]);
          setError("Couldn't load your orders. Pull down to try again.");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [router]
  );

  useEffect(() => {
    fetchOrders(0, "initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = useCallback(() => {
    fetchOrders(0, "refresh");
  }, [fetchOrders]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || isLast || loading) return;
    fetchOrders(page + 1, "more");
  }, [loadingMore, isLast, loading, page, fetchOrders]);

  const confirmCancel = useCallback((order: OrderItem) => {
    Alert.alert(
      "Cancel this order?",
      `This will cancel your order for ${order.cropDetails?.subCategory?.itemName ?? "this item"}.`,
      [
        { text: "Keep Order", style: "cancel" },
        {
          text: "Cancel Order",
          style: "destructive",
          onPress: () => handleCancel(order),
        },
      ]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = useCallback(async (order: OrderItem) => {
    setCancellingId(order.id);
    try {
      const token = tokenRef.current ?? (await getToken());
      await api.post(`/order/deleteOrder?orderId=${order.id}`,{}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      setTotalElements((prev) => Math.max(0, prev - 1));
    } catch (e) {
      Alert.alert("Couldn't cancel order", "Please try again in a moment.");
    } finally {
      setCancellingId(null);
    }
  }, []);

  const handleOpenOrder = useCallback(
    (order: OrderItem) => {
      router.push({
        pathname: "/tabs/CropDetail",
        params: { cropId: String(order.cropDetails?.Id) },
      });
    },
    [router]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.card} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <OrdersSkeleton />
      ) : error && orders.length === 0 ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={32} color={C.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchOrders(0, "initial")}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={
            orders.length === 0 ? styles.listEmptyContent : styles.listContent
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              cancelling={cancellingId === item.id}
              onCancel={confirmCancel}
              onPress={handleOpenOrder}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.primary} />
          }
          onEndReachedThreshold={0.4}
          onEndReached={handleLoadMore}
          ListHeaderComponent={
            orders.length > 0 ? (
              <Text style={styles.countText}>
                {totalElements} order{totalElements !== 1 ? "s" : ""}
              </Text>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator color={C.primary} size="small" />
              </View>
            ) : (
              <View style={{ height: 24 }} />
            )
          }
          ListEmptyComponent={<EmptyState onBrowse={() => router.push("/tabs/home")} />}
        />
      )}
    </SafeAreaView>
  );
}

/* ---------------------------------- Styles ---------------------------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 18, fontWeight: "600", color: C.text },

  listContent: { paddingBottom: 24 },
  listEmptyContent: { flexGrow: 1 },

  countText: {
    fontSize: 12,
    color: C.textMuted,
    marginHorizontal: 18,
    marginTop: 14,
    marginBottom: 4,
  },

  card: {
    backgroundColor: C.card,
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
  },

  cropImage: { width: 72, height: 72, borderRadius: 12 },
  cropImageFallback: {
    backgroundColor: C.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },

  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  itemName: { fontSize: 15, fontWeight: "600", color: C.text, flexShrink: 1 },

  categoryText: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  qtyPriceText: { fontSize: 12, color: C.textSub, marginTop: 6 },
  totalText: { fontSize: 15, fontWeight: "700", color: C.primary, marginTop: 4 },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusBadgeText: { fontSize: 10, fontWeight: "600" },

  divider: { height: 1, backgroundColor: C.border, marginTop: 12, marginBottom: 10 },

  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  farmerRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  farmerAvatar: { width: 30, height: 30, borderRadius: 15 },
  farmerAvatarFallback: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.primaryMid,
    justifyContent: "center",
    alignItems: "center",
  },
  farmerAvatarInitials: { fontSize: 11, fontWeight: "700", color: C.primary },
  farmerName: { fontSize: 12.5, fontWeight: "500", color: C.text },
  orderDate: { fontSize: 10.5, color: C.textMuted, marginTop: 1 },

  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.danger,
    minWidth: 68,
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 12, fontWeight: "600", color: C.danger },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 6,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: C.text },
  emptyText: { fontSize: 13, color: C.textMuted, textAlign: "center", lineHeight: 19 },
  browseBtn: {
    marginTop: 14,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 24,
    backgroundColor: C.primary,
  },
  browseBtnText: { fontSize: 13.5, fontWeight: "600", color: "#fff" },

  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  errorText: { fontSize: 14, color: C.textSub, textAlign: "center" },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: C.primary,
    marginTop: 4,
  },
  retryText: { fontSize: 14, color: "#fff", fontWeight: "600" },
});