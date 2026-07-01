import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Switch,
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
import { jwtDecode } from "jwt-decode";

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

function formatMemberSince(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function formatPhone(phone: number): string {
  const s = String(phone);
  if (s.length === 10) return `+91 ${s.slice(0, 5)} ${s.slice(5)}`;
  return `+91 ${s}`;
}

function Avatar({ name, uri }: { name: string; uri?: string | null }) {
  const initials = name
    .trim()
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return uri ? (
    <Image source={{ uri }} style={styles.avatar} />
  ) : (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarInitials}>{initials}</Text>
    </View>
  );
}

function StatPill({
  icon,
  value,
  label,
  onPress,
}: {
  icon: string;
  value: string | number;
  label: string;
  onPress?: () => void;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={styles.statPill} onPress={onPress} activeOpacity={0.6}>
      <Ionicons name={icon as any} size={16} color={C.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Wrapper>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function MenuRow({
  icon,
  label,
  sublabel,
  onPress,
  danger = false,
  right,
}: {
  icon: string;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <TouchableOpacity style={styles.menuRow} activeOpacity={0.65} onPress={onPress}>
      <View style={[styles.menuIconBox, danger && styles.menuIconBoxDanger]}>
        <Ionicons name={icon as any} size={19} color={danger ? C.danger : C.primary} />
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, danger && { color: C.danger }]}>{label}</Text>
        {sublabel ? <Text style={styles.menuSublabel}>{sublabel}</Text> : null}
      </View>
      {right ?? <Ionicons name="chevron-forward" size={16} color={C.textMuted} />}
    </TouchableOpacity>
  );
}

function Divider() {
  return <View style={styles.divider} />;
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

function ProfileSkeleton() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.identityCard, { gap: 16 }]}>
        <View style={[styles.avatarFallback, { backgroundColor: "#e0e0e0" }]} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBlock w="60%" h={16} radius={6} />
          <SkeletonBlock w="40%" h={12} radius={6} />
          <SkeletonBlock w="50%" h={20} radius={20} />
        </View>
      </View>
      <View style={[styles.statsRow, { justifyContent: "space-evenly" }]}>
        <SkeletonBlock w={60} h={40} radius={8} />
        <SkeletonBlock w={60} h={40} radius={8} />
      </View>
      <View style={[styles.contactCard, { paddingVertical: 14, gap: 12 }]}>
        <SkeletonBlock w="70%" h={14} radius={6} />
        <SkeletonBlock w="80%" h={14} radius={6} />
      </View>
      <View style={{ height: 40 }} />
      <ActivityIndicator color={C.primary} size="small" />
    </ScrollView>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [likesPage0, setLikesPage0] = useState<LikeEntry[]>([]);
  const [totalLikes, setTotalLikes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cropCount, setCropCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setError(null);
    const token = await getToken();
    if (!token) {
      router.replace("/auth/login");
      return;
    }
    const { userId } = jwtDecode<JwtPayload>(token);
    try {
      const [userRes, likesRes, cropRes] = await Promise.allSettled([
        api.post(`/user/getUser?id=${userId}`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        api.get(`/like/getLikes?farmerId=${userId}&page=0&size=10`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        api.get(`/crop/getByFarmer?farmerId=${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (userRes.status === "fulfilled") {
        setUser(userRes.value.data);
      } else {
        console.error("getUser failed:", userRes.reason);
        setError("Failed to load profile.");
      }

      if (likesRes.status === "fulfilled") {
        const page: LikesPage = likesRes.value.data;
        setLikesPage0(page.content ?? []);
        setTotalLikes(page.totalElements ?? 0);
      } else {
        setLikesPage0([]);
        setTotalLikes(0);
      }

      if (cropRes.status === "fulfilled") {
        setCropCount(cropRes.value.data.count ?? 0);
      } else {
        setCropCount(0);
      }
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const handleLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => router.replace("/auth/login"),
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.card} />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>
        </View>
        <ProfileSkeleton />
      </SafeAreaView>
    );
  }

  if (error && !user) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.card} />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={C.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchProfile}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.card} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => router.push("/tabs/EditProfile")}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil-outline" size={14} color={C.primary} />
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[C.primary]}
            tintColor={C.primary}
          />
        }
      >
        <View style={styles.identityCard}>
          <Avatar name={user?.username ?? "?"} uri={user?.profileUrl} />
          <View style={styles.identityInfo}>
            <Text style={styles.userName}>{user?.username}</Text>
            <View style={styles.memberBadge}>
              <Ionicons name="leaf-outline" size={10} color={C.primary} />
              <Text style={styles.memberBadgeText}>
                Member since {user?.createdAt ? formatMemberSince(user.createdAt) : "—"}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.statsRow}>
          <StatPill icon="heart" value={totalLikes} label="Followers" />
          <View style={styles.statDivider} />
          <StatPill
            icon="leaf-outline"
            value={cropCount}
            label="Crops Listed"
            onPress={() =>
              router.push({
                pathname: "/tabs/MyCrops",
                params: { farmerId: String(user?.id ?? "") },
              })
            }
          />
        </View>
        <View style={styles.contactCard}>
          <View style={styles.contactRow}>
            <Ionicons name="mail-outline" size={16} color={C.primary} />
            <Text style={styles.contactText}>{user?.email}</Text>
          </View>
          <Divider />
          <View style={styles.contactRow}>
            <Ionicons name="call-outline" size={16} color={C.primary} />
            <Text style={styles.contactText}>
              {user?.phoneNumber ? formatPhone(user.phoneNumber) : "—"}
            </Text>
          </View>
        </View>

        <SectionHeader title="Orders & Purchases" />
        <View style={styles.card}>
          <MenuRow
            icon="receipt-outline"
            label="My Orders"
            sublabel="Track, return or reorder"
            onPress={() => router.push("/tabs/Orders")}
          />
          <Divider />
          <MenuRow
            icon="heart-outline"
            label="Wishlist"
            sublabel="Items you saved for later"
            onPress={() => router.push("/tabs/Wishlist")}
          />
          <Divider />
          <MenuRow
            icon="cart-outline"
            label="Cart"
            onPress={() => router.push("/tabs/Cart")}
          />
        </View>

        <SectionHeader title="My Farm Connection" />
        <View style={styles.card}>
          <MenuRow
            icon="people-outline"
            label="Favourite Farmers"
            sublabel={
              totalLikes > 0
                ? `${totalLikes} buyer${totalLikes > 1 ? "s" : ""} follow your farm`
                : "No followers yet"
            }
            onPress={() =>
              router.push({
                pathname: "/tabs/FavouriteFarmers",
                params: {
                  initialLikes: JSON.stringify(likesPage0),
                  totalElements: String(totalLikes),
                },
              })
            }
          />
          <Divider />
          <MenuRow
            icon="star-outline"
            label="My Reviews"
            sublabel="Ratings you've given"
            onPress={() => router.push("/tabs/MyReviews")}
          />
          <Divider />
          <MenuRow
            icon="document-text-outline"
            label="Bulk Quote Requests"
            onPress={() => router.push("/tabs/RequestQuote")}
          />
        </View>

        <SectionHeader title="Delivery" />
        <View style={styles.card}>
          <MenuRow
            icon="location-outline"
            label="Saved Addresses"
            sublabel="Home, Work and more"
            onPress={() => router.push("/tabs/Addresses")}
          />
        </View>

        <SectionHeader title="Settings" />
        <View style={styles.card}>
          <MenuRow
            icon="notifications-outline"
            label="Push Notifications"
            right={
              <Switch
                value={notificationsOn}
                onValueChange={setNotificationsOn}
                trackColor={{ false: "#ddd", true: C.primaryMid }}
                thumbColor={notificationsOn ? C.primary : "#aaa"}
              />
            }
          />
          <Divider />
          <MenuRow
            icon="lock-closed-outline"
            label="Change Password"
            onPress={() => router.push("/tabs/ChangePassword")}
          />
          <Divider />
          <MenuRow
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => router.push("/tabs/Privacy")}
          />
          <Divider />
          <MenuRow
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() => router.push("/tabs/Support")}
          />
        </View>

        <View style={[styles.card, { marginTop: 10 }]}>
          <MenuRow
            icon="log-out-outline"
            label="Log Out"
            danger
            onPress={handleLogout}
          />
        </View>

        <Text style={styles.versionText}>MyAnnadatha v1.0.0</Text>
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

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
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.primary,
  },
  editBtnText: { fontSize: 13, color: C.primary, fontWeight: "500" },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 8 },

  identityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: C.card,
    marginHorizontal: 18,
    marginTop: 18,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  avatar: { width: 68, height: 68, borderRadius: 34 },
  avatarFallback: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: C.primaryMid,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: { fontSize: 24, fontWeight: "700", color: C.primary },
  identityInfo: { flex: 1, gap: 6 },
  userName: { fontSize: 18, fontWeight: "600", color: C.text },
  memberBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: C.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  memberBadgeText: { fontSize: 10, color: C.primary, fontWeight: "500" },

  statsRow: {
    flexDirection: "row",
    backgroundColor: C.card,
    marginHorizontal: 18,
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  statPill: { flex: 1, alignItems: "center", gap: 3 },
  statDivider: { width: 1, height: 36, backgroundColor: C.border },
  statValue: { fontSize: 16, fontWeight: "700", color: C.text },
  statLabel: { fontSize: 10, color: C.textMuted },

  contactCard: {
    backgroundColor: C.card,
    marginHorizontal: 18,
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 13,
  },
  contactText: { fontSize: 13, color: C.textSub },

  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textMuted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginHorizontal: 18,
    marginTop: 22,
    marginBottom: 6,
  },

  card: {
    backgroundColor: C.card,
    marginHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
  },

  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  menuIconBoxDanger: { backgroundColor: C.dangerLight },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 14, color: C.text, fontWeight: "500" },
  menuSublabel: { fontSize: 11, color: C.textMuted, marginTop: 1 },

  divider: { height: 1, backgroundColor: C.border },

  versionText: {
    textAlign: "center",
    fontSize: 11,
    color: C.textMuted,
    marginTop: 20,
  },

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