import React, { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
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
  danger: "#d32f2f",
};

interface QuoteUser {
  id: number;
  username: string;
  email: string;
  phoneNumber: number;
  profileUrl?: string;
  createdAt?: string;
  updatedAt?: string;
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

function formatDate(iso?: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={16} color={C.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function QuoteDetailsScreen() {
  const router = useRouter();
  const { qid } = useLocalSearchParams<{ qid: string }>();

  const [quote, setQuote] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<"negotiate" | "accept" | null>(
    null
  );
  const [userId, setUserId] = useState<number | null>(null);

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

  const fetchQuote = useCallback(async () => {
    if (!qid) return;
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      const res = await api.get("/quote/getQuoteById", {
        params: { qid },
        headers: { Authorization: `Bearer ${token}` },
      });
      setQuote(res.data ?? null);
    } catch (e: any) {
      const message = e?.response?.data?.message;
      setError(message || "Failed to load quote details.");
    } finally {
      setLoading(false);
    }
  }, [qid]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  // NOTE: I don't have your actual negotiation/accept endpoints, so these are
  // placeholders following your existing /quote/... naming convention.
  // Swap the URL + payload to match your real backend routes.
  const handleRaiseNegotiation = async () => {
    if (!quote) return;
    try {
      setActionLoading("negotiate");
      const token = await getToken();
      await api.post(
        "/quote/raiseNegotiation",
        { qid: quote.Id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert("Negotiation started", "You can now negotiate on this quote.");
      fetchQuote();
    } catch (e: any) {
      const message = e?.response?.data?.message;
      Alert.alert("Couldn't raise negotiation", message || "Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAccept = async () => {
    if (!quote) return;
    Alert.alert(
      "Accept this quote?",
      `You're about to accept the quote for ${quote.cropName} at ₹${quote.cropPrice}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: async () => {
            try {
              setActionLoading("accept");
              const token = await getToken();
              await api.post(
                `/quote/acceptQuotation?qid=${quote.Id}`,
                {},
                {
                    headers: { 
                        Authorization: `Bearer ${token}`
                    } 
                }
              );
              Alert.alert("Quote accepted");
              fetchQuote();
            } catch (e: any) {
                console.log("Error accepting quote:", e);
              const message = e?.response?.data?.message;
              Alert.alert("Couldn't accept quote", message || "Please try again.");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={styles.loadingText}>Loading quote…</Text>
      </SafeAreaView>
    );
  }

  if (error || !quote) {
    return (
      <SafeAreaView style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={40} color={C.textMuted} />
        <Text style={styles.loadingText}>{error || "Quote not found."}</Text>
        <TouchableOpacity onPress={fetchQuote} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const sc = statusColor(quote.negotiationStatus);
  const isAccepted = quote.negotiationStatus === "ACCEPTED";
  const isNegotiating = quote.negotiationStatus === "NEGOTIATING";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.card} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quote Details</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topCard}>
          <View style={styles.topCardHeader}>
            <Text style={styles.cropName}>{quote.cropName}</Text>
            <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
              <Text style={[styles.statusText, { color: sc.text }]}>
                {quote.negotiationStatus}
              </Text>
            </View>
          </View>
          <Text style={styles.priceText}>
            ₹{quote.cropPrice}{" "}
            <Text style={styles.priceSub}>× {quote.cropQuantity} qty</Text>
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <InfoRow
            icon="location-outline"
            label="Delivery Location"
            value={quote.deliveryLocation}
          />
          <InfoRow
            icon="calendar-outline"
            label="Required By"
            value={formatDate(quote.requiredDate)}
          />
          <InfoRow
            icon="time-outline"
            label="Requested On"
            value={formatDate(quote.createdAt)}
          />
          <InfoRow
            icon="refresh-outline"
            label="Last Updated"
            value={formatDate(quote.updatedAt)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Buyer</Text>
          <View style={styles.buyerCard}>
            {quote.user?.profileUrl ? (
              <Image source={{ uri: quote.user.profileUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="person" size={20} color={C.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.buyerName}>
                {quote.user?.username || "Unknown buyer"}
              </Text>
              {quote.user?.phoneNumber ? (
                <Text style={styles.buyerSub}>+91 {quote.user.phoneNumber}</Text>
              ) : null}
              {quote.user?.email ? (
                <Text style={styles.buyerSub}>{quote.user.email}</Text>
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>

      {!isAccepted && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.negotiateBtn]}
            activeOpacity={0.85}
            disabled={actionLoading !== null}
            onPress={handleRaiseNegotiation}
          >
            {actionLoading === "negotiate" ? (
              <ActivityIndicator color={C.primary} size="small" />
            ) : (
              <>
                <Ionicons name="chatbubbles-outline" size={16} color={C.primary} />
                <Text style={styles.negotiateBtnText}>
                  {isNegotiating ? "Continue Negotiation" : "Raise Negotiation"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.acceptBtn]}
            activeOpacity={0.85}
            disabled={actionLoading !== null}
            onPress={handleAccept}
          >
            {actionLoading === "accept" ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                <Text style={styles.acceptBtnText}>Accept</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
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
    paddingHorizontal: 24,
  },
  loadingText: { fontSize: 14, color: C.textMuted, textAlign: "center" },
  retryBtn: {
    marginTop: 8,
    backgroundColor: C.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },

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

  scrollContent: { padding: 16, paddingBottom: 24, gap: 16 },

  topCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  topCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cropName: { fontSize: 18, fontWeight: "700", color: C.text, flex: 1 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: "600" },
  priceText: { fontSize: 22, fontWeight: "700", color: C.primary },
  priceSub: { fontSize: 13, fontWeight: "400", color: C.textMuted },

  section: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: C.textSub,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
  },
  infoIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: C.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  infoLabel: { fontSize: 11, color: C.textMuted, marginBottom: 2 },
  infoValue: { fontSize: 13, color: C.text, fontWeight: "500" },

  buyerCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    backgroundColor: C.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  buyerName: { fontSize: 14, fontWeight: "600", color: C.text },
  buyerSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },

  actionBar: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  negotiateBtn: {
    backgroundColor: C.primaryLight,
    borderWidth: 1,
    borderColor: C.primary,
  },
  negotiateBtnText: { color: C.primary, fontWeight: "600", fontSize: 13 },
  acceptBtn: { backgroundColor: C.primary },
  acceptBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});