import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import DateTimePicker from "@react-native-community/datetimepicker";
import api from "../../_services/api";
import { getToken } from "../../_services/storage";

const C = {
  primary: "#3a7d44",
  primaryLight: "#e8f5e0",
  primaryMid: "#c8e6c9",
  accent: "#FF9800",
  bg: "#F5F8F2",
  card: "#ffffff",
  border: "#efefef",
  text: "#111111",
  textSub: "#666666",
  textMuted: "#999999",
  danger: "#d32f2f",
};

function formatDateForApi(date: Date): string {
  // java.sql.Date expects yyyy-MM-dd
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Turns a reverse-geocoded address into a short human readable place name
// e.g. "Madhapur, Hyderabad, Telangana" instead of raw coordinates.
function formatPlaceName(addr: Location.LocationGeocodedAddress): string {
  const parts = [
    addr.name && addr.name !== addr.street ? addr.name : null,
    addr.district || addr.subregion,
    addr.city,
    addr.region,
  ].filter((p): p is string => !!p && p.trim().length > 0);

  // De-dupe consecutive identical parts (city/subregion often collide)
  const deduped = parts.filter((p, i) => parts.indexOf(p) === i);
  return deduped.join(", ");
}

interface Category {
  Id: number;
  categoryName: string;
  emoji: string;
}

interface SubCategory {
  Id: number;
  itemName: string;
  categories: { Id: number };
  units: { Id: number; unit: string };
}

export default function RequestQuoteScreen() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredSubs, setFilteredSubs] = useState<SubCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSub, setSelectedSub] = useState<SubCategory | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [loadingCat, setLoadingCat] = useState(true);
  const [loadingSub, setLoadingSub] = useState(false);

  const [cropQuantity, setCropQuantity] = useState("");
  const [cropPrice, setCropPrice] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [requiredDate, setRequiredDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [locationLoading, setLocationLoading] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const token = await getToken();
        const res = await api.get("/category/getCategories", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCategories(res.data);
      } catch (error) {
        Alert.alert("Error", "Could not load categories");
        console.log(error);
      } finally {
        setLoadingCat(false);
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    if (!selectedCategory) return;
    const loadSubCategories = async () => {
      setLoadingSub(true);
      setFilteredSubs([]);
      setSelectedSub(null);
      try {
        const token = await getToken();
        const res = await api.get(
          `/crop/getSubCategories?catId=${selectedCategory.Id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setFilteredSubs(res.data);
      } catch (error) {
        Alert.alert("Error", "Could not load sub-categories");
        console.log(error);
      } finally {
        setLoadingSub(false);
      }
    };
    loadSubCategories();
  }, [selectedCategory]);

  const fetchCurrentPlaceName = useCallback(async () => {
    try {
      setLocationLoading(true);
      setLocationDenied(false);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationDenied(true);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const [addr] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      if (addr) {
        const placeName = formatPlaceName(addr);
        if (placeName) {
          setDeliveryLocation(placeName);
          setErrors((e) => ({ ...e, deliveryLocation: "" }));
        } else {
          Alert.alert(
            "Location error",
            "Couldn't determine a place name for your location. Enter it manually."
          );
        }
      }
    } catch (e) {
      Alert.alert("Location error", "Couldn't fetch your current location.");
    } finally {
      setLocationLoading(false);
    }
  }, []);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!selectedCategory) next.category = "Select a category";
    if (!selectedSub) next.sub = "Select a crop type";
    if (!cropQuantity.trim() || isNaN(Number(cropQuantity)))
      next.cropQuantity = "Enter a valid quantity";
    if (!cropPrice.trim() || isNaN(Number(cropPrice)))
      next.cropPrice = "Enter a valid price";
    if (!deliveryLocation.trim())
      next.deliveryLocation = "Delivery location is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setSubmitting(true);
      const token = await getToken();

      const payload = {
        cropName: selectedSub!.itemName,
        cropQuantity: Number(cropQuantity),
        cropPrice: Number(cropPrice),
        deliveryLocation: deliveryLocation.trim(),
        requiredDate: formatDateForApi(requiredDate),
      };

      await api.post("/quote/addQuotation", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      Alert.alert("Quote requested", "Your quote request has been submitted.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert(
        "Submission failed",
        e?.response?.data?.message || "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const unitLabel = selectedSub?.units?.unit ?? "";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request a Quote</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionSub}>
          Tell us what you need and we'll connect you with the best farmer price.
        </Text>

        {/* Category */}
        <Text style={styles.label}>Category</Text>
        {loadingCat ? (
          <ActivityIndicator color={C.primary} style={{ marginBottom: 16 }} />
        ) : (
          <>
            <TouchableOpacity
              style={[styles.dropdown, errors.category && styles.dropdownError]}
              onPress={() => {
                setCatOpen((o) => !o);
                setSubOpen(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={selectedCategory ? styles.dropdownVal : styles.dropdownPlaceholder}>
                {selectedCategory
                  ? `${selectedCategory.emoji}  ${selectedCategory.categoryName}`
                  : "Select category (Vegetables, Fruits…)"}
              </Text>
              <Ionicons
                name={catOpen ? "chevron-up" : "chevron-down"}
                size={16}
                color={C.textMuted}
              />
            </TouchableOpacity>
            {catOpen && (
              <View style={styles.dropdownList}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.Id}
                    style={[
                      styles.dropdownItem,
                      selectedCategory?.Id === cat.Id && styles.dropdownItemActive,
                    ]}
                    onPress={() => {
                      setSelectedCategory(cat);
                      setCatOpen(false);
                      setErrors((e) => ({ ...e, category: "" }));
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropdownItemEmoji}>{cat.emoji}</Text>
                    <Text
                      style={[
                        styles.dropdownItemText,
                        selectedCategory?.Id === cat.Id && styles.dropdownItemTextActive,
                      ]}
                    >
                      {cat.categoryName}
                    </Text>
                    {selectedCategory?.Id === cat.Id && (
                      <Ionicons name="checkmark" size={16} color={C.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
          </>
        )}

        {/* Crop Type / Sub-category */}
        <Text style={styles.label}>Crop Type</Text>
        {loadingSub ? (
          <ActivityIndicator color={C.primary} style={{ marginBottom: 16 }} />
        ) : (
          <>
            <TouchableOpacity
              style={[
                styles.dropdown,
                !selectedCategory && styles.dropdownDisabled,
                errors.sub && styles.dropdownError,
              ]}
              onPress={() => {
                if (!selectedCategory) {
                  Alert.alert("Pick a category first");
                  return;
                }
                setSubOpen((o) => !o);
                setCatOpen(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={selectedSub ? styles.dropdownVal : styles.dropdownPlaceholder}>
                {selectedSub
                  ? selectedSub.itemName
                  : selectedCategory
                    ? "Select crop (Tomato, Apple…)"
                    : "Select a category first"}
              </Text>
              <Ionicons
                name={subOpen ? "chevron-up" : "chevron-down"}
                size={16}
                color={C.textMuted}
              />
            </TouchableOpacity>
            {subOpen && (
              <View style={styles.dropdownList}>
                {filteredSubs.length === 0 ? (
                  <Text style={styles.emptyDropdown}>No crops in this category</Text>
                ) : (
                  filteredSubs.map((sub) => (
                    <TouchableOpacity
                      key={sub.Id}
                      style={[
                        styles.dropdownItem,
                        selectedSub?.Id === sub.Id && styles.dropdownItemActive,
                      ]}
                      onPress={() => {
                        setSelectedSub(sub);
                        setSubOpen(false);
                        setErrors((e) => ({ ...e, sub: "" }));
                      }}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          selectedSub?.Id === sub.Id && styles.dropdownItemTextActive,
                        ]}
                      >
                        {sub.itemName}
                      </Text>
                      <Text style={styles.dropdownItemUnit}>{sub.units?.unit}</Text>
                      {selectedSub?.Id === sub.Id && (
                        <Ionicons name="checkmark" size={16} color={C.primary} />
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
            {errors.sub && <Text style={styles.errorText}>{errors.sub}</Text>}
          </>
        )}

        {/* Quantity */}
        <Text style={styles.label}>
          Quantity{unitLabel ? ` (${unitLabel})` : ""}
        </Text>
        <TextInput
          style={[styles.input, errors.cropQuantity && styles.inputError]}
          placeholder="e.g. 500"
          placeholderTextColor={C.textMuted}
          keyboardType="numeric"
          value={cropQuantity}
          onChangeText={setCropQuantity}
        />
        {errors.cropQuantity && (
          <Text style={styles.errorText}>{errors.cropQuantity}</Text>
        )}

        {/* Target Price */}
        <Text style={styles.label}>
          Expected Price (₹{unitLabel ? ` / ${unitLabel}` : "/kg"})
        </Text>
        <TextInput
          style={[styles.input, errors.cropPrice && styles.inputError]}
          placeholder="e.g. 25"
          placeholderTextColor={C.textMuted}
          keyboardType="numeric"
          value={cropPrice}
          onChangeText={setCropPrice}
        />
        {errors.cropPrice && <Text style={styles.errorText}>{errors.cropPrice}</Text>}

        {/* Delivery Location */}
        <Text style={styles.label}>Delivery Location</Text>
        <View style={styles.locationRow}>
          <TextInput
            style={[
              styles.input,
              styles.locationInput,
              errors.deliveryLocation && styles.inputError,
            ]}
            placeholder="e.g. Madhapur, Hyderabad"
            placeholderTextColor={C.textMuted}
            value={deliveryLocation}
            onChangeText={(t) => {
              setDeliveryLocation(t);
              setErrors((e) => ({ ...e, deliveryLocation: "" }));
            }}
          />
          <TouchableOpacity
            style={styles.locBtn}
            onPress={fetchCurrentPlaceName}
            disabled={locationLoading}
          >
            {locationLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="locate" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.hintText}>
          Type a place name, or tap the locate button to use your current location.
        </Text>
        {locationDenied && (
          <Text style={styles.errorText}>
            Location permission denied — enter your delivery location manually or
            enable location access.
          </Text>
        )}
        {errors.deliveryLocation && (
          <Text style={styles.errorText}>{errors.deliveryLocation}</Text>
        )}

        {/* Required Date */}
        <Text style={styles.label}>Required By</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={{ color: C.text }}>
            {requiredDate.toDateString()}
          </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={requiredDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            minimumDate={new Date()}
            onChange={(event, selectedDate) => {
              setShowDatePicker(Platform.OS === "ios");
              if (selectedDate) setRequiredDate(selectedDate);
            }}
          />
        )}

        <TouchableOpacity
          style={styles.submitBtn}
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitText}>Submit Request</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.card },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "600", color: C.text },

  scrollContent: { padding: 18, paddingBottom: 40, backgroundColor: C.bg, flexGrow: 1 },
  sectionSub: { fontSize: 13, color: C.textSub, marginBottom: 18, lineHeight: 18 },

  label: { fontSize: 13, fontWeight: "500", color: C.text, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: C.text,
  },
  inputError: { borderColor: C.danger },
  errorText: { fontSize: 11, color: C.danger, marginTop: 4 },
  hintText: { fontSize: 11, color: C.textMuted, marginTop: 4 },

  locationRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  locationInput: { flex: 1 },
  locBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.primary,
    justifyContent: "center",
    alignItems: "center",
  },

  // Category / crop type dropdowns (mirrors addCrop.tsx)
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 4,
  },
  dropdownDisabled: { backgroundColor: "#f7f7f7" },
  dropdownError: { borderColor: C.danger },
  dropdownPlaceholder: { fontSize: 14, color: C.textMuted, flex: 1 },
  dropdownVal: { fontSize: 14, color: C.text, flex: 1, fontWeight: "500" },
  dropdownList: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 4,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  dropdownItemActive: { backgroundColor: C.primaryLight },
  dropdownItemEmoji: { fontSize: 20 },
  dropdownItemText: { flex: 1, fontSize: 14, color: C.text },
  dropdownItemTextActive: { color: C.primary, fontWeight: "500" },
  dropdownItemUnit: { fontSize: 11, color: C.textMuted },
  emptyDropdown: {
    textAlign: "center",
    color: C.textMuted,
    fontSize: 13,
    paddingVertical: 16,
  },

  submitBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 30,
  },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});