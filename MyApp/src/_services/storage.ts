import AsyncStorage from "@react-native-async-storage/async-storage";

// 1. Saves the token string
export const saveToken = async (token: string): Promise<void> => {
  await AsyncStorage.setItem("token", token);
};

// 2. Retrieves the token (returns string or null)
export const getToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem("token"); // Removed redundant await
};

// 3. Deletes the token
export const removeToken = async (): Promise<void> => {
  await AsyncStorage.removeItem("token");
};
