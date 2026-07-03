import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import api from "@/_services/api";
import { getToken } from "@/_services/storage";

interface UserProfile {
  id: number;
  username: string;
  email: string;
  phoneNumber: number;
  profileUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface RequestQuotationInfo {
  Id: number;
  createdAt: string;
  cropName: string;
  cropPrice: number;
  cropQuantity: number;
  deliveryLocation: string;
  negotiationStatus: string;
  requiredDate: string;
  updatedAt: string;
  user: UserProfile;
}

interface AcceptedQuotation {
  id: number;
  createdAt: string;
  updatedAt: string;
  requestQuotation: RequestQuotationInfo;
  user: UserProfile;
}

interface AcceptedQuotesPage {
  content: AcceptedQuotation[];
  totalElements: number;
  totalPages: number;
  last: boolean;
  number: number;
}

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
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatQuantity(value: number): string {
  return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function formatPhone(phone: number): string {
  const s = String(phone);
  if (s.length === 10) return `+91 ${s.slice(0, 5)} ${s.slice(5)}`;
  return `+91 ${s}`;
}

function statusColors(status: string): { fg: string; bg: string } {
  switch (status?.toUpperCase()) {
    case "ACCEPTED":
      return { fg: C.primary, bg: C.primaryLight };
    case "PENDING":
      return { fg: C.accent, bg: C.accentLight };
    case "REJECTED":
      return { fg: C.danger, bg: C.dangerLight };
    default:
      return { fg: C.textMuted, bg: C.border };
  }
}

function Avatar({ name, uri, size = 44 }: { name: string; uri?: string | null; size?: number }) {
  const initials = (name ?? "?")
    .trim()
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarInitials, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

function QuoteCard({ item }: { item: AcceptedQuotation }) {
  const rq = item.requestQuotation;
  const buyer = rq?.user;
  const status = statusColors(rq?.negotiationStatus ?? "");
  const totalValue = (rq?.cropPrice ?? 0) * (rq?.cropQuantity ?? 0);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cropTitleRow}>
          <Ionicons name="leaf-outline" size={16} color={C.primary} />
          <Text style={styles.cropName} numberOfLines={1}>
            {rq?.cropName ?? "—"}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.fg }]}>
            {rq?.negotiationStatus ?? "—"}
          </Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>Price / unit</Text>
          <Text style={styles.metricValue}>{formatCurrency(rq?.cropPrice ?? 0)}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>Quantity</Text>
          <Text style={styles.metricValue}>{formatQuantity(rq?.cropQuantity ?? 0)}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>Total Value</Text>
          <Text style={styles.metricValue}>{formatCurrency(totalValue)}</Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <Ionicons name="location-outline" size={14} color={C.textMuted} />
        <Text style={styles.detailText} numberOfLines={2}>
          {rq?.deliveryLocation ?? "—"}
        </Text>
      </View>
      <View style={styles.detailRow}>
        <Ionicons name="calendar-outline" size={14} color={C.textMuted} />
        <Text style={styles.detailText}>
          Required by {rq?.requiredDate ? formatDate(rq.requiredDate) : "—"}
        </Text>
      </View>
      <View style={styles.detailRow}>
        <Ionicons name="checkmark-done-outline" size={14} color={C.textMuted} />
        <Text style={styles.detailText}>
          Accepted on {item.updatedAt ? formatDate(item.updatedAt) : "—"}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.buyerRow}>
        <Avatar name={buyer?.username ?? "?"} uri={buyer?.profileUrl} size={40} />
        <View style={styles.buyerInfo}>
          <Text style={styles.buyerName} numberOfLines={1}>
            {buyer?.username ?? "Unknown buyer"}
          </Text>
          <Text style={styles.buyerSub} numberOfLines={1}>
            {buyer?.email ?? "—"}
          </Text>
        </View>
        {buyer?.phoneNumber ? (
          <TouchableOpacity
            style={styles.callBtn}
            activeOpacity={0.7}
            onPress={() => Linking.openURL(`tel:${buyer.phoneNumber}`)}
          >
            <Ionicons name="call" size={16} color={C.primary} />
          </TouchableOpacity>
        ) : null}
      </View>
      {buyer?.phoneNumber ? (
        <Text style={styles.buyerPhone}>{formatPhone(buyer.phoneNumber)}</Text>
      ) : null}
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={48} color={C.textMuted} />
      <Text style={styles.emptyTitle}>No accepted quotes yet</Text>
      <Text style={styles.emptySubtitle}>
        Once you accept a buyer's quotation request, it will show up here.
      </Text>
    </View>
  );
}

function CardSkeleton() {
  return (
    <View style={[styles.card, { gap: 10 }]}>
      <View style={{ width: "50%", height: 16, borderRadius: 6, backgroundColor: "#e0e0e0", opacity: 0.6 }} />
      <View style={{ width: "90%", height: 40, borderRadius: 10, backgroundColor: "#e0e0e0", opacity: 0.4 }} />
      <View style={{ width: "70%", height: 12, borderRadius: 6, backgroundColor: "#e0e0e0", opacity: 0.5 }} />
      <View style={{ width: "60%", height: 12, borderRadius: 6, backgroundColor: "#e0e0e0", opacity: 0.5 }} />
    </View>
  );
}

export default function AcceptedQuotesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ initialQuotes?: string; totalElements?: string }>();

  const parsedInitialQuotes = useMemo<AcceptedQuotation[]>(() => {
    if (!params.initialQuotes) return [];
    try {
      return JSON.parse(params.initialQuotes);
    } catch {
      return [];
    }
  }, [params.initialQuotes]);

  const parsedInitialTotal = useMemo(() => {
    const n = Number(params.totalElements);
    return Number.isFinite(n) ? n : 0;
  }, [params.totalElements]);

  const hasInitialData = parsedInitialQuotes.length > 0;

  const [quotes, setQuotes] = useState<AcceptedQuotation[]>(parsedInitialQuotes);
  const [totalElements, setTotalElements] = useState(parsedInitialTotal);
  const [page, setPage] = useState(hasInitialData ? 0 : -1);
  const [isLast, setIsLast] = useState(false);
  const [loading, setLoading] = useState(!hasInitialData);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (pageNum: number, mode: "replace" | "append") => {
    const token = await getToken();
    if (!token) {
      router.replace("/auth/login");
      return;
    }
    try {
      const res = await api.get(`/quote/getAcceptedQuotes?page=${pageNum}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: AcceptedQuotesPage = res.data;
      setQuotes((prev) => (mode === "append" ? [...prev, ...(data.content ?? [])] : data.content ?? []));
      setTotalElements(data.totalElements ?? 0);
      setIsLast(data.last ?? true);
      setPage(pageNum);
      setError(null);
    } catch (e: any) {
      if (mode === "replace") {
        setQuotes([]);
        setTotalElements(0);
        setIsLast(true);
        setError(null);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    if (!hasInitialData) {
      fetchPage(0, "replace");
    }
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPage(0, "replace");
  };

  const onLoadMore = () => {
    if (loadingMore || isLast || loading) return;
    setLoadingMore(true);
    fetchPage(page + 1, "append");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.card} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Accepted Quotes</Text>
        <View style={styles.backBtn} />
      </View>

      {totalElements > 0 && (
        <View style={styles.summaryBar}>
          <Ionicons name="checkmark-done-outline" size={14} color={C.primary} />
          <Text style={styles.summaryText}>
            {totalElements} accepted quote{totalElements > 1 ? "s" : ""}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.listContent}>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : (
        <FlatList
          data={quotes}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <QuoteCard item={item} />}
          contentContainerStyle={
            quotes.length === 0 ? styles.listContentEmpty : styles.listContent
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[C.primary]}
              tintColor={C.primary}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={onLoadMore}
          ListEmptyComponent={error ? null : <EmptyState />}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator color={C.primary} size="small" />
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { width: 34, height: 34, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "600", color: C.text },

  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.primaryLight,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  summaryText: { fontSize: 12, color: C.primary, fontWeight: "600" },

  listContent: { padding: 18, gap: 14 },
  listContentEmpty: { flexGrow: 1 },

  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 14,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cropTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  cropName: { fontSize: 16, fontWeight: "700", color: C.text, flexShrink: 1 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },

  metricsRow: {
    flexDirection: "row",
    backgroundColor: C.bg,
    borderRadius: 12,
    paddingVertical: 10,
    marginVertical: 4,
  },
  metricBox: { flex: 1, alignItems: "center", gap: 2 },
  metricDivider: { width: 1, backgroundColor: C.border },
  metricLabel: { fontSize: 10, color: C.textMuted },
  metricValue: { fontSize: 13, fontWeight: "700", color: C.text },

  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  detailText: { fontSize: 12, color: C.textSub, flex: 1 },

  divider: { height: 1, backgroundColor: C.border, marginTop: 4 },

  buyerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  avatarFallback: {
    backgroundColor: C.primaryMid,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: { fontWeight: "700", color: C.primary },
  buyerInfo: { flex: 1 },
  buyerName: { fontSize: 13, fontWeight: "600", color: C.text },
  buyerSub: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  buyerPhone: { fontSize: 11, color: C.textMuted, marginLeft: 50, marginTop: -2 },
  callBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: C.text },
  emptySubtitle: { fontSize: 12, color: C.textMuted, textAlign: "center", lineHeight: 18 },
});