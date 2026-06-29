import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import api from "@/_services/api";
import { getToken } from "@/_services/storage";
import { jwtDecode } from "jwt-decode";

// ── Types ─────────────────────────────────────────────────────────────────────

interface JwtPayload {
  userId: number;
  sub: string;
}

interface UserProfile {
  id: number;
  username: string;
  email: string;
  phoneNumber: number;
  profileUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface LikeEntry {
  Id: number;
  buyer: UserProfile;
  farmer: UserProfile;
  createdAt: string;
  updatedAt: string;
}

interface LikesPage {
  content: LikeEntry[];
  totalElements: number;
  totalPages: number;
  last: boolean;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  primary: "#3a7d44",
  primaryLight: "#e8f5e0",
  primaryMid: "#c8e6c9",
  bg: "#F5F8F2",
  card: "#ffffff",
  border: "#efefef",
  text: "#111111",
  textSub: "#666666",
  textMuted: "#999999",
};

const PAGE_SIZE = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPhone(phone: number): string {
  const s = String(phone);
  if (s.length === 10) return `+91 ${s.slice(0, 5)} ${s.slice(5)}`;
  return `+91 ${s}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, uri, size = 52 }: { name: string; uri?: string | null; size?: number }) {
  const initials = name
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
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: C.primaryMid,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: size * 0.35, fontWeight: "700", color: C.primary }}>
        {initials}
      </Text>
    </View>
  );
}

// ── Buyer card ────────────────────────────────────────────────────────────────

function BuyerCard({ entry }: { entry: LikeEntry }) {
  const { buyer, createdAt } = entry;
  return (
    <View style={styles.card}>
      <Avatar name={buyer.username} uri={buyer.profileUrl} size={52} />
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{buyer.username}</Text>
        <View style={styles.cardMeta}>
          <Ionicons name="mail-outline" size={12} color={C.textMuted} />
          <Text style={styles.cardMetaText} numberOfLines={1}>{buyer.email}</Text>
        </View>
        <View style={styles.cardMeta}>
          <Ionicons name="call-outline" size={12} color={C.textMuted} />
          <Text style={styles.cardMetaText}>{formatPhone(buyer.phoneNumber)}</Text>
        </View>
      </View>
      <View style={styles.timeBadge}>
        <Ionicons name="heart" size={10} color={C.primary} />
        <Text style={styles.timeBadgeText}>{timeAgo(createdAt)}</Text>
      </View>
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconBox}>
        <Ionicons name="people-outline" size={40} color={C.primary} />
      </View>
      <Text style={styles.emptyTitle}>No followers yet</Text>
      <Text style={styles.emptySubtitle}>
        Buyers who favourite your farm will appear here.
      </Text>
    </View>
  );
}

// ── Footer loader (shown while fetching next page) ────────────────────────────

function FooterLoader({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={styles.footerLoader}>
      <ActivityIndicator color={C.primary} size="small" />
      <Text style={styles.footerLoaderText}>Loading more...</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function FavouriteFarmers() {
  const router = useRouter();
  const { initialLikes, totalElements } = useLocalSearchParams<{
    initialLikes: string;
    totalElements: string;
  }>();

  // Seed state from Profile's page 0 — no extra network call needed for first render
  const [likes, setLikes] = useState<LikeEntry[]>(() => {
    try {
      return initialLikes ? JSON.parse(initialLikes) : [];
    } catch {
      return [];
    }
  });

  const total = parseInt(totalElements ?? "0", 10);

  // Pagination state
  const [page, setPage] = useState(0);           // page 0 already loaded via params
  const [isLast, setIsLast] = useState(false);   // has backend said this is the last page?
  const [loadingMore, setLoadingMore] = useState(false);
  const isFetching = useRef(false);              // guard against duplicate calls

  // On mount: if page 0 had fewer items than PAGE_SIZE it means it's the last page
  useEffect(() => {
    if (likes.length >= total) setIsLast(true);
  }, []);

  // ── Fetch next page ───────────────────────────────────────────────────────

  const fetchNextPage = useCallback(async () => {
    if (isFetching.current || isLast) return;

    isFetching.current = true;
    setLoadingMore(true);

    try {
      const token = await getToken();
      if (!token) return;

      const { userId } = jwtDecode<JwtPayload>(token);
      const nextPage = page + 1;

      const res = await api.get<LikesPage>(
        `/like/getLikes?farmerId=${userId}&page=${nextPage}&size=${PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = res.data;
      setLikes((prev) => [...prev, ...data.content]);
      setPage(nextPage);
      setIsLast(data.last);
    } catch (e) {
      console.error("fetchNextPage failed:", e);
    } finally {
      setLoadingMore(false);
      isFetching.current = false;
    }
  }, [page, isLast]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.card} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Followers</Text>
        {total > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{total}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={likes}
        keyExtractor={(item) => String(item.Id)}
        renderItem={({ item }) => <BuyerCard entry={item} />}
        contentContainerStyle={[
          styles.listContent,
          likes.length === 0 && styles.listContentEmpty,
        ]}
        ListHeaderComponent={
          likes.length > 0 ? (
            <View style={styles.summaryStrip}>
              <Ionicons name="heart" size={14} color={C.primary} />
              <Text style={styles.summaryText}>
                {total} buyer{total !== 1 ? "s" : ""} follow your farm
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={<EmptyState />}
        ListFooterComponent={<FooterLoader visible={loadingMore} />}
        // ── Infinite scroll trigger ──────────────────────────────────────────
        onEndReachedThreshold={0.4}        // trigger when 40% from the bottom
        onEndReached={fetchNextPage}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: C.text },
  countBadge: {
    backgroundColor: C.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countBadgeText: { fontSize: 13, fontWeight: "700", color: C.primary },

  listContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24 },
  listContentEmpty: { flex: 1 },

  summaryStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  summaryText: { fontSize: 13, color: C.primary, fontWeight: "500" },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  cardBody: { flex: 1, gap: 4 },
  cardName: { fontSize: 15, fontWeight: "600", color: C.text },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  cardMetaText: { fontSize: 12, color: C.textMuted, flexShrink: 1 },

  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  timeBadgeText: { fontSize: 10, color: C.primary, fontWeight: "500" },

  footerLoader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  footerLoaderText: { fontSize: 13, color: C.textMuted },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: C.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: C.text },
  emptySubtitle: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
});