import { useState, useRef, useEffect } from "react";
import * as Linking from "expo-linking";
import { saveToken, getToken, removeToken } from "../../_services/storage";

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
import {
  useFonts,
  Poppins_800ExtraBold,
  Poppins_600SemiBold,
  Poppins_400Regular,
} from "@expo-google-fonts/poppins";
import API from "../../_services/api";
import Toast, { ToastRef } from "../../components/toast";

type ViewState = "main" | "otp" | "otp-verify" | "creds" | "forgot" | "forgot-otp-verify" | "new-password";

export default function LoginScreen() {
  useEffect(() => {
    const handleDeepLink = async ({ url }: { url: string }) => {
      const data = Linking.parse(url);
      const token = data.queryParams?.token;
      if (token && typeof token === "string") {
        await saveToken(token);
        toastRef.current?.show("Google login successful 🌿");
        setTimeout(() => {
          router.replace("/tabs/home");
        }, 1500);
      }
    };

    const sub = Linking.addEventListener("url", handleDeepLink);
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => sub.remove();
  }, []);

  const toastRef = useRef<ToastRef>(null);
  const [view, setView] = useState<ViewState>("main");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotOtp, setForgotOtp] = useState(["", "", "", "", "", ""]);
  const forgotOtpRefs = useRef<(TextInput | null)[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fontsLoaded] = useFonts({
    Poppins_800ExtraBold,
    Poppins_600SemiBold,
    Poppins_400Regular,
  });

  if (!fontsLoaded) return null;

  const handleSendOtp = async () => {
    if (phoneNumber.length < 10) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await API.post("/auth/otpSignIn", { phoneNumber }, {
        headers: { "Content-Type": "application/json" },
      });
      await saveToken(res.data.message);
      toastRef.current?.show(res.data.message);
      setView("otp-verify");
    } catch (e: any) {
      const msg = e.response?.data?.message || "Could not send OTP. Please try again.";
      setError(msg);
      toastRef.current?.show(` ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length < 6) {
      setError("Enter the 6-digit OTP.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await API.post("/auth/ValidateOtp", { phoneNumber, otp: code }, {
        headers: { "Content-Type": "application/json" },
      });
      await saveToken(res.data.message);
      toastRef.current?.show("OTP verified! Welcome back 🌿");
      setTimeout(() => router.replace("/tabs/home"), 1500);
    } catch (e: any) {
      const msg = e.response?.data?.message;
      setError(msg);
      toastRef.current?.show(` ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text && index < 5) otpRefs.current[index + 1]?.focus();
    if (!text && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleGoogleLogin = async () => {
    // await WebBrowser.openAuthSessionAsync(
    //   "https://females-unfortunately-travelers-rides.trycloudflare.com/oauth/login",
    //   "myannadatha://login-success"
    // );
  };

  const handleCredsLogin = async () => {
    if (!username || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await API.post("/auth/signin", { email : username, password }, {
        headers: { "Content-Type": "application/json" },
      });
      toastRef.current?.show("Login successful! Welcome back 🌿");
      await saveToken(res.data.message);
      setTimeout(() => router.replace("/tabs/home"), 1500);
    } catch (e: any) {
      const msg = e.response?.data?.message || "Login failed. Please try again.";
      setError(msg);
      toastRef.current?.show(`❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSendOtp = async () => {
    if (forgotPhone.length < 10) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await API.post("/auth/otpSignIn", { phoneNumber: forgotPhone }, {
        headers: { "Content-Type": "application/json" },
      });
      toastRef.current?.show(res.data.message || "OTP sent successfully!");
      setForgotOtp(["", "", "", "", "", ""]);
      setView("forgot-otp-verify");
    } catch (e: any) {
      const msg = e.response?.data?.message || "Could not send OTP. Please try again.";
      setError(msg);
      toastRef.current?.show(` ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotVerifyOtp = async () => {
    const code = forgotOtp.join("");
    if (code.length < 6) {
      setError("Enter the 6-digit OTP.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await API.post("/auth/ValidateOtp", { phoneNumber: forgotPhone, otp: code }, {
        headers: { "Content-Type": "application/json" },
      });
      toastRef.current?.show("OTP verified! Set your new password");
      setNewPassword("");
      setConfirmPassword("");
      setView("new-password");
    } catch (e: any) {
      const msg = e.response?.data?.message || "Invalid OTP. Please try again.";
      setError(msg);
      toastRef.current?.show(`${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotOtpChange = (text: string, index: number) => {
    const newOtp = [...forgotOtp];
    newOtp[index] = text;
    setForgotOtp(newOtp);
    if (text && index < 5) forgotOtpRefs.current[index + 1]?.focus();
    if (!text && index > 0) forgotOtpRefs.current[index - 1]?.focus();
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await API.post("/auth/resetPassword", {
        phoneNumber: forgotPhone,
        password : newPassword,
      }, {
        headers: { "Content-Type": "application/json" },
      });
      await saveToken(res.data.message);
    
      toastRef.current?.show(res.data.message || "Password reset successful!");
      setForgotPhone("");
      setForgotOtp(["", "", "", "", "", ""]);
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setView("creds"), 1800);
    } catch (e: any) {
      const msg = e.response?.data?.message || "Could not reset password. Try again.";
      setError(msg);
      toastRef.current?.show(` ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const goBack = (to: ViewState) => {
    setError("");
    setView(to);
  };

  const BackButton = ({
    to,
    label = "← Back to login options",
  }: {
    to: ViewState;
    label?: string;
  }) => (
    <TouchableOpacity onPress={() => goBack(to)} style={{ marginBottom: 20 }}>
      <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#2E7D32" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const ErrorBox = () =>
    error ? (
      <View style={{ backgroundColor: "#FFEBEE", borderRadius: 10, padding: 12, marginBottom: 16 }}>
        <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 13, color: "#C62828" }}>
          {error}
        </Text>
      </View>
    ) : null;

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
    marginBottom: 14,
  };

  const PrimaryButton = ({
    label,
    onPress,
    color = "#2E7D32",
  }: {
    label: string;
    onPress: () => void;
    color?: string;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: color,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
        shadowColor: color,
        shadowOpacity: 0.25,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 5,
        marginTop: 4,
      }}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 15, color: "#fff" }}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );

  const Header = () => (
    <View style={{ alignItems: "center", marginBottom: 28 }}>
      <View
        style={{
          width: 140,
          height: 140,
          borderRadius: 70,
          backgroundColor: "#fff",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#2E7D32",
          shadowOpacity: 0.14,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
          marginBottom: 14,
        }}
      >
        <Image
          source={require("../../../assets/images/logo.png")}
          style={{ width: 115, height: 120 }}
          resizeMode="contain"
        />
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline" }}>
        <Text style={{ fontFamily: "Poppins_800ExtraBold", fontSize: 28, color: "#FF9800" }}>
          My
        </Text>
        <Text style={{ fontFamily: "Poppins_800ExtraBold", fontSize: 28, color: "#2E7D32" }}>
          Annadatha
        </Text>
      </View>
      <Text
        style={{
          fontFamily: "Poppins_400Regular",
          fontSize: 12,
          color: "#90A4AE",
          marginTop: 2,
          letterSpacing: 0.4,
        }}
      >
        From Farmers to Families
      </Text>
    </View>
  );

  const renderMain = () => (
    <>
      <Header />
      <Text style={{ fontFamily: "Poppins_800ExtraBold", fontSize: 24, color: "#1B2B1B", marginBottom: 6 }}>
        Welcome back
      </Text>
      <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 14, color: "#607D8B", marginBottom: 32 }}>
        Choose how you'd like to sign in
      </Text>

      <TouchableOpacity
        onPress={() => { setError(""); setView("otp"); }}
        activeOpacity={0.85}
        style={{
          backgroundColor: "#2E7D32",
          borderRadius: 14,
          paddingVertical: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          marginBottom: 14,
          shadowColor: "#2E7D32",
          shadowOpacity: 0.2,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }}
      >
        <Text style={{ fontSize: 20 }}>📱</Text>
        <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 15, color: "#fff" }}>
          Login with OTP
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleGoogleLogin}
        activeOpacity={0.85}
        style={{
          backgroundColor: "#fff",
          borderRadius: 14,
          paddingVertical: 15,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          marginBottom: 14,
          borderWidth: 1.5,
          borderColor: "#E0E7E0",
        }}
      >
        <Image
          source={require("../../../assets/images/google.png")}
          style={{ width: 22, height: 22 }}
          resizeMode="contain"
        />
        <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 15, color: "#1B2B1B" }}>
          Continue with Google
        </Text>
      </TouchableOpacity>

      <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 8 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: "#E0E7E0" }} />
        <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: "#90A4AE", marginHorizontal: 12 }}>
          or
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: "#E0E7E0" }} />
      </View>

      <TouchableOpacity
        onPress={() => { setError(""); setView("creds"); }}
        activeOpacity={0.85}
        style={{
          borderRadius: 14,
          paddingVertical: 15,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          marginTop: 8,
          borderWidth: 1.5,
          borderColor: "#2E7D32",
        }}
      >
        <Text style={{ fontSize: 20 }}>🔐</Text>
        <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 15, color: "#2E7D32" }}>
          Login with Username & Password
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/auth/register")} style={{ alignItems: "center", marginTop: 36 }}>
        <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 13, color: "#607D8B" }}>
          New here?{" "}
          <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FF9800" }}>
            Create an account
          </Text>
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderOtp = () => (
    <>
      <BackButton to="main" />
      <Header />
      <Text style={{ fontFamily: "Poppins_800ExtraBold", fontSize: 24, color: "#1B2B1B", marginBottom: 6 }}>
        Enter your number
      </Text>
      <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 14, color: "#607D8B", marginBottom: 24 }}>
        We'll send a 6-digit OTP to verify you
      </Text>
      <ErrorBox />
      <View style={{ ...inputStyle, flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
        <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 15, color: "#2E7D32", marginRight: 8 }}>
          +91
        </Text>
        <TextInput
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          maxLength={10}
          placeholder="Mobile number"
          placeholderTextColor="#B0BEC5"
          style={{ flex: 1, fontFamily: "Poppins_400Regular", fontSize: 15, color: "#1B2B1B" }}
        />
      </View>
      <PrimaryButton label="Send OTP" onPress={handleSendOtp} />
    </>
  );

  const renderOtpVerify = () => (
    <>
      <BackButton to="otp" label="← Change number" />
      <Header />
      <Text style={{ fontFamily: "Poppins_800ExtraBold", fontSize: 24, color: "#1B2B1B", marginBottom: 6 }}>
        Verify OTP ✅
      </Text>
      <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 14, color: "#607D8B", marginBottom: 28 }}>
        Sent to +91 {phoneNumber}
      </Text>
      <ErrorBox />
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 28 }}>
        {otp.map((digit, i) => (
          <TextInput
            key={i}
            ref={(r) => { otpRefs.current[i] = r; }}
            value={digit}
            onChangeText={(t) => handleOtpChange(t, i)}
            keyboardType="number-pad"
            maxLength={1}
            style={{
              width: 48,
              height: 56,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: digit ? "#2E7D32" : "#E0E7E0",
              backgroundColor: digit ? "#F0F7F0" : "#fff",
              textAlign: "center",
              fontFamily: "Poppins_600SemiBold",
              fontSize: 22,
              color: "#1B2B1B",
            }}
          />
        ))}
      </View>
      <PrimaryButton label="Verify & Login" onPress={handleVerifyOtp} />
      <TouchableOpacity onPress={handleSendOtp} style={{ alignItems: "center", marginTop: 20 }}>
        <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 13, color: "#607D8B" }}>
          Didn't receive it?{" "}
          <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#2E7D32" }}>Resend OTP</Text>
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderCreds = () => (
    <>
      <BackButton to="main" />
      <Header />
      <Text style={{ fontFamily: "Poppins_800ExtraBold", fontSize: 24, color: "#1B2B1B", marginBottom: 6 }}>
        Sign in
      </Text>
      <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 14, color: "#607D8B", marginBottom: 24 }}>
        Enter your credentials to continue
      </Text>
      <ErrorBox />
      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="Username or Email"
        placeholderTextColor="#B0BEC5"
        autoCapitalize="none"
        style={inputStyle}
      />
      <View style={{ position: "relative", marginBottom: 6 }}>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor="#B0BEC5"
          secureTextEntry={!showPassword}
          style={{ ...inputStyle, marginBottom: 0, paddingRight: 52 }}
        />
        <TouchableOpacity
          onPress={() => setShowPassword((p) => !p)}
          style={{ position: "absolute", right: 16, top: 14 }}
        >
          <Text style={{ fontSize: 18 }}>{showPassword ? "🙈" : "👁️"}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={() => { setError(""); setForgotPhone(""); setView("forgot"); }}
        style={{ alignSelf: "flex-end", marginBottom: 24, marginTop: 8 }}
      >
        <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 13, color: "#FF9800" }}>
          Forgot password?
        </Text>
      </TouchableOpacity>
      <PrimaryButton label="Login" onPress={handleCredsLogin} />
      <TouchableOpacity onPress={() => router.push("/auth/register")} style={{ alignItems: "center", marginTop: 28 }}>
        <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 13, color: "#607D8B" }}>
          Don't have an account?{" "}
          <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FF9800" }}>Create one</Text>
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderForgot = () => (
    <>
      <BackButton to="creds" label="← Back to sign in" />
      <Header />
      <Text style={{ fontFamily: "Poppins_800ExtraBold", fontSize: 24, color: "#1B2B1B", marginBottom: 6 }}>
        Reset password
      </Text>
      <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 14, color: "#607D8B", marginBottom: 24 }}>
        Enter your registered phone number to receive a verification OTP
      </Text>
      <ErrorBox />
      <View style={{ ...inputStyle, flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
        <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 15, color: "#FF9800", marginRight: 8 }}>
          +91
        </Text>
        <TextInput
          value={forgotPhone}
          onChangeText={setForgotPhone}
          placeholder="Mobile number"
          placeholderTextColor="#B0BEC5"
          keyboardType="phone-pad"
          maxLength={10}
          style={{ flex: 1, fontFamily: "Poppins_400Regular", fontSize: 15, color: "#1B2B1B" }}
        />
      </View>
      <PrimaryButton label="Send OTP" onPress={handleForgotSendOtp} color="#FF9800" />
    </>
  );

  const renderForgotOtpVerify = () => (
    <>
      <BackButton to="forgot" label="← Change number" />
      <Header />
      <Text style={{ fontFamily: "Poppins_800ExtraBold", fontSize: 24, color: "#1B2B1B", marginBottom: 6 }}>
        Verify OTP 🔑
      </Text>
      <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 14, color: "#607D8B", marginBottom: 28 }}>
        Sent to +91 {forgotPhone}
      </Text>
      <ErrorBox />
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 28 }}>
        {forgotOtp.map((digit, i) => (
          <TextInput
            key={i}
            ref={(r) => { forgotOtpRefs.current[i] = r; }}
            value={digit}
            onChangeText={(t) => handleForgotOtpChange(t, i)}
            keyboardType="number-pad"
            maxLength={1}
            style={{
              width: 48,
              height: 56,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: digit ? "#FF9800" : "#E0E7E0",
              backgroundColor: digit ? "#FFF8F0" : "#fff",
              textAlign: "center",
              fontFamily: "Poppins_600SemiBold",
              fontSize: 22,
              color: "#1B2B1B",
            }}
          />
        ))}
      </View>
      <PrimaryButton label="Verify OTP" onPress={handleForgotVerifyOtp} color="#FF9800" />
      <TouchableOpacity onPress={handleForgotSendOtp} style={{ alignItems: "center", marginTop: 20 }}>
        <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 13, color: "#607D8B" }}>
          Didn't receive it?{" "}
          <Text style={{ fontFamily: "Poppins_600SemiBold", color: "#FF9800" }}>Resend OTP</Text>
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderNewPassword = () => (
    <>
      <Header />
      <Text style={{ fontFamily: "Poppins_800ExtraBold", fontSize: 24, color: "#1B2B1B", marginBottom: 6 }}>
        New password 🔐
      </Text>
      <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 14, color: "#607D8B", marginBottom: 24 }}>
        Choose a strong password for your account
      </Text>
      <ErrorBox />

      <View style={{ position: "relative", marginBottom: 6 }}>
        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="New password"
          placeholderTextColor="#B0BEC5"
          secureTextEntry={!showNewPassword}
          style={{ ...inputStyle, marginBottom: 0, paddingRight: 52 }}
        />
        <TouchableOpacity
          onPress={() => setShowNewPassword((p) => !p)}
          style={{ position: "absolute", right: 16, top: 14 }}
        >
          <Text style={{ fontSize: 18 }}>{showNewPassword ? "🙈" : "👁️"}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ position: "relative", marginBottom: 24, marginTop: 14 }}>
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm new password"
          placeholderTextColor="#B0BEC5"
          secureTextEntry={!showConfirmPassword}
          style={{ ...inputStyle, marginBottom: 0, paddingRight: 52 }}
        />
        <TouchableOpacity
          onPress={() => setShowConfirmPassword((p) => !p)}
          style={{ position: "absolute", right: 16, top: 14 }}
        >
          <Text style={{ fontSize: 18 }}>{showConfirmPassword ? "🙈" : "👁️"}</Text>
        </TouchableOpacity>
      </View>

      <PrimaryButton label="Reset Password" onPress={handleResetPassword} color="#FF9800" />
    </>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#FAF9F6" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Toast ref={toastRef} />

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: 28,
          paddingTop: 60,
          paddingBottom: 40,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {view === "main" && renderMain()}
        {view === "otp" && renderOtp()}
        {view === "otp-verify" && renderOtpVerify()}
        {view === "creds" && renderCreds()}
        {view === "forgot" && renderForgot()}
        {view === "forgot-otp-verify" && renderForgotOtpVerify()}
        {view === "new-password" && renderNewPassword()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}