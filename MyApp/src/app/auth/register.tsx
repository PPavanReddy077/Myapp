import { useState, useRef } from "react";
import {
    View,
    Text,
    Image,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
declare module "expo-image-picker";
import {
    useFonts,
    Poppins_800ExtraBold,
    Poppins_600SemiBold,
    Poppins_400Regular,
} from "@expo-google-fonts/poppins";
import API from "../../_services/api";
import Toast, { ToastRef } from "../../components/toast";

export default function RegisterScreen() {
    const toastRef = useRef<ToastRef>(null);

    const [avatar, setAvatar] = useState<string | null>(null);
    const [username, setUsername] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [fontsLoaded] = useFonts({
        Poppins_800ExtraBold,
        Poppins_600SemiBold,
        Poppins_400Regular,
    });

    if (!fontsLoaded) return null;

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            setError("Permission to access gallery is required.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"] as any,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!result.canceled) {
            setAvatar(result.assets[0].uri);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
            setError("Permission to access camera is required.");
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!result.canceled) {
            setAvatar(result.assets[0].uri);
        }
    };

    const validate = () => {
        if (!username.trim()) return "Username is required.";
        if (username.trim().length < 3) return "Username must be at least 3 characters.";
        if (!/^\d{10}$/.test(phoneNumber)) return "Enter a valid 10-digit phone number.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
        if (password.length < 8) return "Password must be at least 8 characters.";
        if (password !== confirmPassword) return "Passwords do not match.";
        return null;
    };

    const handleRegister = async () => {
        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }
        setError("");
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append("username", username);
            formData.append("phoneNumber", phoneNumber);
            formData.append("email", email.trim().toLowerCase());
            formData.append("password", password);

            if (avatar) {
                const filename = avatar.split("/").pop() ?? "avatar.jpg";
                const match = /\.(\w+)$/.exec(filename);
                const type = match ? `image/${match[1]}` : "image/jpeg";
                formData.append("file", { uri: avatar, name: filename, type } as any);
            }

            await API.post("/auth/signup", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            toastRef.current?.show(`Welcome, ${username.trim()}! 🌿 Account created successfully.`);
            setTimeout(() => router.replace("/auth/login"), 1900);

        } catch (e: any) {
            setError(e.message || "Registration failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const inputStyle: any = {
        backgroundColor: "#fff",
        borderWidth: 1.5,
        borderColor: "#E0E7E0",
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontFamily: "Poppins_400Regular",
        fontSize: 15,
        color: "#1B2B1B",
    };

    const labelStyle: any = {
        fontFamily: "Poppins_600SemiBold",
        fontSize: 13,
        color: "#455A64",
        marginBottom: 6,
        marginLeft: 2,
    };

    const fieldWrap: any = { marginBottom: 18 };

    const getStrength = () => {
        if (!password) return { score: 0, label: "", color: "#E0E7E0" };
        let score = 0;
        if (password.length >= 8) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        const map = [
            { label: "", color: "#E0E7E0" },
            { label: "Weak", color: "#EF5350" },
            { label: "Fair", color: "#FF9800" },
            { label: "Good", color: "#66BB6A" },
            { label: "Strong 💪", color: "#2E7D32" },
        ];
        return { score, ...map[score] };
    };

    const strength = getStrength();

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: "#FAF9F6" }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <Toast ref={toastRef} />

            <ScrollView
                contentContainerStyle={{
                    flexGrow: 1,
                    padding: 28,
                    paddingTop: 56,
                    paddingBottom: 48,
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{ marginBottom: 20 }}
                >
                    <Text
                        style={{
                            fontFamily: "Poppins_600SemiBold",
                            fontSize: 13,
                            color: "#2E7D32",
                        }}
                    >
                        ← Back to login
                    </Text>
                </TouchableOpacity>

                <View style={{ alignItems: "center", marginBottom: 32 }}>
                    <View
                        style={{
                            width: 110,
                            height: 110,
                            borderRadius: 55,
                            backgroundColor: "#fff",
                            alignItems: "center",
                            justifyContent: "center",
                            shadowColor: "#2E7D32",
                            shadowOpacity: 0.13,
                            shadowRadius: 16,
                            shadowOffset: { width: 0, height: 7 },
                            elevation: 7,
                            marginBottom: 12,
                        }}
                    >
                        <Image
                            source={require("../../../assets/images/logo.png")}
                            style={{ width: 92, height: 92 }}
                            resizeMode="contain"
                        />
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                        <Text
                            style={{
                                fontFamily: "Poppins_800ExtraBold",
                                fontSize: 26,
                                color: "#FF9800",
                            }}
                        >
                            My
                        </Text>
                        <Text
                            style={{
                                fontFamily: "Poppins_800ExtraBold",
                                fontSize: 26,
                                color: "#2E7D32",
                            }}
                        >
                            Annadatha
                        </Text>
                    </View>
                    <Text
                        style={{
                            fontFamily: "Poppins_400Regular",
                            fontSize: 12,
                            color: "#90A4AE",
                            marginTop: 2,
                        }}
                    >
                        From Farmers to Families
                    </Text>
                </View>

                <Text
                    style={{
                        fontFamily: "Poppins_800ExtraBold",
                        fontSize: 22,
                        color: "#1B2B1B",
                        marginBottom: 4,
                    }}
                >
                    Create your account
                </Text>
                <Text
                    style={{
                        fontFamily: "Poppins_400Regular",
                        fontSize: 13,
                        color: "#607D8B",
                        marginBottom: 28,
                    }}
                >
                    Join thousands of families getting fresh produce
                </Text>

                {/* Error */}
                {error ? (
                    <View
                        style={{
                            backgroundColor: "#FFEBEE",
                            borderRadius: 10,
                            padding: 12,
                            marginBottom: 18,
                        }}
                    >
                        <Text
                            style={{
                                fontFamily: "Poppins_400Regular",
                                fontSize: 13,
                                color: "#C62828",
                            }}
                        >
                            {error}
                        </Text>
                    </View>
                ) : null}

                <View style={{ alignItems: "center", marginBottom: 28 }}>
                    <TouchableOpacity onPress={pickImage} activeOpacity={0.85}>
                        <View
                            style={{
                                width: 100,
                                height: 100,
                                borderRadius: 50,
                                backgroundColor: "#E8F5E9",
                                alignItems: "center",
                                justifyContent: "center",
                                borderWidth: 2.5,
                                borderColor: avatar ? "#2E7D32" : "#C8E6C9",
                                borderStyle: avatar ? "solid" : "dashed",
                                overflow: "hidden",
                            }}
                        >
                            {avatar ? (
                                <Image
                                    source={{ uri: avatar }}
                                    style={{ width: 100, height: 100 }}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={{ alignItems: "center" }}>
                                    <Text style={{ fontSize: 32 }}>👤</Text>
                                    <Text
                                        style={{
                                            fontFamily: "Poppins_600SemiBold",
                                            fontSize: 10,
                                            color: "#2E7D32",
                                            marginTop: 2,
                                        }}
                                    >
                                        Add Photo
                                    </Text>
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>

                    <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
                        <TouchableOpacity
                            onPress={pickImage}
                            style={{
                                paddingHorizontal: 14,
                                paddingVertical: 6,
                                borderRadius: 20,
                                backgroundColor: "#E8F5E9",
                                borderWidth: 1,
                                borderColor: "#C8E6C9",
                            }}
                        >
                            <Text
                                style={{
                                    fontFamily: "Poppins_600SemiBold",
                                    fontSize: 12,
                                    color: "#2E7D32",
                                }}
                            >
                                📁 Gallery
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={takePhoto}
                            style={{
                                paddingHorizontal: 14,
                                paddingVertical: 6,
                                borderRadius: 20,
                                backgroundColor: "#FFF8EE",
                                borderWidth: 1,
                                borderColor: "#FFE0B2",
                            }}
                        >
                            <Text
                                style={{
                                    fontFamily: "Poppins_600SemiBold",
                                    fontSize: 12,
                                    color: "#FF9800",
                                }}
                            >
                                📷 Camera
                            </Text>
                        </TouchableOpacity>
                        {avatar && (
                            <TouchableOpacity
                                onPress={() => setAvatar(null)}
                                style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 6,
                                    borderRadius: 20,
                                    backgroundColor: "#FFEBEE",
                                    borderWidth: 1,
                                    borderColor: "#FFCDD2",
                                }}
                            >
                                <Text
                                    style={{
                                        fontFamily: "Poppins_600SemiBold",
                                        fontSize: 12,
                                        color: "#C62828",
                                    }}
                                >
                                    ✕ Remove
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <View style={{ height: 1, backgroundColor: "#E0E7E0", marginBottom: 24 }} />

                <View style={fieldWrap}>
                    <Text style={labelStyle}>Username</Text>
                    <TextInput
                        value={username}
                        onChangeText={setUsername}
                        placeholder="e.g. ravi_farmer"
                        placeholderTextColor="#B0BEC5"
                        autoCapitalize="none"
                        style={inputStyle}
                    />
                </View>

                <View style={fieldWrap}>
                    <Text style={labelStyle}>Phone Number</Text>
                    <View style={{ ...inputStyle, flexDirection: "row", alignItems: "center" }}>
                        <Text
                            style={{
                                fontFamily: "Poppins_600SemiBold",
                                fontSize: 15,
                                color: "#2E7D32",
                                marginRight: 8,
                            }}
                        >
                            +91
                        </Text>
                        <TextInput
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                            placeholder="10-digit mobile number"
                            placeholderTextColor="#B0BEC5"
                            keyboardType="phone-pad"
                            maxLength={10}
                            style={{
                                flex: 1,
                                fontFamily: "Poppins_400Regular",
                                fontSize: 15,
                                color: "#1B2B1B",
                            }}
                        />
                    </View>
                </View>

                <View style={fieldWrap}>
                    <Text style={labelStyle}>Email Address</Text>
                    <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@example.com"
                        placeholderTextColor="#B0BEC5"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        style={inputStyle}
                    />
                </View>

                <View style={fieldWrap}>
                    <Text style={labelStyle}>Password</Text>
                    <View style={{ position: "relative" }}>
                        <TextInput
                            value={password}
                            onChangeText={setPassword}
                            placeholder="Min. 8 characters"
                            placeholderTextColor="#B0BEC5"
                            secureTextEntry={!showPassword}
                            style={{ ...inputStyle, paddingRight: 52 }}
                        />
                        <TouchableOpacity
                            onPress={() => setShowPassword((p) => !p)}
                            style={{ position: "absolute", right: 16, top: 14 }}
                        >
                            <Text style={{ fontSize: 18 }}>{showPassword ? "🙈" : "👁️"}</Text>
                        </TouchableOpacity>
                    </View>

                    {password.length > 0 && (
                        <View style={{ marginTop: 8 }}>
                            <View style={{ flexDirection: "row", gap: 4, marginBottom: 4 }}>
                                {[1, 2, 3, 4].map((i) => (
                                    <View
                                        key={i}
                                        style={{
                                            flex: 1,
                                            height: 4,
                                            borderRadius: 2,
                                            backgroundColor:
                                                i <= strength.score ? strength.color : "#E0E7E0",
                                        }}
                                    />
                                ))}
                            </View>
                            {strength.label ? (
                                <Text
                                    style={{
                                        fontFamily: "Poppins_600SemiBold",
                                        fontSize: 11,
                                        color: strength.color,
                                    }}
                                >
                                    {strength.label}
                                </Text>
                            ) : null}
                        </View>
                    )}
                </View>

                <View style={fieldWrap}>
                    <Text style={labelStyle}>Confirm Password</Text>
                    <View style={{ position: "relative" }}>
                        <TextInput
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="Re-enter your password"
                            placeholderTextColor="#B0BEC5"
                            secureTextEntry={!showConfirm}
                            style={{
                                ...inputStyle,
                                paddingRight: 52,
                                borderColor:
                                    confirmPassword && confirmPassword !== password
                                        ? "#EF5350"
                                        : confirmPassword && confirmPassword === password
                                            ? "#2E7D32"
                                            : "#E0E7E0",
                            }}
                        />
                        <TouchableOpacity
                            onPress={() => setShowConfirm((p) => !p)}
                            style={{ position: "absolute", right: 16, top: 14 }}
                        >
                            <Text style={{ fontSize: 18 }}>{showConfirm ? "🙈" : "👁️"}</Text>
                        </TouchableOpacity>
                        {confirmPassword ? (
                            <Text style={{ position: "absolute", right: 52, top: 16, fontSize: 16 }}>
                                {confirmPassword === password ? "✅" : "❌"}
                            </Text>
                        ) : null}
                    </View>
                </View>

                <TouchableOpacity
                    onPress={handleRegister}
                    activeOpacity={0.85}
                    style={{
                        backgroundColor: "#2E7D32",
                        borderRadius: 14,
                        paddingVertical: 17,
                        alignItems: "center",
                        marginTop: 8,
                        shadowColor: "#2E7D32",
                        shadowOpacity: 0.28,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 6 },
                        elevation: 6,
                    }}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text
                            style={{
                                fontFamily: "Poppins_600SemiBold",
                                fontSize: 16,
                                color: "#fff",
                            }}
                        >
                            Create Account
                        </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => router.replace("/auth/login")}
                    style={{ alignItems: "center", marginTop: 24 }}
                >
                    <Text
                        style={{
                            fontFamily: "Poppins_400Regular",
                            fontSize: 13,
                            color: "#607D8B",
                        }}
                    >
                        Already have an account?{" "}
                        <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FF9800" }}>
                            Sign in
                        </Text>
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}