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
  RefreshControl,
  Linking,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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
  amber: "#b7791f",
  amberBg: "#fdf3e0",
};

interface UserDto {
  id: number;
  username: string;
  email: string;
  phoneNumber: number;
  profileUrl: string;
  totalRating: number;
  count: number;
  favouriteCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface CropLocationDto {
  id: number;
  latitude: number;
  longitude: number;
}

interface CategoryDto {
  Id: number;
  categoryName: string;
}

interface UnitDto {
  Id: number;
  unit: string;
}

interface SubCategoryDto {
  Id: number;
  itemName: string;
  categories: CategoryDto;
  units: UnitDto;
}

// Mirrors backend Enum.CropDetailsStatus
type CropDetailsStatus = "WAITING" | "CROP_ACCEPTED" | "UNDER_NEGOTIATION";

interface CropDetailsDto {
  Id: number;
  cropQuantity: number;
  cropPrice: number;
  imageUrls: string[];
  createdAt: string;
  updatedAt: string;
  user: UserDto;
  subCategory: SubCategoryDto;
  cropLocation: CropLocationDto;
  cropDetailsStatus?: CropDetailsStatus;
}

// Returned by /cropNegotiation/getAcceptedCrops once a crop's status is
// CROP_ACCEPTED — the winning buyer + the price they closed the deal at.
interface CropNegotiationAcceptedDto {
  id: number;
  acceptedPrice: number;
  buyer: UserDto;
  cropDetails?: { Id?: number; id?: number } | CropDetailsDto;
  createdAt: string;
  updatedAt: string;
}

interface MyJwtPayload extends JwtPayload {
  userId: number;
}

interface ReviewDto {
  id: number;
  buyer: UserDto;
  farmer: UserDto;
  review: string;
  createdAt: string;
  updatedAt: string;
}

// Note: cropDetails is embedded with a capital "Id" field (backend quirk,
// consistent with every other cropDetails reference across the app), while
// CropNegotiationRequest/Response/Accepted all use lowercase "id" for themselves.
interface CropNegotiationRequestDto {
  id: number;
  cropPrice: number;
  buyer: UserDto;
  cropDetails?: { Id?: number; id?: number } | CropDetailsDto;
  createdAt: string;
  updatedAt: string;
}

interface CropNegotiationResponseDto {
  id: number;
  cropPrice: number;
  cropNegotiationRequest: CropNegotiationRequestDto;
  createdAt: string;
  updatedAt: string;
}

// Client-side augmentation: the farmer's negotiations list is a Page of
// CropNegotiationRequest; we attach each request's response ourselves after
// fetching them in parallel, since the backend doesn't return them nested.
type NegotiationRow = CropNegotiationRequestDto & {
  response?: CropNegotiationResponseDto | null;
};

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
  const [crop, setCrop] = useState<CropDetailsDto | null>(null);
  const [loadingCrop, setLoadingCrop] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [reviewPage, setReviewPage] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [hasMoreReviews, setHasMoreReviews] = useState(true);
  const [reviewText, setReviewText] = useState("");
  const [postingReview, setPostingReview] = useState(false);

  // ---- Buyer-side negotiation state ----
  const [myNegotiationRequest, setMyNegotiationRequest] =
    useState<CropNegotiationRequestDto | null>(null);
  const [myNegotiationResponse, setMyNegotiationResponse] =
    useState<CropNegotiationResponseDto | null>(null);
  const [buyerNegotiationLoading, setBuyerNegotiationLoading] = useState(false);
  const [buyerModalVisible, setBuyerModalVisible] = useState(false);
  const [buyerOfferInput, setBuyerOfferInput] = useState("");
  const [buyerCounterInput, setBuyerCounterInput] = useState("");
  const [buyerCounterMode, setBuyerCounterMode] = useState(false);
  const [buyerSubmitting, setBuyerSubmitting] = useState(false);

  // ---- Farmer-side negotiation state ----
  const [farmerNegotiations, setFarmerNegotiations] = useState<NegotiationRow[]>([]);
  const [farmerNegotiationsPage, setFarmerNegotiationsPage] = useState(0);
  const [farmerNegotiationsLoading, setFarmerNegotiationsLoading] = useState(false);
  const [farmerHasMore, setFarmerHasMore] = useState(true);
  const [farmerModalVisible, setFarmerModalVisible] = useState(false);
  const [selectedNegotiation, setSelectedNegotiation] = useState<NegotiationRow | null>(null);
  const [farmerPriceInput, setFarmerPriceInput] = useState("");
  const [farmerSubmitting, setFarmerSubmitting] = useState(false);

  // ---- Accepted-deal state (once cropDetailsStatus === CROP_ACCEPTED) ----
  const [acceptedDeal, setAcceptedDeal] = useState<CropNegotiationAcceptedDto | null>(null);
  const [acceptedDealLoading, setAcceptedDealLoading] = useState(false);

  // ---- Profile popup state (tapping any farmer/buyer avatar or name) ----
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileModalLoading, setProfileModalLoading] = useState(false);
  const [profileModalUser, setProfileModalUser] = useState<UserDto | null>(null);
  const [profileModalError, setProfileModalError] = useState<string | null>(null);

  const authHeaders = useCallback(async () => {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      const decode = jwtDecode<MyJwtPayload>(token);
      const uid = decode.userId;
      if (uid != null) setCurrentUserId(Number(uid));
    })();
  }, []);

  const fetchCrop = useCallback(
    async (silent = false) => {
      if (!cropDetailId) return;
      if (!silent) setLoadingCrop(true);
      try {
        const token = await getToken();
        const res = await API.get(`/crop/getCropById?cropDetailsId=${cropDetailId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data) {
          setCrop(res.data);
        } else {
          Alert.alert("Not found", res.data?.message || "No crop details for this id");
        }
      } catch (err: any) {
        Alert.alert("Error", err?.message || "Failed to load crop details");
      } finally {
        if (!silent) setLoadingCrop(false);
      }
    },
    [cropDetailId, authHeaders]
  );

  useEffect(() => {
    fetchCrop();
  }, [fetchCrop]);

  // isOwnCrop is computed via useMemo, before any early returns below, so hook
  // ordering stays consistent across renders regardless of loading/not-found state.
  const isOwnCrop = useMemo(
    () => currentUserId != null && crop?.user?.id === currentUserId,
    [currentUserId, crop?.user?.id]
  );

  // Is the currently-logged-in user the buyer who won this crop's deal?
  const isWinningBuyer = useMemo(
    () => currentUserId != null && acceptedDeal?.buyer?.id === currentUserId,
    [currentUserId, acceptedDeal?.buyer?.id]
  );

  const isCropAccepted = crop?.cropDetailsStatus === "CROP_ACCEPTED";

  // Buyer can accept directly if the farmer sent a counter-offer, OR if the
  // buyer never raised a negotiation at all (accepting the listed price).
  // If a negotiation is pending farmer response, there's nothing to accept yet.
  const canAcceptAsBuyer =
    !isCropAccepted && Boolean(myNegotiationResponse || !myNegotiationRequest);

  // ---------------------------------------------------------------------
  // Once a crop is CROP_ACCEPTED, fetch who the winning buyer is + the
  // price they closed at, so we can swap the negotiation UI for a
  // "deal confirmed" card. Fetched regardless of role (farmer sees the
  // buyer's contact, the winning buyer sees their own confirmation).
  // ---------------------------------------------------------------------
  const fetchAcceptedDeal = useCallback(async () => {
    if (!crop?.Id || !isCropAccepted) return;
    setAcceptedDealLoading(true);
    try {
      const token = await getToken();
      const res = await API.get(`/cropNegotiation/getAcceptedCrops`, {
        params: { cropDetailsId: crop.Id },
        headers: { Authorization: `Bearer ${token}` },
      });
      setAcceptedDeal(res.data && !res.data.message ? res.data : null);
    } catch {
      setAcceptedDeal(null);
    } finally {
      setAcceptedDealLoading(false);
    }
  }, [crop?.Id, isCropAccepted]);

  useEffect(() => {
    if (isCropAccepted) {
      fetchAcceptedDeal();
    } else {
      setAcceptedDeal(null);
    }
  }, [isCropAccepted, fetchAcceptedDeal]);

  const fetchLikeStatus = useCallback(async () => {
    if (!crop?.user?.id || !currentUserId) return;
    try {
      const token = await getToken();
      const res = await API.get(`/like/getLike?buyerId=${currentUserId}&farmerId=${crop.user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLiked(Boolean(res.data));
    } catch (err) {
      Alert.alert("Error", "Couldn't fetch like status, defaulting to not liked");
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
      const token = await getToken();
      if (liked) {
        await API.post(
          `/like/deleteLike?buyerId=${currentUserId}&farmerId=${crop.user.id}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await API.post(
          `/like/uploadLike`,
          { buyer: { id: currentUserId }, farmer: { id: crop.user.id } },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    } catch (err) {
      setLiked(!next);
      Alert.alert("Error", "Couldn't update like, please try again");
    } finally {
      setLikeBusy(false);
    }
  };

  const fetchReviews = useCallback(
    async (page: number, replace = false) => {
      if (!crop?.user?.id) return;
      setReviewsLoading(true);
      const token = await getToken();
      try {
        const res = await API.get(`/review/getReviews`, {
          params: { farmerId: crop.user.id, page },
          headers: { Authorization: `Bearer ${token}` },
        });
        const content: ReviewDto[] = res.data?.content ?? [];
        setReviews((prev) => (replace ? content : [...prev, ...content]));
        setHasMoreReviews(!res.data?.last);
        setReviewPage(page);
      } catch (err) {
        Alert.alert("Error", "Failed to fetch reviews");
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
  }, [crop?.user?.id, fetchReviews]);

  const loadMoreReviews = () => {
    if (!hasMoreReviews || reviewsLoading || reviews.length === 0) return;
    fetchReviews(reviewPage + 1);
  };

  const submitReview = async () => {
    if (!reviewText.trim() || !crop?.user?.id || !currentUserId) return;
    setPostingReview(true);
    try {
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

  const handleCallNumber = async (phone?: number | string | null) => {
    if (!phone) return;
    const url = `tel:${phone}`;
    try {
      // Not gating on Linking.canOpenURL() here: on Android 11+ it returns
      // false for tel: unless the app declares a <queries> entry for it in
      // AndroidManifest.xml (package-visibility restriction), even though
      // the dialer handles the intent fine. openURL is the reliable check.
      await Linking.openURL(url);
    } catch {
      Alert.alert("Unable to place call", String(phone));
    }
  };

  const handleCall = () => handleCallNumber(crop?.user?.phoneNumber);

  // ---------------------------------------------------------------------
  // PROFILE POPUP: tapping any farmer/buyer avatar or name across the page
  // (farmer card, negotiation rows, deal-confirmed contact, reviews) opens
  // a small modal fetching the latest user record by id.
  // ---------------------------------------------------------------------
  const openProfileModal = useCallback(async (userId?: number | null) => {
    if (userId == null) return;
    setProfileModalVisible(true);
    setProfileModalLoading(true);
    setProfileModalError(null);
    setProfileModalUser(null);
    try {
      const token = await getToken();
      const res = await API.get(`/user/getUser`, {
        params: { id: userId },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data && !res.data.message) {
        setProfileModalUser(res.data);
      } else {
        setProfileModalError("Couldn't load this profile.");
      }
    } catch (err) {
      setProfileModalError("Couldn't load this profile.");
    } finally {
      setProfileModalLoading(false);
    }
  }, []);

  const closeProfileModal = () => {
    setProfileModalVisible(false);
    setProfileModalUser(null);
    setProfileModalError(null);
  };

  // ---------------------------------------------------------------------
  // BUYER SIDE: fetch my own negotiation request/response for this crop
  // ---------------------------------------------------------------------
  const fetchBuyerNegotiation = useCallback(async () => {
    if (!crop?.Id || !currentUserId || isOwnCrop) return;
    setBuyerNegotiationLoading(true);
    try {
      const token = await getToken();
      const res = await API.get(`/cropNegotiation/getNegotiationRequests`, {
        params: { buyerId: currentUserId },
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data;
      // Backend only accepts buyerId (not scoped to a crop), so we filter
      // client-side to confirm the returned request actually belongs to
      // the crop currently being viewed.
      const reqCropId = data?.cropDetails?.Id ?? (data?.cropDetails as any)?.id;
      if (data && !data.message && reqCropId === crop.Id) {
        setMyNegotiationRequest(data);
        try {
          const respRes = await API.get(`/cropNegotiation/getCropNegotiationResponse`, {
            params: { cropNegotiationRequestId: data.id },
            headers: { Authorization: `Bearer ${token}` },
          });
          setMyNegotiationResponse(
            respRes.data && !respRes.data.message ? respRes.data : null
          );
        } catch {
          setMyNegotiationResponse(null);
        }
      } else {
        setMyNegotiationRequest(null);
        setMyNegotiationResponse(null);
      }
    } catch (err) {
      setMyNegotiationRequest(null);
      setMyNegotiationResponse(null);
    } finally {
      setBuyerNegotiationLoading(false);
    }
  }, [crop?.Id, currentUserId, isOwnCrop]);

  useEffect(() => {
    if (crop?.Id && currentUserId != null && !isOwnCrop) {
      fetchBuyerNegotiation();
    }
  }, [crop?.Id, currentUserId, isOwnCrop, fetchBuyerNegotiation]);

  // Both "raise negotiation" and "send counter" hit the same endpoint. The
  // backend's createRequest looks up any existing request for this
  // buyer+crop, deletes it (and its response, if any) first, then saves the
  // new one — so re-posting here is exactly how a buyer counters, not
  // createCropNegotiationResponse (that endpoint is farmer -> buyer only).
  const postBuyerNegotiationRequest = async (price: number): Promise<boolean> => {
    if (!crop?.Id || !currentUserId) return false;
    setBuyerSubmitting(true);
    try {
      const token = await getToken();
      const res = await API.post(
        `/cropNegotiation/createCropNegotiationRequest`,
        { cropPrice: price, cropDetails: { Id: crop.Id }, buyer: { id: currentUserId } },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data && !res.data.message) {
        // The old request + its response (if any) were just deleted
        // server-side, so always clear the response here too.
        setMyNegotiationRequest(res.data);
        setMyNegotiationResponse(null);
        return true;
      }
      Alert.alert("Error", res.data?.message || "Couldn't send your offer");
      return false;
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Couldn't send your offer");
      return false;
    } finally {
      setBuyerSubmitting(false);
    }
  };

  const submitBuyerOffer = async () => {
    const price = parseFloat(buyerOfferInput);
    if (!price || price <= 0) {
      Alert.alert("Invalid price", "Please enter a valid offer price");
      return;
    }
    if (crop?.cropPrice != null && price >= crop.cropPrice) {
      Alert.alert("Invalid price", `Your offer should be lower than the listed price of ₹${crop.cropPrice}`);
      return;
    }
    const ok = await postBuyerNegotiationRequest(price);
    if (ok) {
      setBuyerOfferInput("");
      Alert.alert("Offer sent", "Your negotiation offer has been sent to the farmer");
    }
  };

  const submitBuyerCounter = async () => {
    const price = parseFloat(buyerCounterInput);
    const farmerLastPrice = myNegotiationResponse?.cropPrice;
    if (!price || price <= 0 || !myNegotiationRequest) {
      Alert.alert("Invalid price", "Please enter a valid counter price");
      return;
    }
    if (farmerLastPrice != null && price >= farmerLastPrice) {
      Alert.alert("Invalid price", `Your counter should be lower than the farmer's ₹${farmerLastPrice}`);
      return;
    }
    const ok = await postBuyerNegotiationRequest(price);
    if (ok) {
      setBuyerCounterInput("");
      setBuyerCounterMode(false);
    }
  };

  const acceptAsBuyer = async () => {
    if (!crop?.Id || !currentUserId) return;
    // If the farmer has sent a counter, accept that price. Otherwise, as
    // long as the buyer never raised a negotiation, accept the farmer's
    // originally listed price directly — no negotiation required.
    const priceToAccept = myNegotiationResponse
      ? myNegotiationResponse.cropPrice
      : !myNegotiationRequest
      ? crop.cropPrice
      : null;
    if (priceToAccept == null) return;
    setBuyerSubmitting(true);
    try {
      const token = await getToken();
      const res = await API.post(
        `/negotiationRequest/acceptNegotiation`,
        {
          acceptedPrice: priceToAccept,
          cropDetails: { Id: crop.Id },
          buyer: { id: currentUserId },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data && !res.data.message) {
        Alert.alert("Deal accepted!", `You've agreed on ₹${priceToAccept} per unit.`);
        setBuyerModalVisible(false);
      } else {
        Alert.alert("Error", res.data?.message || "Couldn't accept the offer");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Couldn't accept the offer");
    } finally {
      setBuyerSubmitting(false);
    }
  };

  const openBuyerModal = () => {
    setBuyerCounterMode(false);
    setBuyerCounterInput("");
    setBuyerModalVisible(true);
    if (crop?.Id && currentUserId != null) fetchBuyerNegotiation();
  };

  // ---------------------------------------------------------------------
  // FARMER SIDE: fetch all negotiation requests for this crop (paginated)
  // ---------------------------------------------------------------------
  const fetchFarmerNegotiations = useCallback(
    async (page: number, replace = false) => {
      if (!crop?.Id || !isOwnCrop) return;
      setFarmerNegotiationsLoading(true);
      try {
        const token = await getToken();
        const res = await API.get(`/cropNegotiation/getAllNegotiationsForCrop`, {
          params: { cropDetailsId: crop.Id, page },
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = res.data;
        if (data?.content) {
          const rows: NegotiationRow[] = data.content;
          // Fetch each request's response in parallel rather than serially.
          const results = await Promise.allSettled(
            rows.map((row) =>
              API.get(`/cropNegotiation/getCropNegotiationResponse`, {
                params: { cropNegotiationRequestId: row.id },
                headers: { Authorization: `Bearer ${token}` },
              })
            )
          );
          const withResponses: NegotiationRow[] = rows.map((row, idx) => {
            const r = results[idx];
            if (r.status === "fulfilled" && r.value.data && !r.value.data.message) {
              return { ...row, response: r.value.data };
            }
            return { ...row, response: null };
          });
          setFarmerNegotiations((prev) => (replace ? withResponses : [...prev, ...withResponses]));
          setFarmerHasMore(!data.last);
          setFarmerNegotiationsPage(page);
        } else {
          if (replace) setFarmerNegotiations([]);
          setFarmerHasMore(false);
        }
      } catch (err) {
        Alert.alert("Error", "Failed to fetch negotiations");
      } finally {
        setFarmerNegotiationsLoading(false);
      }
    },
    [crop?.Id, isOwnCrop]
  );

  useEffect(() => {
    if (crop?.Id && isOwnCrop) {
      setFarmerNegotiations([]);
      setFarmerNegotiationsPage(0);
      setFarmerHasMore(true);
      fetchFarmerNegotiations(0, true);
    }
  }, [crop?.Id, isOwnCrop, fetchFarmerNegotiations]);

  const loadMoreFarmerNegotiations = () => {
    if (!farmerHasMore || farmerNegotiationsLoading || farmerNegotiations.length === 0) return;
    fetchFarmerNegotiations(farmerNegotiationsPage + 1);
  };

  const openFarmerRespond = (row: NegotiationRow) => {
    setSelectedNegotiation(row);
    setFarmerPriceInput("");
    setFarmerModalVisible(true);
  };

  const submitFarmerCounter = async () => {
    const price = parseFloat(farmerPriceInput);
    if (!selectedNegotiation) return;
    const lastPrice = selectedNegotiation.response?.cropPrice ?? selectedNegotiation.cropPrice;
    if (!price || price <= 0) {
      Alert.alert("Invalid price", "Please enter a valid counter price");
      return;
    }
    if (price <= lastPrice) {
      Alert.alert("Invalid price", `Your counter should be higher than ₹${lastPrice}`);
      return;
    }
    setFarmerSubmitting(true);
    try {
      const token = await getToken();
      // CropNegotiationResponse is @OneToOne on cropNegotiationRequest, so
      // this assumes the farmer's response service upserts (or that this is
      // the first response on a fresh request). If the farmer needs to
      // revise a counter they already sent, confirm the service handles
      // that the same way createRequest does (delete-then-save) — otherwise
      // this call may fail on the second attempt.
      const res = await API.post(
        `/cropNegotiation/createCropNegotiationResponse`,
        { cropPrice: price, cropNegotiationRequest: { id: selectedNegotiation.id } },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data && !res.data.message) {
        setFarmerNegotiations((prev) =>
          prev.map((r) => (r.id === selectedNegotiation.id ? { ...r, response: res.data } : r))
        );
        setSelectedNegotiation((prev) => (prev ? { ...prev, response: res.data } : prev));
        setFarmerPriceInput("");
      } else {
        Alert.alert("Error", res.data?.message || "Couldn't send counter offer");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Couldn't send counter offer");
    } finally {
      setFarmerSubmitting(false);
    }
  };

  const acceptAsFarmer = async (row: NegotiationRow) => {
    if (!crop?.Id) return;
    const finalPrice = row.response?.cropPrice ?? row.cropPrice;
    setFarmerSubmitting(true);
    try {
      const token = await getToken();
      const res = await API.post(
        `/negotiationRequest/acceptNegotiation`,
        { acceptedPrice: finalPrice, cropDetails: { Id: crop.Id }, buyer: { id: row.buyer.id } },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data && !res.data.message) {
        Alert.alert("Deal accepted!", `You've agreed to sell to ${row.buyer.username} at ₹${finalPrice} per unit.`);
        setFarmerModalVisible(false);
      } else {
        Alert.alert("Error", res.data?.message || "Couldn't accept the offer");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Couldn't accept the offer");
    } finally {
      setFarmerSubmitting(false);
    }
  };

  // Pull-to-refresh: re-fetch the crop itself plus everything derived from
  // it. fetchCrop is silent (no full-page spinner); the rest are cheap
  // enough to just re-run outright and are no-ops if their preconditions
  // (role, crop id) aren't met.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchCrop(true);
      await Promise.allSettled([
        fetchLikeStatus(),
        fetchReviews(0, true),
        fetchBuyerNegotiation(),
        fetchFarmerNegotiations(0, true),
        fetchAcceptedDeal(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    fetchCrop,
    fetchLikeStatus,
    fetchReviews,
    fetchBuyerNegotiation,
    fetchFarmerNegotiations,
    fetchAcceptedDeal,
  ]);

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
  const negotiationButtonLabel = myNegotiationRequest ? "Continue Negotiation" : "Raise Negotiation";
  const unitLabel = crop.subCategory?.units?.unit || "unit";
  const itemName = crop.subCategory?.itemName || "Crop";
  const categoryName = crop.subCategory?.categories?.categoryName;
  const statusMeta: Record<CropDetailsStatus, { label: string; color: string; bg: string }> = {
    WAITING: { label: "Listed", color: C.primary, bg: C.chipBg },
    UNDER_NEGOTIATION: { label: "In Negotiation", color: C.amber, bg: C.amberBg },
    CROP_ACCEPTED: { label: "Sold", color: C.heart, bg: "#fbe4e1" },
  };
  const currentStatus = statusMeta[crop.cropDetailsStatus || "WAITING"];

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
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cropTitle} numberOfLines={1}>{itemName}</Text>
            {categoryName ? (
              <View style={styles.categoryChip}>
                <Text style={styles.categoryChipText}>{categoryName}</Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.statusPill, { backgroundColor: currentStatus.bg }]}>
            <Text style={[styles.statusPillText, { color: currentStatus.color }]}>
              {currentStatus.label}
            </Text>
          </View>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>
            ₹{crop.cropPrice}
            <Text style={styles.priceUnit}> / {unitLabel}</Text>
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
            <Text style={styles.detailValue}>
              {crop.cropQuantity} {unitLabel}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Farmer</Text>
        <View style={styles.farmerRow}>
          <TouchableOpacity
            style={styles.profileTapArea}
            activeOpacity={0.7}
            onPress={() => openProfileModal(farmer?.id)}
          >
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
          </TouchableOpacity>

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

      {/* Buyer: quick status card so they don't have to open the modal to see where things stand */}
      {!isOwnCrop && !isCropAccepted && myNegotiationRequest && (
        <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={openBuyerModal}>
          <View style={styles.negoStatusRow}>
            <Ionicons name="swap-horizontal-outline" size={18} color={C.primary} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.sectionTitle}>Your Negotiation</Text>
              <Text style={styles.negoStatusText}>
                Your offer ₹{myNegotiationRequest.cropPrice}
                {myNegotiationResponse
                  ? `  •  Farmer's counter ₹${myNegotiationResponse.cropPrice}`
                  : "  •  Waiting for farmer's response"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
          </View>
        </TouchableOpacity>
      )}

      {/* Farmer: inline negotiations list (rendered manually, not a nested FlatList).
          Hidden once the crop is accepted — the Deal Confirmed card below takes over. */}
      {isOwnCrop && !isCropAccepted && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Negotiations {farmerNegotiations.length > 0 ? `(${farmerNegotiations.length})` : ""}
          </Text>

          {farmerNegotiationsLoading && farmerNegotiations.length === 0 ? (
            <ActivityIndicator color={C.primary} style={{ marginVertical: 10 }} />
          ) : farmerNegotiations.length === 0 ? (
            <Text style={styles.emptyReviews}>No negotiation offers yet.</Text>
          ) : (
            <>
              {farmerNegotiations.map((row) => {
                const lastPrice = row.response?.cropPrice ?? row.cropPrice;
                return (
                  <TouchableOpacity
                    key={row.id}
                    style={styles.negoRow}
                    activeOpacity={0.8}
                    onPress={() => openFarmerRespond(row)}
                  >
                    <TouchableOpacity
                      style={styles.profileTapAreaRow}
                      activeOpacity={0.7}
                      onPress={() => openProfileModal(row.buyer?.id)}
                    >
                      {row.buyer?.profileUrl ? (
                        <Image source={{ uri: row.buyer.profileUrl }} style={styles.reviewAvatar} />
                      ) : (
                        <View style={[styles.reviewAvatar, styles.reviewAvatarFallback]}>
                          <Ionicons name="person" size={14} color={C.primary} />
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.negoBuyerName} numberOfLines={1}>
                          {row.buyer?.username || "Buyer"}
                        </Text>
                        <Text style={styles.negoStatusTextSmall}>
                          Offered ₹{row.cropPrice}
                          {row.response ? `  •  Your counter ₹${row.response.cropPrice}` : "  •  Awaiting your response"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.negoPill}>
                      <Text style={styles.negoPillText}>₹{lastPrice}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {farmerHasMore && (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={loadMoreFarmerNegotiations}
                  disabled={farmerNegotiationsLoading}
                >
                  {farmerNegotiationsLoading ? (
                    <ActivityIndicator size="small" color={C.primary} />
                  ) : (
                    <Text style={styles.loadMoreText}>Load more</Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}

      {/* Deal confirmed: crop is CROP_ACCEPTED, negotiation is over. Replaces
          both the buyer status card and the farmer negotiations list. */}
      {isCropAccepted && (
        <View style={styles.card}>
          <View style={styles.dealHeaderRow}>
            <Ionicons name="checkmark-circle" size={18} color={C.primary} />
            <Text style={[styles.sectionTitle, { marginBottom: 0, marginLeft: 8 }]}>
              {isOwnCrop
                ? "Deal Confirmed"
                : isWinningBuyer
                ? "You Won This Deal"
                : "This Crop Has Been Sold"}
            </Text>
          </View>

          {acceptedDealLoading ? (
            <ActivityIndicator color={C.primary} style={{ marginVertical: 14 }} />
          ) : acceptedDeal ? (
            <>
              <View style={styles.negoSummaryRow}>
                <Text style={styles.negoSummaryLabel}>Accepted price</Text>
                <Text style={styles.negoSummaryValue}>
                  ₹{acceptedDeal.acceptedPrice} / {unitLabel}
                </Text>
              </View>

              {(isOwnCrop || isWinningBuyer) && (() => {
                // Farmer sees the buyer's contact card; the winning buyer
                // sees the farmer's. Build one consistent contact object so
                // the avatar, name, email, and call button never mismatch.
                const dealContact = isOwnCrop ? acceptedDeal.buyer : farmer;
                return (
                  <View style={styles.dealBuyerRow}>
                    <TouchableOpacity
                      style={styles.profileTapAreaRow}
                      activeOpacity={0.7}
                      onPress={() => openProfileModal(dealContact?.id)}
                    >
                      {dealContact?.profileUrl ? (
                        <Image source={{ uri: acceptedDeal.buyer.profileUrl }} style={styles.farmerAvatarImg} />
                      ) : (
                        <View style={styles.farmerAvatar}>
                          <Ionicons name="person" size={22} color={C.primary} />
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.farmerName} numberOfLines={1}>
                          {acceptedDeal.buyer?.username}
                        </Text>
                        {isOwnCrop && (
                          <>
                            <Text style={styles.dealContactText} numberOfLines={1}>
                              {dealContact?.email}
                            </Text>
                            <Text style={styles.dealContactText}>{dealContact?.phoneNumber}</Text>
                          </>
                        )}
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleCallNumber(dealContact?.phoneNumber)}
                      style={styles.callIconBtn}
                    >
                      <Ionicons name="call" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                );
              })()}
            </>
          ) : (
            <Text style={styles.emptyReviews}>Deal details aren't available right now.</Text>
          )}
        </View>
      )}

      {isOwnCrop && isCropAccepted ? null : (
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
      )}
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
                <TouchableOpacity
                  style={styles.profileTapAreaRow}
                  activeOpacity={0.7}
                  onPress={() => openProfileModal(item.buyer?.id)}
                >
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
                </TouchableOpacity>
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.primary}
              colors={[C.primary]}
            />
          }
        />
      </KeyboardAvoidingView>

      {!isOwnCrop && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.footerBtn,
              styles.footerBtnSecondary,
              (!canAcceptAsBuyer || buyerNegotiationLoading || buyerSubmitting) &&
                styles.footerBtnDisabled,
            ]}
            activeOpacity={0.8}
            onPress={acceptAsBuyer}
            disabled={!canAcceptAsBuyer || buyerNegotiationLoading || buyerSubmitting}
          >
            {buyerSubmitting ? (
              <ActivityIndicator size="small" color={C.primary} />
            ) : (
              <Ionicons name="checkmark-outline" size={18} color={C.primary} />
            )}
            <Text style={styles.footerBtnTextSecondary}>Accept</Text>
          </TouchableOpacity>

          {isCropAccepted ? (
            <View style={[styles.footerBtn, { flex: 1.4 }, styles.footerBtnDisabled]}>
              <Ionicons name="lock-closed-outline" size={18} color="#fff" />
              <Text style={styles.footerBtnText}>
                {isWinningBuyer ? "Deal Confirmed" : "Sold Out"}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.footerBtn, { flex: 1.4 }]}
              activeOpacity={0.8}
              onPress={openBuyerModal}
            >
              {buyerNegotiationLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="swap-horizontal-outline" size={18} color="#fff" />
              )}
              <Text style={styles.footerBtnText}>{negotiationButtonLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* -------------------- BUYER NEGOTIATION MODAL -------------------- */}
      <Modal
        visible={buyerModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBuyerModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Negotiate Price</Text>
              <TouchableOpacity onPress={() => setBuyerModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={C.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalListedPrice}>Listed price: ₹{crop.cropPrice} / unit</Text>

            {buyerNegotiationLoading ? (
              <ActivityIndicator color={C.primary} style={{ marginVertical: 20 }} />
            ) : !myNegotiationRequest ? (
              <>
                <Text style={styles.modalLabel}>Your offer (₹ per unit)</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  placeholder="e.g. 40"
                  placeholderTextColor={C.textMuted}
                  value={buyerOfferInput}
                  onChangeText={setBuyerOfferInput}
                />
                <TouchableOpacity
                  style={[styles.modalPrimaryBtn, !buyerOfferInput.trim() && styles.footerBtnDisabled]}
                  onPress={submitBuyerOffer}
                  disabled={!buyerOfferInput.trim() || buyerSubmitting}
                >
                  {buyerSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalPrimaryBtnText}>Send Offer</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.negoSummaryRow}>
                  <Text style={styles.negoSummaryLabel}>Your offer</Text>
                  <Text style={styles.negoSummaryValue}>₹{myNegotiationRequest.cropPrice}</Text>
                </View>

                {myNegotiationResponse ? (
                  <View style={styles.negoSummaryRow}>
                    <Text style={styles.negoSummaryLabel}>Farmer's counter</Text>
                    <Text style={[styles.negoSummaryValue, { color: C.amber }]}>
                      ₹{myNegotiationResponse.cropPrice}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.waitingText}>Waiting for the farmer to respond…</Text>
                )}

                {myNegotiationResponse && !buyerCounterMode && (
                  <View style={styles.modalActionsRow}>
                    <TouchableOpacity
                      style={[styles.modalPrimaryBtn, { flex: 1 }]}
                      onPress={acceptAsBuyer}
                      disabled={buyerSubmitting}
                    >
                      {buyerSubmitting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.modalPrimaryBtnText}>
                          Accept ₹{myNegotiationResponse.cropPrice}
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalSecondaryBtn, { flex: 1 }]}
                      onPress={() => setBuyerCounterMode(true)}
                    >
                      <Text style={styles.modalSecondaryBtnText}>Counter</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {myNegotiationResponse && buyerCounterMode && (
                  <>
                    <Text style={styles.modalLabel}>Your counter (₹ per unit)</Text>
                    <TextInput
                      style={styles.modalInput}
                      keyboardType="numeric"
                      placeholder={`Lower than ₹${myNegotiationResponse.cropPrice}`}
                      placeholderTextColor={C.textMuted}
                      value={buyerCounterInput}
                      onChangeText={setBuyerCounterInput}
                    />
                    <View style={styles.modalActionsRow}>
                      <TouchableOpacity
                        style={[styles.modalSecondaryBtn, { flex: 1 }]}
                        onPress={() => setBuyerCounterMode(false)}
                      >
                        <Text style={styles.modalSecondaryBtnText}>Back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalPrimaryBtn, { flex: 1 }]}
                        onPress={submitBuyerCounter}
                        disabled={!buyerCounterInput.trim() || buyerSubmitting}
                      >
                        {buyerSubmitting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.modalPrimaryBtnText}>Send Counter</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* -------------------- FARMER RESPOND MODAL -------------------- */}
      <Modal
        visible={farmerModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFarmerModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>
                {selectedNegotiation?.buyer?.username || "Buyer"}'s Offer
              </Text>
              <TouchableOpacity onPress={() => setFarmerModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={C.textMuted} />
              </TouchableOpacity>
            </View>

            {selectedNegotiation && (
              <>
                <View style={styles.negoSummaryRow}>
                  <Text style={styles.negoSummaryLabel}>Buyer's offer</Text>
                  <Text style={styles.negoSummaryValue}>₹{selectedNegotiation.cropPrice}</Text>
                </View>

                {selectedNegotiation.response && (
                  <View style={styles.negoSummaryRow}>
                    <Text style={styles.negoSummaryLabel}>Your counter</Text>
                    <Text style={[styles.negoSummaryValue, { color: C.amber }]}>
                      ₹{selectedNegotiation.response.cropPrice}
                    </Text>
                  </View>
                )}

                <View style={styles.modalActionsRow}>
                  <TouchableOpacity
                    style={[styles.modalPrimaryBtn, { flex: 1 }]}
                    onPress={() => acceptAsFarmer(selectedNegotiation)}
                    disabled={farmerSubmitting}
                  >
                    {farmerSubmitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.modalPrimaryBtnText}>
                        Accept ₹{selectedNegotiation.response?.cropPrice ?? selectedNegotiation.cropPrice}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                <Text style={[styles.modalLabel, { marginTop: 14 }]}>
                  {selectedNegotiation.response ? "Update your counter (₹ per unit)" : "Send a counter offer (₹ per unit)"}
                </Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  placeholder={`Higher than ₹${selectedNegotiation.response?.cropPrice ?? selectedNegotiation.cropPrice}`}
                  placeholderTextColor={C.textMuted}
                  value={farmerPriceInput}
                  onChangeText={setFarmerPriceInput}
                />
                <TouchableOpacity
                  style={[styles.modalSecondaryBtn, !farmerPriceInput.trim() && styles.footerBtnDisabled]}
                  onPress={submitFarmerCounter}
                  disabled={!farmerPriceInput.trim() || farmerSubmitting}
                >
                  {farmerSubmitting ? (
                    <ActivityIndicator size="small" color={C.primary} />
                  ) : (
                    <Text style={styles.modalSecondaryBtnText}>
                      {selectedNegotiation.response ? "Update Counter" : "Send Counter"}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* -------------------- PROFILE POPUP -------------------- */}
      <Modal
        visible={profileModalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeProfileModal}
      >
        <TouchableOpacity
          style={styles.profileBackdrop}
          activeOpacity={1}
          onPress={closeProfileModal}
        >
          <TouchableOpacity activeOpacity={1} style={styles.profileCard} onPress={() => {}}>
            <TouchableOpacity
              style={styles.profileCloseBtn}
              onPress={closeProfileModal}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={C.textMuted} />
            </TouchableOpacity>

            {profileModalLoading ? (
              <ActivityIndicator color={C.primary} style={{ marginVertical: 30 }} />
            ) : profileModalError || !profileModalUser ? (
              <Text style={styles.profileErrorText}>
                {profileModalError || "Profile not available."}
              </Text>
            ) : (
              <>
                {profileModalUser.profileUrl ? (
                  <Image
                    source={{ uri: profileModalUser.profileUrl }}
                    style={styles.profileAvatarLarge}
                  />
                ) : (
                  <View style={[styles.profileAvatarLarge, styles.profileAvatarLargeFallback]}>
                    <Ionicons name="person" size={34} color={C.primary} />
                  </View>
                )}

                <Text style={styles.profileName} numberOfLines={1}>
                  {profileModalUser.username || "Unknown user"}
                </Text>

                <View style={styles.profileRatingRow}>
                  <Ionicons name="star" size={13} color="#f5a623" />
                  <Text style={styles.profileRatingText}>
                    {(profileModalUser.totalRating ?? 0).toFixed(1)} ({profileModalUser.count ?? 0} ratings)
                  </Text>
                </View>

                <View style={styles.profileStatsRow}>
                  <View style={styles.profileStatItem}>
                    <Text style={styles.profileStatValue}>{profileModalUser.favouriteCount ?? 0}</Text>
                    <Text style={styles.profileStatLabel}>Likes</Text>
                  </View>
                  <View style={styles.profileStatDivider} />
                  <View style={styles.profileStatItem}>
                    <Text style={styles.profileStatValue}>
                      {(profileModalUser.totalRating ?? 0).toFixed(1)}
                    </Text>
                    <Text style={styles.profileStatLabel}>Avg rating</Text>
                  </View>
                  <View style={styles.profileStatDivider} />
                  <View style={styles.profileStatItem}>
                    <Text style={styles.profileStatValue}>{profileModalUser.count ?? 0}</Text>
                    <Text style={styles.profileStatLabel}>Reviewers</Text>
                  </View>
                </View>

                <View style={styles.profileContactBlock}>
                  {profileModalUser.email ? (
                    <View style={styles.profileContactRow}>
                      <Ionicons name="mail-outline" size={14} color={C.textMuted} />
                      <Text style={styles.profileContactText} numberOfLines={1}>
                        {profileModalUser.email}
                      </Text>
                    </View>
                  ) : null}
                  {profileModalUser.phoneNumber ? (
                    <View style={styles.profileContactRow}>
                      <Ionicons name="call-outline" size={14} color={C.textMuted} />
                      <Text style={styles.profileContactText}>{profileModalUser.phoneNumber}</Text>
                    </View>
                  ) : null}
                </View>

                {profileModalUser.phoneNumber ? (
                  <TouchableOpacity
                    style={styles.profileCallBtn}
                    onPress={() => handleCallNumber(profileModalUser.phoneNumber)}
                  >
                    <Ionicons name="call" size={16} color="#fff" />
                    <Text style={styles.profileCallBtnText}>Call</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cropTitle: { fontSize: 18, fontWeight: "700", color: C.text, marginBottom: 6 },
  categoryChip: {
    alignSelf: "flex-start",
    backgroundColor: C.chipBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  categoryChipText: { fontSize: 11, fontWeight: "600", color: C.primary },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  dealHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  dealBuyerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  dealContactText: { fontSize: 12, color: C.textMuted, marginTop: 1 },
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
  profileTapArea: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  profileTapAreaRow: { flex: 1, flexDirection: "row", alignItems: "center" },
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
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.card,
  },
  footerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.primary,
    paddingVertical: 13,
    borderRadius: 14,
  },
  footerBtnSecondary: {
    flex: 0.9,
    backgroundColor: C.chipBg,
  },
  footerBtnDisabled: { backgroundColor: C.textMuted },
  footerBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  footerBtnTextSecondary: { color: C.primary, fontSize: 14, fontWeight: "600" },

  // Negotiation status card (buyer)
  negoStatusRow: { flexDirection: "row", alignItems: "center" },
  negoStatusText: { fontSize: 12, color: C.text },

  // Negotiation list row (farmer)
  negoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  negoBuyerName: { fontSize: 13, fontWeight: "600", color: C.text },
  negoStatusTextSmall: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  negoPill: {
    backgroundColor: C.chipBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  negoPillText: { fontSize: 12, fontWeight: "700", color: C.primary },
  loadMoreBtn: { alignItems: "center", paddingVertical: 10 },
  loadMoreText: { fontSize: 12, fontWeight: "600", color: C.primary },

  // Modals
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: C.text, flex: 1 },
  modalListedPrice: { fontSize: 12, color: C.textMuted, marginBottom: 16 },
  modalLabel: { fontSize: 12, color: C.textMuted, marginBottom: 6 },
  modalInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.text,
    marginBottom: 14,
  },
  modalPrimaryBtn: {
    backgroundColor: C.primary,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  modalSecondaryBtn: {
    backgroundColor: C.chipBg,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryBtnText: { color: C.primary, fontSize: 14, fontWeight: "700" },
  modalActionsRow: { flexDirection: "row", gap: 10, marginTop: 4, marginBottom: 4 },
  negoSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  negoSummaryLabel: { fontSize: 13, color: C.textMuted },
  negoSummaryValue: { fontSize: 15, fontWeight: "700", color: C.text },
  waitingText: {
    fontSize: 12,
    color: C.amber,
    backgroundColor: C.amberBg,
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 10,
    textAlign: "center",
  },

  // Profile popup (tap any farmer/buyer avatar or name)
  profileBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 32,
  },
  profileCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
  },
  profileCloseBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 6,
    zIndex: 1,
  },
  profileAvatarLarge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    marginTop: 4,
    marginBottom: 10,
  },
  profileAvatarLargeFallback: {
    backgroundColor: C.chipBg,
    justifyContent: "center",
    alignItems: "center",
  },
  profileName: { fontSize: 17, fontWeight: "700", color: C.text, textAlign: "center" },
  profileRatingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  profileRatingText: { fontSize: 12, color: C.textMuted },
  profileStatsRow: {
    flexDirection: "row",
    width: "100%",
    marginTop: 16,
    marginBottom: 4,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 14,
  },
  profileStatItem: { flex: 1, alignItems: "center" },
  profileStatValue: { fontSize: 15, fontWeight: "700", color: C.text },
  profileStatLabel: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  profileStatDivider: { width: 1, backgroundColor: C.border },
  profileContactBlock: { width: "100%", marginTop: 14, gap: 8 },
  profileContactRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  profileContactText: { fontSize: 12, color: C.textMuted, flex: 1 },
  profileCallBtn: {
    marginTop: 16,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.primary,
    paddingVertical: 12,
    borderRadius: 14,
  },
  profileCallBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  profileErrorText: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: "center",
    marginVertical: 20,
  },
});