import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  StatusBar,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import api from "@/_services/api";
import { getToken } from "@/_services/storage";

interface UserProfile {
  id: number;
  username: string;
  email: string;
  phoneNumber: number;
  profileUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
}

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
  danger: "#e53935",
};

function Avatar({ name, uri }: { name: string; uri?: string | null }) {
  const initials = (name || "?")
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

export default function EditProfileScreen() {
  const router = useRouter();
  const { user: userParam } = useLocalSearchParams<{ user?: string }>();

  const initialUser: UserProfile | null = userParam
    ? JSON.parse(userParam as string)
    : null;

  const [username, setUsername] = useState(initialUser?.username ?? "");
  const [email, setEmail] = useState(initialUser?.email ?? "");
  const [phoneNumber, setPhoneNumber] = useState(
    initialUser?.phoneNumber ? String(initialUser.phoneNumber) : ""
  );
  // currentImageUri: what's already on the server (shown if no new pick)
  // newImageAsset: only set once the user actually picks a new photo
  const [currentImageUri] = useState<string | null>(initialUser?.profileUrl ?? null);
  const [newImageAsset, setNewImageAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);

  const displayImageUri = newImageAsset?.uri ?? currentImageUri;

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow photo library access to change your profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      setNewImageAsset(result.assets[0]);
    }
  };

  const validate = () => {
    if (!username.trim()) {
      Alert.alert("Missing info", "Username can't be empty.");
      return false;
    }
    if (!email.trim() || !email.includes("@")) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return false;
    }
    if (!phoneNumber.trim() || phoneNumber.trim().length < 10) {
      Alert.alert("Invalid phone", "Please enter a valid phone number.");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!initialUser) {
      Alert.alert("Error", "Couldn't load your profile. Please go back and try again.");
      return;
    }
    if (!validate()) return;

    setSaving(true);
    const token = await getToken();
    if (!token) {
      router.replace("/auth/login");
      return;
    }

    try {
      if (newImageAsset) {
        // Photo changed -> multipart endpoint (/user/updateWithProfile)
        // Backend uses @ModelAttribute, so fields must be sent as plain
        // form fields, NOT as a JSON blob.
        const formData = new FormData();
        formData.append("id", String(initialUser.id));
        formData.append("username", username.trim());
        formData.append("email", email.trim());
        formData.append("phoneNumber", phoneNumber.trim());

        const uriParts = newImageAsset.uri.split(".");
        const fileType = uriParts[uriParts.length - 1];
        formData.append("file", {
          uri: newImageAsset.uri,
          name: `profile.${fileType}`,
          type: newImageAsset.mimeType ?? `image/${fileType}`,
        } as any);

        const res = await api.post("/user/updateWithProfile", formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });

        if (res.status === 200) {
          Alert.alert("Success", "Profile updated.", [
            { text: "OK", onPress: () => router.back() },
          ]);
        } else {
          Alert.alert("Error", res.data?.message ?? "Couldn't update your profile.");
        }
      } else {
        // No new photo -> JSON endpoint (/user/updateProfile)
        // Send the full user object so fields the backend isn't
        // touching (profileUrl, createdAt, etc.) aren't wiped out.
        const payload = {
          ...initialUser,
          username: username.trim(),
          email: email.trim(),
          phoneNumber: Number(phoneNumber.trim()),
        };

        const res = await api.post("/user/updateProfile", payload, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 200) {
          Alert.alert("Success", "Profile updated.", [
            { text: "OK", onPress: () => router.back() },
          ]);
        } else {
          Alert.alert("Error", res.data?.message ?? "Couldn't update your profile.");
        }
      }
    } catch (e: any) {
      const message =
        e?.response?.data?.message ?? "Something went wrong. Please try again.";
      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.card} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={pickImage} activeOpacity={0.8}>
              <Avatar name={username} uri={displayImageUri} />
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={pickImage}>
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Your name"
              placeholderTextColor={C.textMuted}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={C.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={false}
            />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="10-digit number"
              placeholderTextColor={C.textMuted}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "600", color: C.text },

  scrollContent: { paddingBottom: 40 },

  avatarSection: { alignItems: "center", marginTop: 28, gap: 10 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.primaryMid,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: { fontSize: 30, fontWeight: "700", color: C.primary },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: C.card,
  },
  changePhotoText: { fontSize: 13, color: C.primary, fontWeight: "600" },

  form: { paddingHorizontal: 20, marginTop: 28, gap: 4 },
  label: { fontSize: 12, color: C.textMuted, fontWeight: "600", marginTop: 14, marginBottom: 6 },
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

  saveBtn: {
    marginTop: 32,
    marginHorizontal: 20,
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});