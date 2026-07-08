import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  FlatList,
  Linking,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

// Adjust these two import paths to match your project structure
import API from "../../_services/api";
import { getToken } from "../../_services/storage";
import { jwtDecode, JwtPayload } from "jwt-decode";

const C = {
  primary: "#3a7d44",
  primaryDark: "#2c5f34",
  bg: "#F5F8F2",
  card: "#ffffff",
  border: "#efefef",
  text: "#111111",
  textMuted: "#999999",
  chipBg: "#eaf4ea",
  heart: "#e0392c",
};

const PAGE_SIZE = 3; // matches the "size" your backend Pageable returns

interface UserDto {
  id: number;
  username: string;
  email: string;
  phoneNumber: number;
  profileUrl: string;
  totalRating: number;
  count: number;
}

interface CropLocationDto {
  id: number;
  latitude: number;
  longitude: number;
}

interface CropDetailsDto {
  id: number;
  cropQuantity: number;
  cropPrice: number;
  imageUrls: string[];
  createdAt: string;
  updatedAt: string;
  user: UserDto; // the farmer
  subCategory: any;
  cropLocation: CropLocationDto;
}

interface MyJwtPayload extends JwtPayload {
  userId: number; // or string, depending on your backend
}

interface ReviewDto {
  id: number;
  buyer: UserDto;
  farmer: UserDto;
  review: string;
  createdAt: string;
  updatedAt: string;
}

function timeAgo(dateString?: string | null) {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

export default function CropDetail() {
  const router = useRouter();
  const { cropDetailId } = useLocalSearchParams<{ cropDetailId: string }>();
  console.log("CropDetail component mounted with cropDetailsId:", cropDetailId);
  const [crop, setCrop] = useState<CropDetailsDto | null>(null);
  const [loadingCrop, setLoadingCrop] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [reviewPage, setReviewPage] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [hasMoreReviews, setHasMoreReviews] = useState(true);

  const [reviewText, setReviewText] = useState("");
  const [postingReview, setPostingReview] = useState(false);

  const authHeaders = useCallback(async () => {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // decode current user id from the JWT once
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      const decode = jwtDecode<MyJwtPayload>(token);
      console.log("Decoded JWT payload:", decode);
      const uid = decode.userId;
      if (uid != null) setCurrentUserId(Number(uid));
    })();
  }, []);

  // fetch crop details
  const fetchCrop = useCallback(async () => {
    if (!cropDetailId) return;
    setLoadingCrop(true);
    try {
      console.log("Fetching crop details for cropDetailsId:", cropDetailId);
      const token = await getToken();
      console.log("Token for fetchCrop:", token, "cropDetailsId:", cropDetailId);
      const headers = await authHeaders();
      const res = await API.get(`/crop/getCropById?cropDetailsId=${cropDetailId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });console.log("Response from fetchCrop:", res.data);
      if (res.data) {
        setCrop(res.data);
      } else {
        Alert.alert("Not found", res.data?.message || "No crop details for this id");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to load crop details");
    } finally {
      setLoadingCrop(false);
    }
  }, [cropDetailId, authHeaders]);

  useEffect(() => {
    console.log("useEffect triggered for cropDetailsId:", cropDetailId);
    fetchCrop();
  }, [fetchCrop]);

  // fetch whether the current buyer already liked this farmer
  const fetchLikeStatus = useCallback(async () => {
    console.log("fetchLikeStatus called with currentUserId: ", currentUserId, "crop.user.id:", crop?.user?.id);
    if (!crop?.user?.id || !currentUserId) return;
    try {
      console.log("Fetching like status for buyerId:", currentUserId, "farmerId:", crop.user.id);
      const token = await getToken();
      const requestBody = {
      buyer: { id: currentUserId },
      farmer: { id: crop.user.id }
    };
      // NOTE: your /like/getLike endpoint reads @RequestBody on a GET.
      // Sending a body on GET isn't guaranteed on every platform — if this
      // doesn't reach the server, switch that endpoint to accept
      // buyerId/farmerId as @RequestParam instead.
      const res = await API.get(`/like/getLike?buyerId=${currentUserId}&farmerId=${crop.user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });console.log("Response from fetchLikeStatus:", res.data);
      setLiked(Boolean(res.data));
    } catch(err) {
      console.log("Failed to fetch like status, defaulting to not liked: ", err);
      // default to not-liked on failure
    }
  }, [crop?.user?.id, currentUserId, authHeaders]);

  useEffect(() => {
    fetchLikeStatus();
  }, [fetchLikeStatus]);

  const toggleLike = async () => {
    if (!crop?.user?.id || !currentUserId || likeBusy) return;
    const next = !liked;
    setLiked(next);
    setLikeBusy(true);
    try {
      console.log("Toggling like for buyerId:", currentUserId, "farmerId:", crop.user.id, "next liked:", next);
      const token = await getToken();
      if(liked){
        await API.post(`/like/deleteLike?buyerId=${currentUserId}&farmerId=${crop.user.id}`,{},
          { 
            headers: { Authorization: `Bearer ${token}` } 
          });console.log("Like removed successfully");
      }else{
        await API.post(
          `/like/uploadLike`,
          { buyer: { id: currentUserId }, farmer: { id: crop.user.id } },
          { headers: { Authorization: `Bearer ${token}` } }
        );console.log("Like added successfully");
      }
    } catch(err) {
      setLiked(!next); // revert on failure
      console.log("Failed to toggle like, reverting state: ", err);
      Alert.alert("Error", "Couldn't update like, please try again");
    } finally {
      setLikeBusy(false);
    }
  };

  // reviews — infinite loading
  const fetchReviews = useCallback(
    async (page: number, replace = false) => {
      if (!crop?.user?.id) return;
      setReviewsLoading(true);
      const token = await getToken();
      try {
        console.log("Fetching reviews for farmerId:", crop.user.id, "page:", page);
        const headers = await authHeaders();
        const res = await API.get(`/review/getReviews`, {
          params: { farmerId: crop.user.id, page },
          headers: { Authorization: `Bearer ${token}` },
        });
        const content: ReviewDto[] = res.data?.content ?? [];
        setReviews((prev) => (replace ? content : [...prev, ...content]));
        setHasMoreReviews(!res.data?.last);
        setReviewPage(page);
      } catch {
        // keep whatever we already have on failure
      } finally {
        setReviewsLoading(false);
      }
    },
    [crop?.user?.id, authHeaders]
  );

  useEffect(() => {
    if (crop?.user?.id) {
      setReviews([]);
      setReviewPage(0);
      setHasMoreReviews(true);
      fetchReviews(0, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crop?.user?.id]);

  const loadMoreReviews = () => {
    if (!hasMoreReviews || reviewsLoading) return;
    fetchReviews(reviewPage + 1);
  };

  const submitReview = async () => {
    if (!reviewText.trim() || !crop?.user?.id || !currentUserId) return;
    setPostingReview(true);
    try {
      console.log("Submitting review for buyerId:", currentUserId, "farmerId:", crop.user.id, "reviewText:", reviewText);
      const token = await getToken();
      await API.post(
        `/review/addReview`,
        {
          buyer: { id: currentUserId },
          farmer: { id: crop.user.id },
          review: reviewText.trim(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReviewText("");
      setReviews([]);
      setReviewPage(0);
      setHasMoreReviews(true);
      fetchReviews(0, true);
    } catch {
      Alert.alert("Error", "Couldn't post your review");
    } finally {
      setPostingReview(false);
    }
  };

  const handleCall = async () => {
    const phone = crop?.user?.phoneNumber;
    if (!phone) return;
    const url = `tel:${phone}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert("Unable to place call", String(phone));
    } catch {
      Alert.alert("Unable to place call", String(phone));
    }
  };

  const posted = useMemo(() => timeAgo(crop?.createdAt), [crop?.createdAt]);
  const imageUri = crop?.imageUrls?.[0];

  if (loadingCrop) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={["top"]}>
        <ActivityIndicator size="large" color={C.primary} />
      </SafeAreaView>
    );
  }

  if (!crop) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={["top"]}>
        <Text style={{ color: C.textMuted }}>Crop details not found.</Text>
      </SafeAreaView>
    );
  }

  const farmer = crop.user;
  const isOwnCrop = currentUserId != null && farmer?.id === currentUserId;

  const ListHeader = () => (
    <>
      <View style={styles.imageWrap}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.emoji}>🌿</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.priceRow}>
          <Text style={styles.price}>
            ₹{crop.cropPrice}
            <Text style={styles.priceUnit}> / unit</Text>
          </Text>
          {posted ? (
            <View style={styles.postedPill}>
              <Ionicons name="time-outline" size={12} color={C.primary} />
              <Text style={styles.postedText}>{posted}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.detailGrid}>
          <View style={styles.detailRow}>
            <Ionicons name="layers-outline" size={16} color={C.primary} />
            <Text style={styles.detailLabel}>Available Quantity</Text>
            <Text style={styles.detailValue}>{crop.cropQuantity}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Farmer</Text>
        <View style={styles.farmerRow}>
          {farmer?.profileUrl ? (
            <Image source={{ uri: farmer.profileUrl }} style={styles.farmerAvatarImg} />
          ) : (
            <View style={styles.farmerAvatar}>
              <Ionicons name="person" size={22} color={C.primary} />
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={styles.farmerName} numberOfLines={1}>
              {farmer?.username || "Unknown Farmer"}
            </Text>
            {farmer?.totalRating != null ? (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={12} color="#f5a623" />
                <Text style={styles.ratingText}>
                  {farmer.totalRating.toFixed(1)} ({farmer.count ?? 0})
                </Text>
              </View>
            ) : null}
          </View>

          {!isOwnCrop && (
            <TouchableOpacity
              onPress={toggleLike}
              disabled={likeBusy}
              style={styles.likeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={22}
                color={liked ? C.heart : C.textMuted}
              />
            </TouchableOpacity>
          )}

          {!isOwnCrop && (
            <TouchableOpacity onPress={handleCall} style={styles.callIconBtn}>
              <Ionicons name="call" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Reviews</Text>
        {!isOwnCrop && (
          <View style={styles.reviewInputRow}>
            <TextInput
              style={styles.reviewInput}
              placeholder="Write a review..."
              placeholderTextColor={C.textMuted}
              value={reviewText}
              onChangeText={setReviewText}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.reviewSendBtn,
                !reviewText.trim() && styles.reviewSendBtnDisabled,
              ]}
              onPress={submitReview}
              disabled={!reviewText.trim() || postingReview}
            >
              {postingReview ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.card} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Crop Details
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          style={{ flex: 1, backgroundColor: C.bg }}
          contentContainerStyle={styles.scrollContent}
          data={reviews}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={ListHeader}
          renderItem={({ item }) => (
            <View style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                {item.buyer?.profileUrl ? (
                  <Image source={{ uri: item.buyer.profileUrl }} style={styles.reviewAvatar} />
                ) : (
                  <View style={[styles.reviewAvatar, styles.reviewAvatarFallback]}>
                    <Ionicons name="person" size={14} color={C.primary} />
                  </View>
                )}
                <Text style={styles.reviewAuthor} numberOfLines={1}>
                  {item.buyer?.username || "Anonymous"}
                </Text>
                <Text style={styles.reviewTime}>{timeAgo(item.createdAt)}</Text>
              </View>
              <Text style={styles.reviewText}>{item.review}</Text>
            </View>
          )}
          ListEmptyComponent={
            !reviewsLoading ? <Text style={styles.emptyReviews}>No reviews yet.</Text> : null
          }
          ListFooterComponent={
            reviewsLoading ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color={C.primary} />
            ) : null
          }
          onEndReached={loadMoreReviews}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
        />
      </KeyboardAvoidingView>

      {!isOwnCrop && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.footerBtn, !farmer?.phoneNumber && styles.footerBtnDisabled]}
            activeOpacity={0.8}
            onPress={handleCall}
            disabled={!farmer?.phoneNumber}
          >
            <Ionicons name="call-outline" size={18} color="#fff" />
            <Text style={styles.footerBtnText}>Call Farmer</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.card },
  center: { justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.card,
  },
  backBtn: { width: 32, height: 32, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 16, fontWeight: "600", color: C.text, flex: 1, textAlign: "center" },

  scrollContent: { paddingBottom: 24 },

  imageWrap: { width: "100%", height: 240, backgroundColor: "#f7fdf7" },
  image: { width: "100%", height: "100%" },
  imagePlaceholder: { justifyContent: "center", alignItems: "center" },
  emoji: { fontSize: 56 },

  card: {
    backgroundColor: C.card,
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  price: { fontSize: 20, fontWeight: "700", color: C.primary },
  priceUnit: { fontSize: 12, fontWeight: "500", color: C.textMuted },
  postedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.chipBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  postedText: { fontSize: 11, color: C.primary, fontWeight: "500" },

  detailGrid: { marginTop: 14, gap: 10 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailLabel: { flex: 1, fontSize: 12, color: C.textMuted },
  detailValue: { fontSize: 12, color: C.text, fontWeight: "600" },

  sectionTitle: { fontSize: 13, fontWeight: "600", color: C.textMuted, marginBottom: 10 },
  farmerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  farmerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.chipBg,
    justifyContent: "center",
    alignItems: "center",
  },
  farmerAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  farmerName: { fontSize: 14, fontWeight: "600", color: C.text },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  ratingText: { fontSize: 11, color: C.textMuted },

  likeBtn: { padding: 4, marginRight: 4 },
  callIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.primary,
    justifyContent: "center",
    alignItems: "center",
  },

  reviewInputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  reviewInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: C.text,
  },
  reviewSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  reviewSendBtnDisabled: { backgroundColor: C.textMuted },

  reviewCard: {
    backgroundColor: C.card,
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
  },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  reviewAvatar: { width: 26, height: 26, borderRadius: 13 },
  reviewAvatarFallback: {
    backgroundColor: C.chipBg,
    justifyContent: "center",
    alignItems: "center",
  },
  reviewAuthor: { flex: 1, fontSize: 12, fontWeight: "600", color: C.text },
  reviewTime: { fontSize: 10, color: C.textMuted },
  reviewText: { fontSize: 13, color: C.text, lineHeight: 18 },
  emptyReviews: {
    textAlign: "center",
    color: C.textMuted,
    fontSize: 12,
    marginTop: 20,
  },

  footer: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.card,
  },
  footerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.primary,
    paddingVertical: 13,
    borderRadius: 14,
  },
  footerBtnDisabled: { backgroundColor: C.textMuted },
  footerBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});