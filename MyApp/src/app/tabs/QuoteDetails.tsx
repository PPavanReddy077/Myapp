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
  Linking,
  RefreshControl,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../_services/api";
import { getToken } from "../../_services/storage";
import { jwtDecode } from "jwt-decode";

type NegotiationStatus = "WAITING" | "NEGOTIATING" | "ACCEPTED";
type PriceModalType = "negotiate" | "accept" | null;

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

// NegotiationResponse's PK is lowercase `id` in the Java bean (unlike
// RequestQuotation/NegotiationRequest, which use capital `Id`).
interface NegotiationResponseItem {
  id: number;
  cropPrice: number;
  createdAt: string;
  updatedAt: string;
}

interface NegotiationItem {
  Id: number;
  createdAt: string;
  updatedAt: string;
  cropPrice: number | null;
  user: QuoteUser;
  // Buyer's latest counter-offer against this specific negotiation, if any.
  response?: NegotiationResponseItem | null;
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

// Works out which offer is actually the most recent one on a negotiation
// thread: the farmer's own ask, or the buyer's counter — whichever has the
// later updatedAt wins. Falls back to the original quoted crop price.
function getLatestPrice(
  basePrice: number,
  negPrice?: number | null,
  negUpdatedAt?: string,
  responsePrice?: number | null,
  responseUpdatedAt?: string
) {
  let latest = basePrice;
  let latestTime = 0;

  if (negPrice != null && negUpdatedAt) {
    const t = new Date(negUpdatedAt).getTime();
    if (t >= latestTime) {
      latestTime = t;
      latest = negPrice;
    }
  }
  if (responsePrice != null && responseUpdatedAt) {
    const t = new Date(responseUpdatedAt).getTime();
    if (t >= latestTime) {
      latestTime = t;
      latest = responsePrice;
    }
  }
  return latest;
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
  const [refreshing, setRefreshing] = useState(false);

  // Farmer's own negotiation thread (non-owner view)
  const [myNegotiation, setMyNegotiation] = useState<NegotiationItem | null>(null);
  const [myNegotiationResponse, setMyNegotiationResponse] =
    useState<NegotiationResponseItem | null>(null);

  // Buyer's list of every farmer's negotiation (owner view)
  const [negotiations, setNegotiations] = useState<NegotiationItem[]>([]);
  const [negotiationsLoading, setNegotiationsLoading] = useState(false);
  const [negotiationsError, setNegotiationsError] = useState<string | null>(null);

  const [quote, setQuote] = useState<Quotation | null>(null);

  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [priceModalType, setPriceModalType] = useState<PriceModalType>(null);
  const [priceInput, setPriceInput] = useState("");
  // Which negotiation row the buyer is acting on. Null while the modal is
  // being used by a farmer acting on their own negotiation.
  const [activeNegotiation, setActiveNegotiation] = useState<NegotiationItem | null>(null);

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

  const isOwnQuote = userId !== null && quote?.user?.id === userId;

  const fetchQuote = useCallback(async (isRefresh = false) => {
    if (!qid) return;
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
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
      setRefreshing(false);
    }
  }, [qid]);

  // --- Farmer's own negotiation (non-owner view) ---

  const fetchMyNegotiation = useCallback(async () => {
    if (!qid) return;
    try {
      const token = await getToken();
      const res = await api.get("/quote/negotiationStatus", {
        params: { qid },
        headers: { Authorization: `Bearer ${token}` },
      });
      // Backend returns the NegotiationRequest object itself on 200.
      if (res.data && res.data.Id) {
        setMyNegotiation(res.data);
      } else {
        setMyNegotiation(null);
      }
    } catch (e: any) {
      // 400 (any body, often empty {}) means no negotiation raised yet.
      setMyNegotiation(null);
    }
  }, [qid]);

  useEffect(() => {
    if (!myNegotiation?.Id) {
      setMyNegotiationResponse(null);
      return;
    }
    (async () => {
      try {
        const token = await getToken();
        const res = await api.get("/quote/getNegotiationResponse", {
          params: { negotiationRequestId: myNegotiation.Id },
          headers: { Authorization: `Bearer ${token}` },
        });
        setMyNegotiationResponse(res.data?.id ? res.data : null);
      } catch {
        setMyNegotiationResponse(null);
      }
    })();
  }, [myNegotiation?.Id]);

  // --- Buyer's negotiation list (owner view) ---

  const fetchNegotiations = useCallback(async () => {
    if (!qid) return;
    try {
      setNegotiationsLoading(true);
      setNegotiationsError(null);
      const token = await getToken();
      const res = await api.get("/quote/getNegotiationsForQuotation", {
        params: { qid, page: 0 },
        headers: { Authorization: `Bearer ${token}` },
      });
      const list: NegotiationItem[] = Array.isArray(res.data?.content)
        ? res.data.content
        : [];

      // Attach each negotiation's response (buyer's own prior counter, if any).
      const withResponses = await Promise.all(
        list.map(async (neg) => {
          try {
            const r = await api.get("/quote/getNegotiationResponse", {
              params: { negotiationRequestId: neg.Id },
              headers: { Authorization: `Bearer ${token}` },
            });
            return { ...neg, response: r.data?.id ? r.data : null };
          } catch {
            return { ...neg, response: null };
          }
        })
      );

      setNegotiations(withResponses);
    } catch (e: any) {
      console.log("Error fetching negotiations:", e);
      setNegotiationsError(e?.response?.data?.message || "Failed to load negotiations.");
    } finally {
      setNegotiationsLoading(false);
    }
  }, [qid]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  useEffect(() => {
    if (userId == null || !quote) return;
    if (isOwnQuote) {
      fetchNegotiations();
    } else {
      fetchMyNegotiation();
    }
  }, [isOwnQuote, quote, userId, fetchNegotiations, fetchMyNegotiation]);

  const onRefresh = useCallback(() => {
    fetchQuote(true);
    if (isOwnQuote) {
      fetchNegotiations();
    } else {
      fetchMyNegotiation();
    }
  }, [fetchQuote, fetchNegotiations, fetchMyNegotiation, isOwnQuote]);

  // --- Farmer actions ---

  const handleRaiseNegotiation = async (price: number) => {
    if (!quote || userId == null) return;
    try {
      setActionLoading("negotiate");
      const token = await getToken();
      await api.post(
        "/quote/createNegotiation",
        {
          cropPrice: price,
          requestQuotation: { Id: quote.Id },
          user: { id: userId },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert("Negotiation started", "You can now negotiate on this quote.");
      fetchQuote();
      fetchMyNegotiation();
    } catch (e: any) {
      console.log("Error raising negotiation:", e);
      const message = e?.response?.data?.message;
      Alert.alert("Couldn't raise negotiation", message || "Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAccept = async (price: number) => {
    if (!quote || userId == null) return;
    try {
      setActionLoading("accept");
      const token = await getToken();
      await api.post(
        "/quote/acceptQuotation",
        {
          acceptedPrice: price,
          requestQuotation: { Id: quote.Id },
          user: { id: userId },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert("Quote accepted");
      fetchQuote();
      fetchMyNegotiation();
    } catch (e: any) {
      console.log("Error accepting quote:", e);
      const message = e?.response?.data?.message;
      Alert.alert("Couldn't accept quote", message || "Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  // --- Buyer actions (per negotiation row) ---

  const handleBuyerCounter = async (neg: NegotiationItem, price: number) => {
    if (!quote || userId == null) return;
    try {
      setActionLoading("negotiate");
      const token = await getToken();
      await api.post(
        "/quote/createNegotiationResponse",
        {
          cropPrice: price,
          negotiationRequest: { Id: neg.Id },
          buyer: { id: userId },
          farmer: { id: neg.user.id },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert("Counter offer sent", `Sent to ${neg.user?.username || "farmer"}.`);
      fetchNegotiations();
    } catch (e: any) {
      console.log("Error sending counter offer:", e);
      const message = e?.response?.data?.message;
      Alert.alert("Couldn't send counter offer", message || "Please try again.");
    } finally {
      setActionLoading(null);
      setActiveNegotiation(null);
    }
  };

  const handleBuyerAccept = async (neg: NegotiationItem, price: number) => {
    if (!quote || userId == null) return;
    try {
      setActionLoading("accept");
      const token = await getToken();
      await api.post(
        "/quote/acceptQuotation",
        {
          acceptedPrice: price,
          requestQuotation: { Id: quote.Id },
          user: { id: neg.user.id },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert("Quote accepted", `Accepted ${neg.user?.username || "farmer"}'s offer.`);
      fetchQuote();
      fetchNegotiations();
    } catch (e: any) {
      console.log("Error accepting negotiation:", e);
      const message = e?.response?.data?.message;
      Alert.alert("Couldn't accept", message || "Please try again.");
    } finally {
      setActionLoading(null);
      setActiveNegotiation(null);
    }
  };

  const handleCall = () => {
    if (!quote?.user?.phoneNumber) {
      Alert.alert("No phone number", "This buyer hasn't shared a contact number.");
      return;
    }
    Linking.openURL(`tel:${quote.user.phoneNumber}`);
  };

  // --- Price modal (shared between farmer's own negotiation and buyer's per-row actions) ---

  const openNegotiationModal = () => {
    setActiveNegotiation(null);
    setPriceModalType("negotiate");
    setPriceInput("");
    setPriceModalVisible(true);
  };

  const openAcceptModal = () => {
    setActiveNegotiation(null);
    setPriceModalType("accept");
    setPriceInput("");
    setPriceModalVisible(true);
  };

  const openNegotiationModalFor = (neg: NegotiationItem) => {
    setActiveNegotiation(neg);
    setPriceModalType("negotiate");
    setPriceInput("");
    setPriceModalVisible(true);
  };

  const openAcceptModalFor = (neg: NegotiationItem) => {
    setActiveNegotiation(neg);
    setPriceModalType("accept");
    setPriceInput("");
    setPriceModalVisible(true);
  };

  const closePriceModal = () => {
    setPriceModalVisible(false);
    setPriceModalType(null);
    setPriceInput("");
    setActiveNegotiation(null);
  };

  // The floor the entered price must beat: whichever offer (farmer's ask or
  // buyer's counter) is most recent on the relevant thread.
  const getBaselinePrice = () => {
    if (!quote) return 0;
    if (activeNegotiation) {
      return getLatestPrice(
        quote.cropPrice,
        activeNegotiation.cropPrice,
        activeNegotiation.updatedAt,
        activeNegotiation.response?.cropPrice,
        activeNegotiation.response?.updatedAt
      );
    }
    return getLatestPrice(
      quote.cropPrice,
      myNegotiation?.cropPrice,
      myNegotiation?.updatedAt,
      myNegotiationResponse?.cropPrice,
      myNegotiationResponse?.updatedAt
    );
  };

  const handlePriceSubmit = () => {
    const type = priceModalType;
    const target = activeNegotiation;
    const baseline = getBaselinePrice();

    // Accepting means agreeing to whatever the latest offer on the table is —
    // there's no typed price to validate, just confirm at the baseline.
    if (type === "accept") {
      closePriceModal();
      if (isOwnQuote && target) handleBuyerAccept(target, baseline);
      else handleAccept(baseline);
      return;
    }

    const price = parseFloat(priceInput);
    if (!priceInput.trim() || isNaN(price)) {
      Alert.alert("Invalid price", "Please enter a valid number.");
      return;
    }

    if (isOwnQuote) {
      // Buyer is countering — wants to pay less, so the new offer must
      // undercut the farmer's latest ask.
      if (price >= baseline) {
        Alert.alert(
          "Price too high",
          `Your counter must be lower than the farmer's latest offer of ₹${baseline}.`
        );
        return;
      }
    } else {
      // Farmer is asking — wants to earn more, so the new ask must beat
      // the buyer's latest offer.
      if (price <= baseline) {
        Alert.alert(
          "Price too low",
          `Your price must be higher than the buyer's latest offer of ₹${baseline}.`
        );
        return;
      }
    }

    closePriceModal();
    if (isOwnQuote && target) {
      handleBuyerCounter(target, price);
    } else {
      handleRaiseNegotiation(price);
    }
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
        <TouchableOpacity onPress={() => fetchQuote()} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const sc = statusColor(quote.negotiationStatus);
  const isAccepted = quote.negotiationStatus === "ACCEPTED";

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

      <ScrollView contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[C.primary]}
            tintColor={C.primary}
          />
        }>
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

        {!isOwnQuote && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Buyer</Text>
            <View style={styles.buyerCard}>
              {quote.user?.profileUrl ? (
                <Image source={{ uri: quote.user.profileUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={22} color={C.primary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.buyerName}>{quote.user?.username || "Buyer"}</Text>
                <Text style={styles.buyerSub}>{quote.user?.email}</Text>
              </View>
              <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
                <Ionicons name="call" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <InfoRow icon="location-outline" label="Delivery Location" value={quote.deliveryLocation} />
          <InfoRow icon="calendar-outline" label="Required By" value={formatDate(quote.requiredDate)} />
          <InfoRow icon="time-outline" label="Requested On" value={formatDate(quote.createdAt)} />
          <InfoRow icon="refresh-outline" label="Last Updated" value={formatDate(quote.updatedAt)} />
        </View>

        {/* Farmer's own negotiation thread with this buyer */}
        {!isOwnQuote && myNegotiation && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Negotiation</Text>
            <View style={styles.negotiationCard}>
              <View style={styles.negotiationHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.negotiationBuyer}>Your offer</Text>
                  <Text style={styles.negotiationDate}>
                    {formatDate(myNegotiation.updatedAt)}
                  </Text>
                </View>
                <Text style={styles.negotiationPrice}>
                  {myNegotiation.cropPrice != null ? `₹${myNegotiation.cropPrice}` : "-"}
                </Text>
              </View>
              {myNegotiationResponse && (
                <Text style={styles.counterOfferText}>
                  Buyer's counter: ₹{myNegotiationResponse.cropPrice}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Buyer's list of every farmer negotiating on this quote */}
        {isOwnQuote && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Negotiations</Text>

            {negotiationsLoading ? (
              <ActivityIndicator color={C.primary} style={{ marginVertical: 12 }} />
            ) : negotiationsError ? (
              <Text style={styles.emptyNegotiationsText}>{negotiationsError}</Text>
            ) : negotiations.length === 0 ? (
              <Text style={styles.emptyNegotiationsText}>No negotiations yet.</Text>
            ) : (
              negotiations.map((neg) => (
                <View key={neg.Id} style={styles.negotiationCard}>
                  <View style={styles.negotiationHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.negotiationBuyer}>
                        {neg.user?.username || "Buyer"}
                      </Text>
                      <Text style={styles.negotiationDate}>{formatDate(neg.createdAt)}</Text>
                    </View>
                    <Text style={styles.negotiationPrice}>
                      {neg.cropPrice != null ? `₹${neg.cropPrice}` : "No offer yet"}
                    </Text>
                  </View>

                  {neg.response?.cropPrice != null && (
                    <Text style={styles.counterOfferText}>
                      Your counter: ₹{neg.response.cropPrice}
                    </Text>
                  )}

                  {!isAccepted && (
                    <View style={styles.negotiationActions}>
                      <TouchableOpacity
                        style={[styles.negotiationActionBtn, styles.negotiateBtn]}
                        activeOpacity={0.85}
                        disabled={actionLoading !== null}
                        onPress={() => openNegotiationModalFor(neg)}
                      >
                        <Ionicons name="chatbubbles-outline" size={14} color={C.primary} />
                        <Text style={styles.negotiateBtnText}>Counter Offer</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.negotiationActionBtn, styles.acceptBtn]}
                        activeOpacity={0.85}
                        disabled={actionLoading !== null}
                        onPress={() => openAcceptModalFor(neg)}
                      >
                        <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {!isAccepted && !isOwnQuote && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.negotiateBtn]}
            activeOpacity={0.85}
            disabled={actionLoading !== null}
            onPress={openNegotiationModal}
          >
            {actionLoading === "negotiate" ? (
              <ActivityIndicator color={C.primary} size="small" />
            ) : (
              <>
                <Ionicons name="chatbubbles-outline" size={16} color={C.primary} />
                <Text style={styles.negotiateBtnText}>
                  {myNegotiation ? "Continue Negotiation" : "Raise Negotiation"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.acceptBtn]}
            activeOpacity={0.85}
            disabled={actionLoading !== null}
            onPress={openAcceptModal}
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
      <Modal
        visible={priceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closePriceModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {priceModalType === "accept"
                ? "Confirm accept"
                : isOwnQuote
                ? "Enter your counter offer"
                : "Enter your price"}
            </Text>
            <Text style={styles.modalSubtitle}>
              {priceModalType === "accept"
                ? `You're accepting the current offer of ₹${getBaselinePrice()}.`
                : isOwnQuote
                ? `Farmer's latest ask is ₹${getBaselinePrice()}. Enter an amount lower than this.`
                : `Buyer's latest offer is ₹${getBaselinePrice()}. Enter an amount higher than this.`}
            </Text>
            {priceModalType !== "accept" && (
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 45"
                placeholderTextColor={C.textMuted}
                keyboardType="numeric"
                value={priceInput}
                onChangeText={setPriceInput}
                autoFocus
              />
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={closePriceModal}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirmBtn]}
                onPress={handlePriceSubmit}
              >
                <Text style={styles.modalConfirmText}>
                  {priceModalType === "accept" ? "Accept" : "Submit"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: C.text },
  modalSubtitle: { fontSize: 12, color: C.textMuted },
  modalInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: C.text,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  modalCancelBtn: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  modalCancelText: { color: C.textSub, fontWeight: "600", fontSize: 13 },
  modalConfirmBtn: { backgroundColor: C.primary },
  modalConfirmText: { color: "#fff", fontWeight: "600", fontSize: 13 },

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
  disabledBtn: {
    opacity: 0.4,
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
  emptyNegotiationsText: { fontSize: 13, color: C.textMuted, paddingVertical: 8 },
  negotiationCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  negotiationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  negotiationBuyer: { fontSize: 13, fontWeight: "600", color: C.text },
  negotiationDate: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  negotiationPrice: { fontSize: 15, fontWeight: "700", color: C.primary },
  counterOfferText: {
    fontSize: 12,
    color: C.accent,
    fontWeight: "600",
  },
  negotiationActions: { flexDirection: "row", gap: 8 },
  negotiationActionBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
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
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: {
    backgroundColor: C.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  buyerName: { fontSize: 14, fontWeight: "600", color: C.text },
  buyerSub: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  callBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.primary,
    justifyContent: "center",
    alignItems: "center",
  },

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