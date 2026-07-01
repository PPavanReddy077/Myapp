import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Linking,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { timeAgo } from "../../_services/homeApi";

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
};

// ─── Placeholder ratings & reviews ──────────────────────────────────────────
// TODO(backend): the API doesn't expose ratings/reviews yet. This block is a
// realistic stand-in so the UI reads correctly; swap it out for a real
// fetch (e.g. fetchCropReviews(cropDetailId)) the moment that endpoint exists.
// Generating from cropDetailId so the same crop always shows the same
// "rating" instead of changing every render.
interface DummyReview {
  id: string;
  reviewerInitial: string;
  reviewerName: string;
  rating: number;
  comment: string;
  daysAgo: number;
}

const SAMPLE_COMMENTS = [
  "Good quality and fresh, exactly as described.",
  "Farmer was responsive and delivery was on time.",
  "Decent produce, a little smaller than expected but tasted great.",
  "Will buy again — fair pricing compared to the local market.",
  "Packaging could be better but the crop itself was fresh.",
];
const SAMPLE_NAMES = ["Ramesh K.", "Lakshmi N.", "Suresh P.", "Anitha R.", "Venkat M."];

function buildDummyReviews(seedKey: string): { average: number; count: number; reviews: DummyReview[] } {
  // Simple deterministic hash so the same crop always gets the same numbers.
  let hash = 0;
  for (let i = 0; i < seedKey.length; i++) hash = (hash * 31 + seedKey.charCodeAt(i)) >>> 0;

  const count = 8 + (hash % 35); // 8–42 "reviews"
  const average = Math.round((3.8 + ((hash >> 3) % 12) / 10) * 10) / 10; // 3.8–4.9

  const reviews: DummyReview[] = Array.from({ length: 3 }).map((_, i) => {
    const h = (hash >> (i * 5)) >>> 0;
    return {
      id: `${seedKey}-${i}`,
      reviewerName: SAMPLE_NAMES[h % SAMPLE_NAMES.length],
      reviewerInitial: SAMPLE_NAMES[h % SAMPLE_NAMES.length][0],
      rating: 3 + (h % 3), // 3–5 stars
      comment: SAMPLE_COMMENTS[(h >> 2) % SAMPLE_COMMENTS.length],
      daysAgo: 1 + (h % 28),
    };
  });

  return { average, count, reviews };
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <View style={{ flexDirection: "row" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= full ? "star" : i === full + 1 && half ? "star-half" : "star-outline"}
          size={size}
          color={C.accent}
        />
      ))}
    </View>
  );
}

export default function CropDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    cropDetailId?: string;
    subCategoryId?: string;
    itemName?: string;
    unit?: string;
    cropPrice?: string;
    cropQuantity?: string;
    imageUrl?: string;
    farmerName?: string;
    farmerProfileUrl?: string;
    farmerPhoneNumber?: string;
    categoryName?: string;
    createdAt?: string;
    distanceKm?: string;
  }>();

  const cropDetailId = params.cropDetailId ?? "";
  const itemName = params.itemName ?? "Crop";
  const unit = params.unit ?? "";
  const cropPrice = params.cropPrice ?? "0";
  const cropQuantity = params.cropQuantity ?? "0";
  const imageUrl = params.imageUrl ?? "";
  const farmerName = params.farmerName ?? "Farmer";
  const farmerProfileUrl = params.farmerProfileUrl ?? "";
  const farmerPhoneNumber = params.farmerPhoneNumber ?? "";
  const categoryName = params.categoryName ?? "";
  const createdAt = params.createdAt || null;
  const distanceKm = params.distanceKm ? parseFloat(params.distanceKm) : null;

  const { average, count, reviews } = useMemo(
    () => buildDummyReviews(cropDetailId || itemName + farmerName),
    [cropDetailId, itemName, farmerName]
  );

  const ago = timeAgo(createdAt);

  const handleCall = () => {
    if (!farmerPhoneNumber) {
      Alert.alert("No phone number", "This farmer hasn't shared a contact number.");
      return;
    }
    Linking.openURL(`tel:${farmerPhoneNumber}`);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{itemName}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Crop image ──────────────────────────────────────────────── */}
        <View style={s.imgBox}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={s.img} resizeMode="cover" />
          ) : (
            <Text style={s.imgEmoji}>🌿</Text>
          )}
          {categoryName ? (
            <View style={s.catChip}>
              <Text style={s.catChipText}>{categoryName}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Crop info ───────────────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.titleRow}>
            <Text style={s.cropName}>{itemName}</Text>
            <View style={s.ratingPill}>
              <Ionicons name="star" size={12} color={C.accent} />
              <Text style={s.ratingPillText}>{average.toFixed(1)}</Text>
            </View>
          </View>

          <Text style={s.priceText}>
            ₹{cropPrice} <Text style={s.priceUnit}>/ {unit || "unit"}</Text>
          </Text>

          <View style={s.metaRow}>
            <View style={s.metaItem}>
              <Ionicons name="cube-outline" size={14} color={C.textMuted} />
              <Text style={s.metaText}>{cropQuantity} {unit} available</Text>
            </View>
            {distanceKm !== null ? (
              <View style={s.metaItem}>
                <Ionicons name="location-outline" size={14} color={C.textMuted} />
                <Text style={s.metaText}>{distanceKm.toFixed(1)} km away</Text>
              </View>
            ) : null}
            {ago ? (
              <View style={s.metaItem}>
                <Ionicons name="time-outline" size={14} color={C.textMuted} />
                <Text style={s.metaText}>Listed {ago}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Farmer card ─────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Sold by</Text>
          <View style={s.farmerCard}>
            {farmerProfileUrl ? (
              <Image source={{ uri: farmerProfileUrl }} style={s.farmerAvatar} />
            ) : (
              <View style={[s.farmerAvatar, s.farmerAvatarFallback]}>
                <Text style={s.farmerAvatarText}>{farmerName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.farmerName}>{farmerName}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                <Stars value={average} size={12} />
                <Text style={s.farmerSub}>{average.toFixed(1)} ({count} reviews)</Text>
              </View>
            </View>
            <TouchableOpacity style={s.callBtn} onPress={handleCall} activeOpacity={0.8}>
              <Ionicons name="call" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Ratings & reviews ───────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.titleRow}>
            <Text style={s.sectionTitle}>Ratings & Reviews</Text>
          </View>

          <View style={s.ratingSummaryRow}>
            <Text style={s.ratingBig}>{average.toFixed(1)}</Text>
            <View>
              <Stars value={average} size={16} />
              <Text style={s.ratingCountText}>{count} ratings</Text>
            </View>
          </View>

          {reviews.map((r) => (
            <View key={r.id} style={s.reviewRow}>
              <View style={s.reviewAvatar}>
                <Text style={s.reviewAvatarText}>{r.reviewerInitial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={s.reviewName}>{r.reviewerName}</Text>
                  <Text style={s.reviewDate}>{r.daysAgo}d ago</Text>
                </View>
                <Stars value={r.rating} size={11} />
                <Text style={s.reviewComment}>{r.comment}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── Bottom action bar ─────────────────────────────────────────── */}
      <View style={s.actionBar}>
        <TouchableOpacity style={s.callActionBtn} onPress={handleCall} activeOpacity={0.85}>
          <Ionicons name="call-outline" size={18} color={C.primary} />
          <Text style={s.callActionText}>Call Farmer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.requestActionBtn}
          activeOpacity={0.85}
          onPress={() =>
            router.push({
              pathname: "/tabs/RequestQuote",
              params: { subCategoryId: params.subCategoryId ?? "", cropName: itemName },
            })
          }
        >
          <Ionicons name="cart-outline" size={18} color="#fff" />
          <Text style={s.requestActionText}>Request Quote</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 12,
    backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1.5, borderColor: "#e8e8e8",
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "600", color: C.text, flex: 1, textAlign: "center" },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  imgBox: {
    width: "100%", height: 220, backgroundColor: "#f7fdf7",
    justifyContent: "center", alignItems: "center", position: "relative",
  },
  img: { width: "100%", height: "100%" },
  imgEmoji: { fontSize: 64 },
  catChip: {
    position: "absolute", top: 14, left: 14,
    backgroundColor: "rgba(58,125,68,0.85)", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  catChipText: { color: "#fff", fontSize: 11, fontWeight: "600" },

  section: {
    paddingHorizontal: 18, paddingTop: 18,
  },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cropName: { fontSize: 20, fontWeight: "700", color: C.text, flex: 1 },
  ratingPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: C.accentLight, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  ratingPillText: { fontSize: 12, fontWeight: "600", color: "#c67c00" },

  priceText: { fontSize: 18, fontWeight: "700", color: C.primary, marginTop: 6 },
  priceUnit: { fontSize: 12, fontWeight: "500", color: C.textMuted },

  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: C.textSub },

  sectionTitle: { fontSize: 14, fontWeight: "600", color: C.text, marginBottom: 10 },

  farmerCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, padding: 14,
  },
  farmerAvatar: { width: 48, height: 48, borderRadius: 24 },
  farmerAvatarFallback: { backgroundColor: C.primaryLight, justifyContent: "center", alignItems: "center" },
  farmerAvatarText: { fontSize: 18, fontWeight: "700", color: C.primary },
  farmerName: { fontSize: 14, fontWeight: "600", color: C.text },
  farmerSub: { fontSize: 11, color: C.textMuted },
  callBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.primary, justifyContent: "center", alignItems: "center",
  },

  ratingSummaryRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 12,
  },
  ratingBig: { fontSize: 36, fontWeight: "700", color: C.text },
  ratingCountText: { fontSize: 11, color: C.textMuted, marginTop: 3 },

  reviewRow: {
    flexDirection: "row", gap: 10,
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#f5f5f5",
  },
  reviewAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.primaryLight, justifyContent: "center", alignItems: "center",
  },
  reviewAvatarText: { fontSize: 13, fontWeight: "700", color: C.primary },
  reviewName: { fontSize: 12.5, fontWeight: "600", color: C.text },
  reviewDate: { fontSize: 10.5, color: C.textMuted },
  reviewComment: { fontSize: 12, color: C.textSub, marginTop: 4, lineHeight: 17 },

  actionBar: {
    flexDirection: "row", gap: 10,
    paddingHorizontal: 18, paddingVertical: 12,
    backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border,
  },
  callActionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: 14, borderWidth: 1.5, borderColor: C.primary,
    paddingVertical: 13,
  },
  callActionText: { color: C.primary, fontSize: 14, fontWeight: "600" },
  requestActionBtn: {
    flex: 1.4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: 14, backgroundColor: C.primary,
    paddingVertical: 13,
  },
  requestActionText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});