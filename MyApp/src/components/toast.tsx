// ✅ toast.tsx — clean version
import { useRef, useImperativeHandle, forwardRef, useState } from "react";
import { Animated, Text } from "react-native";

export type ToastRef = {
    show: (message: string) => void;
};

type Props = {
    duration?: number;
};

const Toast = forwardRef<ToastRef, Props>(({ duration = 1500 }, ref) => {
    const [message, setMessage] = useState("");
    const toastAnim = useRef(new Animated.Value(0)).current;

    useImperativeHandle(ref, () => ({
        show: (msg: string) => {
            setMessage(msg);
            Animated.sequence([
                Animated.timing(toastAnim, {
                    toValue: 1,
                    duration: 350,
                    useNativeDriver: true,
                }),
                Animated.delay(duration),
                Animated.timing(toastAnim, {
                    toValue: 0,
                    duration: 350,
                    useNativeDriver: true,
                }),
            ]).start();
        },
    }));

    const translateY = toastAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-60, 0],
    });

    return (
        <Animated.View
            style={{
                position: "absolute",
                top: 56,
                right: 24,
                zIndex: 999,
                maxWidth: 280,
                opacity: toastAnim,
                transform: [{ translateY }],
                backgroundColor: "#1B5E20",
                borderRadius: 16,
                paddingVertical: 12,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                shadowColor: "#000",
                shadowOpacity: 0.18,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
                elevation: 8,
            }}
        >
            <Text style={{ fontSize: 18, marginRight: 8 }}>✅</Text>
            <Text
                style={{
                    fontFamily: "Poppins_600SemiBold", // already loaded by parent
                    fontSize: 12,
                    color: "#fff",
                    flex: 1,
                    flexWrap: "wrap",
                }}
            >
                {message}
            </Text>
        </Animated.View>
    );
});

export default Toast;