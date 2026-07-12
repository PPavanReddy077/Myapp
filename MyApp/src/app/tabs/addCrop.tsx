import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import API from "../../_services/api";
import { jwtDecode } from 'jwt-decode';
import { getToken } from "@/_services/storage";

const C = {
  primary: "#3a7d44",
  primaryLight: "#e8f5e0",
  primaryMid: "#c8e6c9",
  accent: "#FF9800",
  accentLight: "#fff9e6",
  bg: "#F5F8F2",
  card: "#ffffff",
  border: "#efefef",
  borderFocus: "#3a7d44",
  text: "#111111",
  textSub: "#666666",
  textMuted: "#999999",
  error: "#d32f2f",
  errorLight: "#ffebee",
};

const MAX_IMAGES = 5;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type LocationPrecision = "village" | "mandal" | "district";

interface GeocodeResult {
  latitude: number;
  longitude: number;
  precision: LocationPrecision;
}

async function geocodeVillage(
  village: string,
  mandal: string,
  district: string,
  state: string
): Promise<GeocodeResult | null> {
  const attempts: { q: string; precision: LocationPrecision }[] = [
    { q: `${village}, ${mandal}, ${district}, ${state}, India`, precision: "village" },
    { q: `${village}, ${district}, ${state}, India`, precision: "village" },
    { q: `${mandal}, ${district}, ${state}, India`, precision: "mandal" },
    { q: `${district}, ${state}, India`, precision: "district" },
  ];

  for (let i = 0; i < attempts.length; i++) {
    const { q, precision } = attempts[i];
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`,
        {
          headers: {
            Accept: "application/json",
            "Accept-Language": "en",
            "User-Agent": "FarmConnectApp/1.0 (contact: support@farmconnect.app)",
            Referer: "https://farmconnect.app",
          },
        }
      );
      if (!res.ok) {
      } else {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          if (!isNaN(lat) && !isNaN(lon)) return { latitude: lat, longitude: lon, precision };
        }
      }
    } catch (err) {
      Alert.alert("Error", "Location lookup failed. Check your connection and try again.");
    }
    if (i < attempts.length - 1) await sleep(1100);
  }
  return null;
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

interface Unit {
  id: number;
  unit: string;
}

export default function AddCropScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [filteredSubs, setFilteredSubs] = useState<SubCategory[]>([]);
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSub, setSelectedSub] = useState<SubCategory | null>(null);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [village, setVillage] = useState("");
  const [mandal, setMandal] = useState("");
  const [district, setDistrict] = useState("");
  const [stateName, setStateName] = useState("");
  const [villageCoords, setVillageCoords] = useState<GeocodeResult | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState("");
  const [catOpen, setCatOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingCat, setLoadingCat] = useState(true);
  const [loadingSub, setLoadingSub] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

useEffect(() => {
  const loadCategories = async () => {
    try {
      const token = await getToken();

      const res = await API.get("/category/getCategories", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setCategories(res.data);
    } catch (error) {
      Alert.alert("Error", "Could not load categories");
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
      const res = await API.get(`/crop/getSubCategories?catId=${selectedCategory.Id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFilteredSubs(res.data); 
    } catch (error) {
      Alert.alert("Error", "Could not load sub-categories");
    } finally {
      setLoadingSub(false);
    }
  };

  loadSubCategories();
}, [selectedCategory]);

  const pickImages = useCallback(async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert("Limit reached", `You can upload at most ${MAX_IMAGES} photos.`);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access to upload crop images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: MAX_IMAGES - images.length,
    });
    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      setImages((prev) => {
        const combined = [...prev, ...uris];
        return combined.slice(0, MAX_IMAGES);
      });
      setErrors((e) => ({ ...e, images: "" }));
    }
  }, [images]);

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const onVillageFieldChange = (setter: (v: string) => void) => (t: string) => {
    setter(t);
    setVillageCoords(null);
    setLocationNote("");
    setErrors((e) => ({ ...e, location: "" }));
  };

  const handleLocateVillage = async () => {
    if (!village.trim() || !district.trim()) {
      setErrors((e) => ({ ...e, location: "Enter at least village and district" }));
      return;
    }
    setLocating(true);
    setErrors((e) => ({ ...e, location: "" }));
    setLocationNote("");
    try {
      const result = await geocodeVillage(village.trim(), mandal.trim(), district.trim(), stateName.trim());
      if (!result) {
        setErrors((e) => ({
          ...e,
          location:
            "Couldn't locate this village, mandal, or district. Check spelling, or try again — the location service may be rate-limited.",
        }));
        return;
      }
      setVillageCoords(result);
      if (result.precision !== "village") {
        setLocationNote(
          `"${village.trim()}" isn't individually mapped yet, so we used the ${result.precision} centre instead — still good enough for delivery matching.`
        );
      }
    } catch {
      setErrors((e) => ({ ...e, location: "Location lookup failed. Check your connection and try again." }));
    } finally {
      setLocating(false);
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!selectedCategory) errs.category = "Select a category";
    if (!selectedSub) errs.sub = "Select a crop type";
    if (!price.trim() || isNaN(Number(price)) || Number(price) <= 0)
      errs.price = "Enter a valid price";
    if (!quantity.trim() || isNaN(Number(quantity)) || Number(quantity) <= 0)
      errs.quantity = "Enter a valid quantity";
    if (!village.trim() || !district.trim())
      errs.location = "Enter at least village and district";
    else if (!villageCoords)
      errs.location = "Tap \"Locate Village\" to confirm the location";
    if (images.length === 0) errs.images = "Add at least 1 photo";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
  if (!validate()) return;
  setSubmitting(true);
  try {
    const token = await getToken();
    if (!token) throw new Error("Authentication token missing");

    const decoded = jwtDecode<{ userId: number }>(token);
    const userId = decoded.userId;

    const form = new FormData();

    form.append("itemId", String(selectedSub!.Id));
    form.append("cropPrice", String(parseFloat(price)));
    form.append("cropQuantity", String(parseFloat(quantity)));
    form.append("userId", String(userId));
    form.append("village", village.trim());
    form.append("mandal", mandal.trim());
    form.append("district", district.trim());
    form.append("state", stateName.trim());
    form.append("latitude", String(villageCoords!.latitude));
    form.append("longitude", String(villageCoords!.longitude));
    images.forEach((uri, i) => {
      const ext = uri.split(".").pop() ?? "jpg";
      const type = `image/${ext === "jpg" ? "jpeg" : ext}`;
      form.append("files", { uri, name: `crop_${i}.${ext}`, type } as any);
    });

    await API.post("/crop/addCrop", form, {
      headers: { Authorization: `Bearer ${token}` },
    });

    Alert.alert("Crop listed! 🌾", "Your crop is now visible to buyers.", [
      { text: "OK", onPress: () => router.back() },
    ]);
  } catch (err: any) {
    Alert.alert(
      "Upload failed",
      err?.response?.data?.message ?? "Something went wrong. Please try again."
    );
  } finally {
    setSubmitting(false);
  }
};
  const unitLabel = selectedSub?.units?.unit ?? "";

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>List a Crop</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SectionLabel title="Crop Photos" subtitle={`${images.length}/${MAX_IMAGES}`} />
          <View style={s.photoGrid}>
            {images.map((uri, i) => (
              <View key={i} style={s.photoThumb}>
                <Image source={{ uri }} style={s.photoImg} />
                <TouchableOpacity
                  style={s.photoRemove}
                  onPress={() => removeImage(i)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={13} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < MAX_IMAGES && (
              <TouchableOpacity
                style={[s.photoAdd, errors.images ? s.fieldError : null]}
                onPress={pickImages}
                activeOpacity={0.75}
              >
                <Ionicons name="camera-outline" size={26} color={C.primary} />
                <Text style={s.photoAddText}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </View>
          {errors.images ? <ErrorMsg msg={errors.images} /> : null}

          <SectionLabel title="Farm Location" />
          <View style={s.locationGrid}>
            <TextInput
              style={[s.locationInput, errors.location ? s.fieldError : null]}
              placeholder="Village *"
              placeholderTextColor={C.textMuted}
              value={village}
              onChangeText={onVillageFieldChange(setVillage)}
            />
            <TextInput
              style={[s.locationInput, errors.location ? s.fieldError : null]}
              placeholder="Mandal (optional)"
              placeholderTextColor={C.textMuted}
              value={mandal}
              onChangeText={onVillageFieldChange(setMandal)}
            />
            <TextInput
              style={[s.locationInput, errors.location ? s.fieldError : null]}
              placeholder="District *"
              placeholderTextColor={C.textMuted}
              value={district}
              onChangeText={onVillageFieldChange(setDistrict)}
            />
            <TextInput
              style={[s.locationInput, errors.location ? s.fieldError : null]}
              placeholder="State (optional)"
              placeholderTextColor={C.textMuted}
              value={stateName}
              onChangeText={onVillageFieldChange(setStateName)}
            />
          </View>

          <TouchableOpacity
            style={[
              s.locateBtn,
              villageCoords ? s.locateBtnDone : null,
            ]}
            onPress={handleLocateVillage}
            activeOpacity={0.8}
            disabled={locating}
          >
            {locating ? (
              <ActivityIndicator size="small" color={villageCoords ? C.primary : "#fff"} />
            ) : (
              <Ionicons
                name={villageCoords ? "checkmark-circle" : "navigate-outline"}
                size={16}
                color={villageCoords ? C.primary : "#fff"}
              />
            )}
            <Text style={[s.locateBtnText, villageCoords ? s.locateBtnTextDone : null]}>
              {villageCoords
                ? `Village located (${villageCoords.latitude.toFixed(4)}°, ${villageCoords.longitude.toFixed(4)}°)`
                : "Locate Village"}
            </Text>
          </TouchableOpacity>
          {errors.location ? <ErrorMsg msg={errors.location} /> : null}
          {!errors.location && locationNote ? <Text style={s.locationNoteText}>{locationNote}</Text> : null}

          <SectionLabel title="Category" />
          {loadingCat ? (
            <ActivityIndicator color={C.primary} style={{ marginBottom: 16 }} />
          ) : (
            <>
              <TouchableOpacity
                style={[s.dropdown, errors.category ? s.dropdownError : null]}
                onPress={() => { setCatOpen((o) => !o); setSubOpen(false); }}
                activeOpacity={0.8}
              >
                <Text style={selectedCategory ? s.dropdownVal : s.dropdownPlaceholder}>
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
                <View style={s.dropdownList}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.Id}
                      style={[
                        s.dropdownItem,
                        selectedCategory?.Id === cat.Id && s.dropdownItemActive,
                      ]}
                      onPress={() => {
                        setSelectedCategory(cat);
                        setCatOpen(false);
                        setErrors((e) => ({ ...e, category: "" }));
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={s.dropdownItemEmoji}>{cat.emoji}</Text>
                      <Text
                        style={[
                          s.dropdownItemText,
                          selectedCategory?.Id === cat.Id && s.dropdownItemTextActive,
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
              {errors.category ? <ErrorMsg msg={errors.category} /> : null}
            </>
          )}

          <SectionLabel title="Crop Type" />
          {loadingSub ? (
            <ActivityIndicator color={C.primary} style={{ marginBottom: 16 }} />
          ) : (
            <>
              <TouchableOpacity
                style={[
                  s.dropdown,
                  !selectedCategory && s.dropdownDisabled,
                  errors.sub ? s.dropdownError : null,
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
                <Text style={selectedSub ? s.dropdownVal : s.dropdownPlaceholder}>
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
                <View style={s.dropdownList}>
                  {filteredSubs.length === 0 ? (
                    <Text style={s.emptyDropdown}>No crops in this category</Text>
                  ) : (
                    filteredSubs.map((sub) => (
                      <TouchableOpacity
                        key={sub.Id}
                        style={[
                          s.dropdownItem,
                          selectedSub?.Id === sub.Id && s.dropdownItemActive,
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
                            s.dropdownItemText,
                            selectedSub?.Id === sub.Id && s.dropdownItemTextActive,
                          ]}
                        >
                          {sub.itemName}
                        </Text>
                        <Text style={s.dropdownItemUnit}>{sub.units?.unit}</Text>
                        {selectedSub?.Id === sub.Id && (
                          <Ionicons name="checkmark" size={16} color={C.primary} />
                        )}
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
              {errors.sub ? <ErrorMsg msg={errors.sub} /> : null}
            </>
          )}

          <SectionLabel title={`Price${unitLabel ? ` (per ${unitLabel})` : ""}`} />
          <View style={[s.inputRow, errors.price ? s.fieldError : null]}>
            <Text style={s.rupee}>₹</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. 25"
              placeholderTextColor={C.textMuted}
              keyboardType="decimal-pad"
              value={price}
              onChangeText={(t) => {
                setPrice(t);
                setErrors((e) => ({ ...e, price: "" }));
              }}
            />
            {unitLabel ? <Text style={s.unitSuffix}>/ {unitLabel}</Text> : null}
          </View>
          {errors.price ? <ErrorMsg msg={errors.price} /> : null}

          <SectionLabel title={`Quantity${unitLabel ? ` (${unitLabel})` : ""}`} />
          <View style={[s.inputRow, errors.quantity ? s.fieldError : null]}>
            <TextInput
              style={[s.input, { paddingLeft: 14 }]}
              placeholder="e.g. 100"
              placeholderTextColor={C.textMuted}
              keyboardType="decimal-pad"
              value={quantity}
              onChangeText={(t) => {
                setQuantity(t);
                setErrors((e) => ({ ...e, quantity: "" }));
              }}
            />
            {unitLabel ? <Text style={s.unitSuffix}>{unitLabel}</Text> : null}
          </View>
          {errors.quantity ? <ErrorMsg msg={errors.quantity} /> : null}

          {selectedSub && price && quantity ? (
            <View style={s.summaryCard}>
              <Text style={s.summaryTitle}>Listing Preview</Text>
              <Row label="Crop" value={selectedSub.itemName} />
              <Row label="Category" value={selectedCategory?.categoryName ?? ""} />
              <Row label="Price" value={`₹${price} / ${unitLabel}`} />
              <Row label="Quantity" value={`${quantity} ${unitLabel}`} />
              {village && district ? (
                <Row label="Village" value={`${village}, ${district}`} />
              ) : null}
              <Row label="Photos" value={`${images.length} uploaded`} />
            </View>
          ) : null}

          <TouchableOpacity
            style={[s.submitBtn, submitting && s.submitBtnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                <Text style={s.submitText}>List My Crop</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={s.footerNote}>
            Your listing will be visible to hostels, restaurants and catering services in your area.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


function SectionLabel({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={s.labelRow}>
      <Text style={s.label}>{title}</Text>
      {subtitle ? <Text style={s.labelSub}>{subtitle}</Text> : null}
    </View>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <View style={s.errorRow}>
      <Ionicons name="alert-circle-outline" size={13} color={C.error} />
      <Text style={s.errorText}>{msg}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.summaryRow}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={s.summaryValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingBottom: 40, paddingTop: 6 },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 12,
    backgroundColor: C.card,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1.5, borderColor: "#e8e8e8",
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "600", color: C.text },

  labelRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginTop: 20, marginBottom: 8,
  },
  label: { fontSize: 13, fontWeight: "600", color: C.text },
  labelSub: { fontSize: 12, color: C.textMuted },

  photoGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4,
  },
  photoThumb: {
    width: 86, height: 86, borderRadius: 12,
    overflow: "hidden", position: "relative",
  },
  photoImg: { width: "100%", height: "100%" },
  photoRemove: {
    position: "absolute", top: 4, right: 4,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 10,
    width: 22, height: 22, justifyContent: "center", alignItems: "center",
  },
  photoAdd: {
    width: 86, height: 86, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.primaryMid, borderStyle: "dashed",
    backgroundColor: C.primaryLight,
    justifyContent: "center", alignItems: "center", gap: 4,
  },
  photoAddText: { fontSize: 10, color: C.primary, fontWeight: "500" },

  locationGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10,
  },
  locationInput: {
    flexBasis: "47%", flexGrow: 1,
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, color: C.text,
  },
  locateBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: C.primary, borderRadius: 14,
    paddingVertical: 13, gap: 8, marginBottom: 4,
  },
  locateBtnDone: {
    backgroundColor: C.primaryLight, borderWidth: 1.5, borderColor: C.primaryMid,
  },
  locateBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  locateBtnTextDone: { color: C.primary },
  locationNoteText: {
    fontSize: 11.5, color: C.textSub, lineHeight: 16,
    marginBottom: 6, marginTop: 2,
  },

  dropdown: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 13,
    marginBottom: 4,
  },
  dropdownDisabled: { backgroundColor: "#f7f7f7" },
  dropdownError: { borderColor: C.error },
  dropdownPlaceholder: { fontSize: 14, color: C.textMuted, flex: 1 },
  dropdownVal: { fontSize: 14, color: C.text, flex: 1, fontWeight: "500" },
  dropdownList: {
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    marginBottom: 4, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 10,
    elevation: 3,
  },
  dropdownItem: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 12,
    gap: 10, borderBottomWidth: 1, borderBottomColor: "#f5f5f5",
  },
  dropdownItemActive: { backgroundColor: C.primaryLight },
  dropdownItemEmoji: { fontSize: 20 },
  dropdownItemText: { flex: 1, fontSize: 14, color: C.text },
  dropdownItemTextActive: { color: C.primary, fontWeight: "500" },
  dropdownItemUnit: { fontSize: 11, color: C.textMuted },
  emptyDropdown: {
    textAlign: "center", color: C.textMuted,
    fontSize: 13, paddingVertical: 16,
  },

  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.border,
    marginBottom: 4,
  },
  rupee: {
    paddingLeft: 14, fontSize: 16,
    fontWeight: "600", color: C.primary,
  },
  input: {
    flex: 1, fontSize: 15, color: C.text,
    paddingVertical: 13, paddingHorizontal: 8,
  },
  unitSuffix: {
    paddingRight: 14, fontSize: 13,
    color: C.textMuted, fontWeight: "500",
  },
  fieldError: { borderColor: C.error },

  errorRow: {
    flexDirection: "row", alignItems: "center",
    gap: 4, marginBottom: 6, marginTop: 2,
  },
  errorText: { fontSize: 12, color: C.error },

  // Summary card
  summaryCard: {
    backgroundColor: C.primaryLight, borderRadius: 16,
    borderWidth: 1, borderColor: C.primaryMid,
    padding: 14, marginTop: 20, marginBottom: 4,
  },
  summaryTitle: {
    fontSize: 13, fontWeight: "600", color: C.primary,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#d4ecd4",
  },
  summaryLabel: { fontSize: 12, color: C.textSub },
  summaryValue: { fontSize: 12, fontWeight: "500", color: C.text },

  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: C.primary, borderRadius: 16,
    paddingVertical: 16, marginTop: 24, gap: 8,
    shadowColor: C.primary, shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 12,
    elevation: 5,
  },
  submitBtnDisabled: { opacity: 0.65 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  footerNote: {
    textAlign: "center", fontSize: 11, color: C.textMuted,
    marginTop: 12, lineHeight: 16,
  },
});