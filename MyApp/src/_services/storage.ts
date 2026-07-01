import AsyncStorage from "@react-native-async-storage/async-storage";

export const saveToken = async (token: string): Promise<void> => {
  await AsyncStorage.setItem("token", token);
};

export const getToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem("token"); 
};

export const removeToken = async (): Promise<void> => {
  await AsyncStorage.removeItem("token");
};
