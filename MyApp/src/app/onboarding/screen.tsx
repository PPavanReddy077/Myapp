import { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Animated,
  Dimensions,
  ViewToken,
} from "react-native";
import { router } from "expo-router";
import { useFonts, Poppins_800ExtraBold, Poppins_600SemiBold, Poppins_400Regular } from "@expo-google-fonts/poppins";

const { width } = Dimensions.get("window");

const slides = [
  {
    id: "1",
    emoji: "🌾",
    title: "Farm Fresh,\nEvery Day",
    subtitle:
      "Handpicked produce delivered straight from farmers in your region — no middlemen, no cold storage delays.",
    accent: "#2E7D32",
    bg: "#F0F7F0",
    dotActive: "#2E7D32",
  },
  {
    id: "2",
    emoji: "🤝",
    title: "Support the\nFarmers",
    subtitle:
      "Every order goes directly to a local farmer's pocket. Fair prices, honest sourcing, and a community you can trust.",
    accent: "#FF9800",
    bg: "#FFF8EE",
    dotActive: "#FF9800",
  },
  {
    id: "3",
    emoji: "🚚",
    title: "Delivered to\nYour Door",
    subtitle:
      "Order by evening, get it by morning. Fresh groceries from field to family — as simple as that.",
    accent: "#2E7D32",
    bg: "#F0F7F0",
    dotActive: "#2E7D32",
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const [fontsLoaded] = useFonts({
    Poppins_800ExtraBold,
    Poppins_600SemiBold,
    Poppins_400Regular,
  });

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setCurrentIndex(viewableItems[0].index ?? 0);
      }
    }
  ).current;

  if (!fontsLoaded) return null;

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      router.replace("/auth/login");
    }
  };

  const handleSkip = () => {
    router.replace("/auth/login");
  };

  const activeSlide = slides[currentIndex];

  return (
    <View style={{ flex: 1, backgroundColor: "#FAF9F6" }}>
      {/* Skip */}
      <View
        style={{
          paddingTop: 56,
          paddingHorizontal: 24,
          alignItems: "flex-end",
        }}
      >
        {currentIndex < slides.length - 1 && (
          <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 14,
                color: "#90A4AE",
              }}
            >
              Skip
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item }) => (
          <View
            style={{
              width,
              alignItems: "center",
              paddingHorizontal: 32,
              paddingTop: 24,
            }}
          >
            {/* Illustration card */}
            <View
              style={{
                width: 220,
                height: 220,
                borderRadius: 110,
                backgroundColor: item.bg,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: item.accent,
                shadowOpacity: 0.15,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 12 },
                elevation: 8,
              }}
            >
              <Text style={{ fontSize: 96 }}>{item.emoji}</Text>
            </View>

            {/* Text */}
            <Text
              style={{
                fontFamily: "Poppins_800ExtraBold",
                fontSize: 36,
                color: "#1B2B1B",
                textAlign: "center",
                marginTop: 40,
                lineHeight: 44,
              }}
            >
              {item.title.split("\n").map((line: string, i: number) => (
                <Text key={i}>
                  {i === 1 ? (
                    <Text style={{ color: item.accent }}>{line}</Text>
                  ) : (
                    line
                  )}
                  {i === 0 ? "\n" : ""}
                </Text>
              ))}
            </Text>

            <Text
              style={{
                fontFamily: "Poppins_400Regular",
                fontSize: 15,
                color: "#607D8B",
                textAlign: "center",
                marginTop: 16,
                lineHeight: 24,
              }}
            >
              {item.subtitle}
            </Text>
          </View>
        )}
      />

      {/* Bottom */}
      <View
        style={{
          paddingBottom: 52,
          paddingHorizontal: 32,
          alignItems: "center",
          gap: 28,
        }}
      >
        {/* Dots */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {slides.map((_, i) => {
            const inputRange = [
              (i - 1) * width,
              i * width,
              (i + 1) * width,
            ];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: "clamp",
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: "clamp",
            });
            return (
              <Animated.View
                key={i}
                style={{
                  width: dotWidth,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: activeSlide.dotActive,
                  opacity,
                }}
              />
            );
          })}
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={0.85}
          style={{
            width: "100%",
            paddingVertical: 17,
            borderRadius: 16,
            backgroundColor:
              currentIndex === slides.length - 1 ? "#FF9800" : "#2E7D32",
            alignItems: "center",
            shadowColor:
              currentIndex === slides.length - 1 ? "#FF9800" : "#2E7D32",
            shadowOpacity: 0.3,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
          }}
        >
          <Text
            style={{
              fontFamily: "Poppins_600SemiBold",
              fontSize: 16,
              color: "#fff",
              letterSpacing: 0.3,
            }}
          >
            {currentIndex === slides.length - 1
              ? "Get Started"
              : "Next →"}
          </Text>
        </TouchableOpacity>

        {/* Login hint on last slide */}
        {currentIndex === slides.length - 1 && (
          <TouchableOpacity onPress={() => router.replace("/auth/login")}>
            <Text
              style={{
                fontFamily: "Poppins_400Regular",
                fontSize: 13,
                color: "#90A4AE",
              }}
            >
              Already have an account?{" "}
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  color: "#2E7D32",
                }}
              >
                Log in
              </Text>
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}