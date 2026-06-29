import { useLocalSearchParams, router } from "expo-router";
import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function LoginSuccess() {
  const { token } = useLocalSearchParams();

  useEffect(() => {
    async function saveToken() {
      if (token) {
        await AsyncStorage.setItem("token", token as string);
        router.replace("/");
      }
    }

    saveToken();
  }, [token]);

  return null;
}