import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../_services/api";
import { getToken } from "../../_services/storage";
import { jwtDecode } from "jwt-decode";

type NegotiationStatus = "WAITING" | "NEGOTIATING" | "ACCEPTED";

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

interface QuoteUser {
  id: number;
  username: string;
  email: string;
  phoneNumber: number;
  profileUrl?: string;
}

interface Quotation {
  Id: number;
  createdAt: string;
  cropName: string;
  cropPrice: number;
  cropQuantity: number;
  deliveryLocation: string;
  negotiationStatus: NegotiationStatus;
  requiredDate: string;
  updatedAt: string;
  user: QuoteUser;
}

function statusColor(status: NegotiationStatus) {
  switch (status) {
    case "WAITING":
      return { bg: "#fff3e0", text: "#e65100" };
    case "NEGOTIATING":
      return { bg: "#e3f2fd", text: "#1565c0" };
    case "ACCEPTED":
      return { bg: "#e8f5e0", text: C.primary };
    default:
      return { bg: "#f0f0f0", text: C.textMuted };
  }
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatQuantity(value: number): string {
  return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function QuoteCard({
  item,
  onPress,
}: {
  item: Quotation;
  onPress: () => void;
}) {
  const sc = statusColor(item.negotiationStatus);
  const requiredDate = new Date(item.requiredDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={onPress}>
      <View style={styles.cardTop}>
        <Text style={styles.cropName} numberOfLines={1}>
          {item.cropName}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
          <Text style={[styles.statusText, { color: sc.text }]}>
            {item.negotiationStatus}
          </Text>
        </View>
      </View>

      <View style={styles.row}>
        <Ionicons name="pricetag-outline" size={13} color={C.textMuted} />
        <Text style={styles.rowText}>
          {formatCurrency(item.cropPrice)} · {formatQuantity(item.cropQuantity)} qty
        </Text>
      </View>

      <View style={styles.row}>
        <Ionicons name="location-outline" size={13} color={C.textMuted} />
        <Text style={styles.rowText} numberOfLines={1}>
          {item.deliveryLocation}
        </Text>
      </View>

      <View style={styles.row}>
        <Ionicons name="calendar-outline" size={13} color={C.textMuted} />
        <Text style={styles.rowText}>Required by {requiredDate}</Text>
      </View>

      <View style={styles.userRow}>
        {item.user?.profileUrl ? (
          <Image source={{ uri: item.user.profileUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Ionicons name="person" size={14} color={C.primary} />
          </View>
        )}
        <Text style={styles.userName} numberOfLines={1}>
          {item.user?.username || "Unknown buyer"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function QuotesScreen() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [showMineOnly, setShowMineOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Decode the JWT once to get the logged-in user's id
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const decoded: any = jwtDecode(token);
        setUserId(decoded?.userId ?? null);
      } catch {
        setUserId(null);
      }
    })();
  }, []);

  const fetchQuotes = useCallback(
    async (mode: "initial" | "refresh" | "loadMore" = "initial") => {
      // Guard against duplicate loadMore triggers or loading past the last page
      if (mode === "loadMore" && (loadingMore || !hasMore)) return;

      const nextPage = mode === "loadMore" ? page + 1 : 0;

      try {
        if (mode === "refresh") setRefreshing(true);
        else if (mode === "loadMore") setLoadingMore(true);
        else setLoading(true);
        setError(null);

        const token = await getToken();
        // Both endpoints are paginated now; getYourQuotations derives the
        // user from the JWT server-side, so no userId param is needed.
        const endpoint = showMineOnly
          ? "/quote/getYourQuotations"
          : "/quote/getQuotations";

        const res = await api.get(endpoint, {
          params: { page: nextPage },
          headers: { Authorization: `Bearer ${token}` },
        });
        const content: Quotation[] = Array.isArray(res.data?.content)
          ? res.data.content
          : [];
        setQuotes((prev) => (mode === "loadMore" ? [...prev, ...content] : content));
        setHasMore(res.data?.last === false);
        setPage(nextPage);
      } catch (e: any) {
        // Backend returns 400 with { message: "..." } when empty
        console.error("Error fetching quotes:", e);
        const status = e?.response?.status;
        const message = e?.response?.data?.message;
        const emptyMessages = [
          "no quotations yet",
          "no quotations created by you yet",
          "See your Quotations in My Quotes",
        ];
        if (status === 400) {
          if (mode !== "loadMore") setQuotes([]);
          setHasMore(false);
          if (message && !emptyMessages.includes(message)) {
            setError(message);
          }
        } else {
          setError("Failed to load quotes. Pull down to retry.");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [showMineOnly, page, hasMore, loadingMore]
  );

  // Refetch whenever the filter changes
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchQuotes("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMineOnly]);

  if (loading && quotes.length === 0 && !error) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={styles.loadingText}>Loading quotes…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.card} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quotes</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.acceptedBtn}
            activeOpacity={0.8}
            onPress={() => router.push("/tabs/AcceptedQuotes")}
            accessibilityLabel="View accepted quotes"
          >
            <Ionicons name="checkmark-done-outline" size={14} color={C.primary} />
            <Text style={styles.acceptedBtnText}>Accepted</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.myQuotesBtn, showMineOnly && styles.myQuotesBtnActive]}
            activeOpacity={0.8}
            onPress={() => setShowMineOnly((prev) => !prev)}
          >
            <Ionicons
              name="person-outline"
              size={13}
              color={showMineOnly ? "#fff" : C.primary}
            />
            <Text
              style={[
                styles.myQuotesBtnText,
                showMineOnly && styles.myQuotesBtnTextActive,
              ]}
            >
              My Quotes
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={quotes}
        keyExtractor={(item) => String(item.Id)}
        renderItem={({ item }) => (
          <QuoteCard
            item={item}
            onPress={() =>
              router.push({
                pathname: "/tabs/QuoteDetails",
                params: { qid: String(item.Id) },
              })
            }
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchQuotes("refresh")}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
        onEndReached={() => fetchQuotes("loadMore")}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              size="small"
              color={C.primary}
              style={{ marginVertical: 16 }}
            />
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Ionicons name="document-text-outline" size={40} color={C.textMuted} />
              <Text style={styles.emptyText}>
                {error ||
                  (showMineOnly
                    ? "You haven't requested any quotes yet"
                    : "No quotations yet")}
              </Text>
            </View>
          ) : null
        }
      />

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => router.push("/tabs/RequestQuote")}
        accessibilityLabel="Add Quote"
      >
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.card,
  },
  loadingText: { fontSize: 14, color: C.textMuted },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { width: 32, height: 32, justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "600", color: C.text },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  acceptedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: C.primary,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  acceptedBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: C.primary,
  },

  myQuotesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: C.primary,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  myQuotesBtnActive: {
    backgroundColor: C.primary,
  },
  myQuotesBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: C.primary,
  },
  myQuotesBtnTextActive: {
    color: "#fff",
  },

  listContent: { padding: 16, paddingBottom: 96, gap: 12, flexGrow: 1 },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },

  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cropName: { fontSize: 15, fontWeight: "600", color: C.text, flex: 1 },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusText: { fontSize: 10, fontWeight: "600" },

  row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 5 },
  rowText: { fontSize: 12, color: C.textSub, flexShrink: 1 },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  avatar: { width: 24, height: 24, borderRadius: 12 },
  avatarFallback: {
    backgroundColor: C.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  userName: { fontSize: 12, color: C.textMuted },

  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 10,
  },
  emptyText: { fontSize: 13, color: C.textMuted },
}); 