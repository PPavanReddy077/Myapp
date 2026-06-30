import React, { useState } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  StatusBar,
  ActivityIndicator,
  RefreshControl, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useHomeData } from "../../_services/useHomeData";
import { Category, FreshProduct, NearbyFarmer, MarketPrice, timeAgo } from "../../_services/homeApi";


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
  save: "#c67c00",
};

const WHY_US = [
  { id: "1", icon: "leaf-outline", label: "Fresh at source" },
  { id: "2", icon: "cash-outline", label: "Zero middleman" },
  { id: "3", icon: "car-outline", label: "Bulk delivery" },
  { id: "4", icon: "shield-checkmark-outline", label: "Verified farmers" },
];

function CategoryItem({
  item,
  active,
  onPress,
}: {
  item: Category;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.catItem} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.catCircle, active && styles.catCircleActive]}>
        <Text style={styles.catEmoji}>{item.emoji ?? "🌿"}</Text>
      </View>
      <Text style={[styles.catLabel, active && styles.catLabelActive]}>
        {item.categoryName}
      </Text>
    </TouchableOpacity>
  );
}

function ProductCard({ item }: { item: FreshProduct }) {
  const router = useRouter();
  const ago = timeAgo(item.createdAt);

  return (
    <TouchableOpacity
      style={styles.prodCard}
      activeOpacity={0.75}
      onPress={() =>
        router.push({
          pathname: "/tabs/FarmersBySubCategory",
          params: {
            subCategoryId: String(item.subCategoryId),  // field from your FreshProduct interface
            cropName: item.itemName,
          },
        })
      }
    >
      {/* Image */}
      <View style={styles.prodImgBox}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.prodImg}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.prodEmoji}>🌿</Text>
        )}
        {item.categoryName ? (
          <View style={styles.catChip}>
            <Text style={styles.catChipText} numberOfLines={1}>
              {item.categoryName}
            </Text>
          </View>
        ) : null}
        {ago ? (
          <View style={styles.timePill}>
            <Ionicons name="time-outline" size={9} color="#fff" />
            <Text style={styles.timePillText}>{ago}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.prodName} numberOfLines={1}>{item.itemName}</Text>

      <View style={styles.viewHint}>
        <Text style={styles.viewHintText}>View details</Text>
        <Ionicons name="chevron-forward" size={10} color={C.primary} />
      </View>
    </TouchableOpacity>
  );
}

function FarmerCard({ item }: { item: NearbyFarmer }) {
  return (
    <View style={styles.farmerCard}>
      <Text style={styles.farmerEmoji}>👨‍🌾</Text>
      <View style={styles.farmerInfo}>
        <Text style={styles.farmerName}>{item.farmerName}</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Ionicons key={i} name="star" size={11} color={C.accent} />
          ))}
        </View>
        <Text style={styles.farmerType}>{item.totalCrops} crops listed</Text>
        <Text style={styles.farmerType}>Since {item.memberSince}</Text>
      </View>
      <TouchableOpacity style={styles.viewFarmBtn} activeOpacity={0.8}>
        <Text style={styles.viewFarmText}>View Farm</Text>
      </TouchableOpacity>
    </View>
  );
}

function MarketRow({ item }: { item: MarketPrice }) {
  const save = item.marketPrice - item.farmerPrice;
  return (
    <View style={styles.marketRow}>
      <Text style={styles.marketEmoji}>{item.emoji}</Text>
      <Text style={styles.marketName}>{item.cropName}</Text>
      <View style={styles.marketPrices}>
        <Text style={styles.farmerPrice}>₹{item.farmerPrice}/kg</Text>
        <Text style={styles.marketMrp}>Market ₹{item.marketPrice}</Text>
      </View>
      <View style={styles.saveBadge}>
        <Text style={styles.saveText}>Save ₹{save}</Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);

  const {
    greeting,
    categories = [],
    freshProducts = [],
    farmers = [],
    marketPrices = [],
    cartCount = 0,
    loading,
    error,
    refetch,
    fetchByCategory,
    loadMoreProducts,
    productsLoadingMore,
    productsHasMore,
  } = useHomeData();

  const handleCategoryPress = (cat: Category) => {
    setActiveCategoryId(cat.Id);
    fetchByCategory(cat.Id);
  };

  if (loading && !greeting) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={styles.loadingText}>Loading fresh produce…</Text>
      </SafeAreaView>
    );
  }

  if (error && !greeting) {
    return (
      <SafeAreaView style={styles.centered}>
        <Ionicons name="cloud-offline-outline" size={48} color={C.textMuted} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={refetch}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.card} />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greetSub}>
            {greeting?.message || "Good Morning"}, ☀
          </Text>
          <Text style={styles.greetMain}>
            What are you{"\n"}looking for today?
          </Text>
          {greeting?.deliveryLocation ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color={C.textMuted} />
              <Text style={styles.locationText}>{greeting.deliveryLocation}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.7}
            onPress={() => router.push("/tabs/Cart")}
            accessibilityLabel="Cart"
          >
            <Ionicons name="cart-outline" size={22} color="#333" />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>
                  {cartCount > 99 ? "99+" : cartCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.7}
            onPress={() => router.push("/tabs/Notifications")}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={22} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#aaa" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search vegetables, fruits, grains..."
          placeholderTextColor="#aaa"
        />
        <Ionicons name="options-outline" size={18} color={C.primary} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refetch}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
      >
        {categories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catList}
          >
            {categories.map((item) => (
              <CategoryItem
                key={String(item.Id)}
                item={item}
                active={activeCategoryId === item.Id}
                onPress={() => handleCategoryPress(item)}
              />
            ))}
          </ScrollView>
        )}

        <View style={styles.banner}>
          <View style={{ flex: 1 }}>
            <View style={styles.bannerTag}>
              <Text style={styles.bannerTagText}>No Middleman</Text>
            </View>
            <Text style={styles.bannerH}>Eat Fresh,{"\n"}Eat Healthy</Text>
            <Text style={styles.bannerSub}>
              Handpicked produce{"\n"}from trusted farmers
            </Text>
            {/* <TouchableOpacity style={styles.shopBtn} activeOpacity={0.8}>
              <Text style={styles.shopBtnText}>Shop Now</Text>
            </TouchableOpacity> */}
          </View>
          <Text style={styles.bannerArt}>🧺</Text>
        </View>

        <View style={styles.whyStrip}>
          <Text style={styles.whyTitle}>Why buy direct from farmers?</Text>
          <View style={styles.whyRow}>
            {WHY_US.map((w) => (
              <View key={w.id} style={styles.whyCard}>
                <View style={styles.whyIconBox}>
                  <Ionicons name={w.icon as any} size={20} color={C.primary} />
                </View>
                <Text style={styles.whyLabel}>{w.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Fresh Today</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        {freshProducts.length > 0 ? (
          <FlatList
            data={freshProducts}
            keyExtractor={(i) => String(i.cropDetailId)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hList}
            renderItem={({ item }) => <ProductCard item={item} />}
            onEndReached={() => {
              if (productsHasMore && !productsLoadingMore) loadMoreProducts();
            }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              productsLoadingMore ? (
                <View style={styles.prodLoadMore}>
                  <ActivityIndicator size="small" color={C.primary} />
                </View>
              ) : null
            }
          />
        ) : (
          <Text style={styles.emptyText}>No products available today.</Text>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nearby Farmers</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        {farmers.length > 0 ? (
          <FlatList
            data={farmers}
            keyExtractor={(i) => String(i.farmerId)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hList}
            renderItem={({ item }) => <FarmerCard item={item} />}
          />
        ) : (
          <Text style={styles.emptyText}>No farmers found nearby.</Text>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Market Price</Text>
          <Text style={[styles.seeAll, { color: C.textMuted, fontSize: 11 }]}>
            Live
          </Text>
        </View>
        {Array.isArray(marketPrices) && marketPrices.length > 0 && (
          <View style={styles.marketCard}>
            {(marketPrices ?? []).map((item, idx) => (
              <View key={item.subCategoryId}>
                <MarketRow item={item} />
                {idx < marketPrices.length - 1 && (
                  <View style={styles.marketDivider} />
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.bulkCard}>
          <View style={styles.bulkIconBox}>
            <Text style={{ fontSize: 26 }}>🚛</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bulkTitle}>Need 100 kg Tomatoes?</Text>
            <Text style={styles.bulkSub}>
              Get best farmer price directly.{"\n"}Request a quote in minutes.
            </Text>
            <TouchableOpacity
              style={styles.bulkBtn}
              activeOpacity={0.8}
              onPress={() => router.push("/tabs/RequestQuote")}
            >
              <Text style={styles.bulkBtnText}>Request Quote</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/tabs/home")}
          accessibilityLabel="Home"
        >
          <Ionicons name="home" size={24} color={C.primary} />
          <Text style={[styles.navLabel, { color: C.primary }]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/tabs/Orders")}
          accessibilityLabel="Orders"
        >
          <Ionicons name="cube-outline" size={24} color="#ccc" />
          <Text style={styles.navLabel}>Orders</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItemCenter}
          onPress={() => router.push("/tabs/addCrop")}
          accessibilityLabel="Add Crop"
          activeOpacity={0.85}
        >
          <View style={styles.addCropBtn}>
            <Ionicons name="add" size={28} color="#fff" />
          </View>
          <Text style={[styles.navLabel, { color: C.primary, marginTop: 2 }]}>
            Add Crop
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/tabs/Wishlist")}
          accessibilityLabel="Wishlist"
        >
          <Ionicons name="heart-outline" size={24} color="#ccc" />
          <Text style={styles.navLabel}>Wishlist</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/tabs/Profile")}
          accessibilityLabel="Profile"
        >
          <Ionicons name="person-outline" size={24} color="#ccc" />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.card },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: C.card },
  loadingText: { fontSize: 14, color: C.textMuted, marginTop: 8 },
  errorText: { fontSize: 14, color: C.textSub, textAlign: "center", marginHorizontal: 32, marginTop: 8 },
  retryBtn: {
    marginTop: 8, backgroundColor: C.primary,
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10,
  },
  retryText: { color: "#fff", fontSize: 14, fontWeight: "500" },

  header: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", paddingHorizontal: 18,
    paddingTop: 12, paddingBottom: 8, backgroundColor: C.card,
  },
  greetSub: { fontSize: 13, color: C.textSub },
  greetMain: { fontSize: 22, fontWeight: "500", color: C.text, marginTop: 2, lineHeight: 28 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
  locationText: { fontSize: 11, color: C.textMuted },
  headerIcons: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 4 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1.5, borderColor: "#e8e8e8",
    backgroundColor: C.card, justifyContent: "center", alignItems: "center",
    position: "relative",
  },
  cartBadge: {
    position: "absolute", top: -4, right: -4,
    backgroundColor: C.accent, minWidth: 18, height: 18,
    borderRadius: 9, justifyContent: "center", alignItems: "center",
    paddingHorizontal: 3,
  },
  cartBadgeText: { color: "#fff", fontSize: 10, fontWeight: "600" },

  searchBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#f5f5f5", borderRadius: 14,
    marginHorizontal: 18, marginBottom: 14,
    paddingHorizontal: 14, height: 44, gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#333" },

  scroll: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 8 },

  catList: { paddingHorizontal: 18, paddingVertical: 4, gap: 4 },
  catItem: { alignItems: "center", width: 72, gap: 5 },
  catCircle: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: "#f0f8f0", borderWidth: 2, borderColor: "#e0f0e0",
    justifyContent: "center", alignItems: "center",
  },
  catCircleActive: { backgroundColor: C.primary, borderColor: C.primary },
  catEmoji: { fontSize: 26 },
  catLabel: { fontSize: 10, color: "#555", textAlign: "center", lineHeight: 13 },
  catLabelActive: { color: C.primary, fontWeight: "500" },
  banner: {
    marginHorizontal: 18, marginVertical: 14,
    backgroundColor: C.primaryLight, borderRadius: 20, padding: 18,
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", minHeight: 140,
  },
  bannerTag: {
    backgroundColor: C.primaryMid, paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 20, alignSelf: "flex-start", marginBottom: 8,
  },
  bannerTagText: { fontSize: 11, fontWeight: "500", color: C.primary },
  bannerH: { fontSize: 20, fontWeight: "500", color: "#1b5e20", lineHeight: 26, marginBottom: 4 },
  bannerSub: { fontSize: 11, color: "#4a7c59", lineHeight: 16, marginBottom: 12 },
  shopBtn: {
    backgroundColor: C.primary, borderRadius: 10,
    paddingHorizontal: 18, paddingVertical: 9, alignSelf: "flex-start",
  },
  shopBtnText: { color: "#fff", fontSize: 13, fontWeight: "500" },
  bannerArt: { fontSize: 70 },

  whyStrip: {
    marginHorizontal: 18, marginBottom: 8,
    backgroundColor: "#fafff8", borderRadius: 16,
    borderWidth: 1, borderColor: "#e0f0e0", padding: 14,
  },
  whyTitle: { fontSize: 13, fontWeight: "500", color: "#1b5e20", marginBottom: 10 },
  whyRow: { flexDirection: "row", justifyContent: "space-between" },
  whyCard: { flex: 1, alignItems: "center", gap: 5 },
  whyIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.primaryLight, justifyContent: "center", alignItems: "center",
  },
  whyLabel: { fontSize: 10, color: "#555", textAlign: "center", lineHeight: 13 },

  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: "500", color: C.text },
  seeAll: { fontSize: 13, color: C.primary, fontWeight: "500" },
  emptyText: { fontSize: 12, color: C.textMuted, paddingHorizontal: 18, marginBottom: 12 },

  hList: { paddingHorizontal: 18, gap: 12 },
  prodLoadMore: {
    width: 50,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },

  prodCard: {
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, padding: 10, width: 148,
  },
  prodImgBox: {
    width: "100%", height: 110, backgroundColor: "#f7fdf7",
    borderRadius: 12, justifyContent: "center", alignItems: "center",
    marginBottom: 8, position: "relative", overflow: "hidden",
  },
  prodEmoji: { fontSize: 46 },
  prodImg: { width: "100%", height: "100%", borderRadius: 12 },

  catChip: {
    position: "absolute", top: 6, left: 6,
    backgroundColor: "rgba(58,125,68,0.85)",
    borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2,
    maxWidth: 90,
  },
  catChipText: { color: "#fff", fontSize: 9, fontWeight: "600" },

  timePill: {
    position: "absolute", bottom: 6, right: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2,
    flexDirection: "row", alignItems: "center", gap: 3,
  },
  timePillText: { color: "#fff", fontSize: 9, fontWeight: "500" },

  prodName: { fontSize: 13, fontWeight: "600", color: C.text, marginBottom: 3 },
  prodPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 1, marginBottom: 4 },
  prodPrice: { fontSize: 14, fontWeight: "700", color: C.primary },
  prodUnit: { fontSize: 11, color: C.textMuted },

  viewHint: {
    flexDirection: "row", alignItems: "center", gap: 2,
  },
  viewHintText: { fontSize: 10, color: C.primary, fontWeight: "500" },

  starsRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  ratingText: { fontSize: 11, color: C.textMuted },

  prodFarmer: { fontSize: 11, color: C.textMuted, marginBottom: 4 },
  prodMrp: { fontSize: 10, color: C.textMuted, textDecorationLine: "line-through" },
  availQty: { fontSize: 10, color: C.primary, marginTop: 3, fontWeight: "500" },
  organicBadge: {
    position: "absolute", top: 6, left: 6,
    backgroundColor: C.primary, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2,
  },
  organicText: { color: "#fff", fontSize: 9, fontWeight: "500" },
  savePill: {
    position: "absolute", bottom: 6, right: 6,
    backgroundColor: C.accentLight, borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2,
  },
  savePillText: { fontSize: 9, fontWeight: "500", color: C.save },

  farmerCard: {
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    padding: 14, width: 220,
    flexDirection: "row", alignItems: "flex-start", gap: 12,
  },
  farmerEmoji: { fontSize: 28, marginTop: 2 },
  farmerInfo: { flex: 1 },
  farmerName: { fontSize: 14, fontWeight: "500", color: C.text },
  farmerType: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  farmerDistRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  farmerDist: { fontSize: 11, color: C.textMuted },
  viewFarmBtn: {
    backgroundColor: C.primary, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7, marginTop: 8,
  },
  viewFarmText: { color: "#fff", fontSize: 12, fontWeight: "500" },

  marketCard: {
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    marginHorizontal: 18, overflow: "hidden",
  },
  marketRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 11, paddingHorizontal: 14, gap: 8,
  },
  marketDivider: { height: 1, backgroundColor: "#f5f5f5", marginHorizontal: 14 },
  marketEmoji: { fontSize: 22, minWidth: 30 },
  marketName: { fontSize: 13, fontWeight: "500", color: C.text, flex: 1 },
  marketPrices: { alignItems: "flex-end", marginRight: 8 },
  farmerPrice: { fontSize: 13, fontWeight: "500", color: C.primary },
  marketMrp: { fontSize: 10, color: C.textMuted, textDecorationLine: "line-through" },
  saveBadge: {
    backgroundColor: C.accentLight, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  saveText: { fontSize: 10, fontWeight: "500", color: C.save },

  bulkCard: {
    marginHorizontal: 18, marginTop: 14,
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    padding: 16, flexDirection: "row", alignItems: "center", gap: 12,
  },
  bulkIconBox: {
    width: 52, height: 52, backgroundColor: C.primaryLight,
    borderRadius: 14, justifyContent: "center", alignItems: "center",
  },
  bulkTitle: { fontSize: 13, fontWeight: "500", color: C.text, marginBottom: 3 },
  bulkSub: { fontSize: 11, color: C.textSub, lineHeight: 16, marginBottom: 8 },
  bulkBtn: {
    backgroundColor: C.accent, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 8, alignSelf: "flex-start",
  },
  bulkBtnText: { color: "#fff", fontSize: 12, fontWeight: "500" },

  bottomNav: {
    flexDirection: "row", backgroundColor: C.card,
    borderTopWidth: 1, borderTopColor: "#f0f0f0",
    height: 68, paddingHorizontal: 8,
    alignItems: "flex-end", paddingBottom: 10,
  },
  navItem: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingBottom: 2,
  },
  navLabel: { fontSize: 10, color: "#ccc" },
  navItemCenter: { flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 2 },
  addCropBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.primary,
    justifyContent: "center", alignItems: "center",
    marginBottom: 1,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
});