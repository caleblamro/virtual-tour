import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { Providers } from "components/layout/providers";
import "../lib/theme/global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <Providers>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="capture"
          options={{ headerShown: false, presentation: "fullScreenModal" }}
        />
        <Stack.Screen
          name="processing/[jobId]"
          options={{ title: "Processing", headerBackTitle: "Back" }}
        />
        <Stack.Screen
          name="viewer/[jobId]"
          options={{ title: "Virtual Tour", headerBackTitle: "Back" }}
        />
      </Stack>
    </Providers>
  );
}
