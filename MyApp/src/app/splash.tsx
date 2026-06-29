import { useEffect } from "react";
import {
  View,
  Text,
  Image,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";

import { useFonts, Poppins_800ExtraBold } from "@expo-google-fonts/poppins";


export default function SplashScreen() {
  
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/onboarding/screen");
    }, 2500);

    return () => clearTimeout(timer);
  }, []);
  const [fontsLoaded] = useFonts({
  Poppins_800ExtraBold,
});

if (!fontsLoaded) return null;


  return (
    <View className="flex-1 bg-[#FAF9F6]">

      {/* Center Content */}
      <View className="flex-1 items-center justify-center px-8">

        {/* Logo Circle */}
        <View
          className="items-center justify-center rounded-full bg-white"
          style={{
            width: 160,
            height: 160,
            shadowColor: "#2E7D32",
            shadowOpacity: 0.12,
            shadowRadius: 20,
            shadowOffset: {
              width: 0,
              height: 10,
            },
            elevation: 10,
          }}
        >
          <Image
            source={require("../../assets/images/logo.png")}
            className="h-28 w-38"
            resizeMode="contain"
          />
        </View>

        {/* Brand */}
       <View className="mt-5 flex-row justify-center">
  <Text
    style={{
      fontFamily: "Poppins_800ExtraBold",
      color: "#FF9800",
      fontSize: 44,
    }}
  >
    My
  </Text>

  <Text
    style={{
      fontFamily: "Poppins_800ExtraBold",
      color: "#2E7D32",
      fontSize: 44,
    }}
  >
    Annadatha
  </Text>
</View>

        {/* <View className="mt-4 h-1 w-20 rounded-full bg-[#FF9800]" /> */}

        <Text className="mt-5 text-lg text-[#607D8B]">
          From our Farmers to Your Family
        </Text>

        <Text className="mt-2 text-center text-sm text-[#607D8B]">
          Fresh • Organic • Trusted
        </Text>
      </View>

      {/* Bottom Loading */}
      <View className="items-center pb-16">

        <ActivityIndicator
          size="large"
          color="#2E7D32"
        />

        <Text className="mt-4 text-base font-medium text-[#607D8B]">
          Preparing fresh experiences...
        </Text>

      </View>

    </View>
  );
}