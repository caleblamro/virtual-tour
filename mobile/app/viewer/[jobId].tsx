import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Linking } from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams } from "expo-router";
import { ExternalLink } from "lucide-react-native";
import { useJob } from "hooks/use-api/use-tours";

const VIEWER_BASE =
  process.env.EXPO_PUBLIC_VIEWER_URL ?? "https://superspl.at/viewer/";

function buildViewerUrl(sogUrl: string, collisionUrl: string): string {
  const base = VIEWER_BASE.endsWith("/") ? VIEWER_BASE : `${VIEWER_BASE}/`;
  const params = new URLSearchParams({ content: sogUrl, collision: collisionUrl });
  return `${base}?${params.toString()}`;
}

export default function ViewerScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { data: job } = useJob(jobId ?? null);
  const [loading, setLoading] = useState(true);

  if (!job?.outputUrls) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const viewerUrl = buildViewerUrl(job.outputUrls.sog, job.outputUrls.collision);

  return (
    <View className="flex-1 bg-black">
      {loading && (
        <View className="absolute inset-0 z-10 bg-background items-center justify-center gap-4">
          <ActivityIndicator size="large" />
          <Text className="text-muted-foreground text-sm">Loading virtual tour…</Text>
        </View>
      )}
      <WebView
        source={{ uri: viewerUrl }}
        style={{ flex: 1 }}
        onLoadEnd={() => setLoading(false)}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        allowsFullscreenVideo
        originWhitelist={["*"]}
      />
      {/* Open in browser button */}
      <Pressable
        onPress={() => Linking.openURL(viewerUrl)}
        className="absolute top-4 right-4 bg-black/60 rounded-full p-2"
      >
        <ExternalLink size={20} color="white" />
      </Pressable>
    </View>
  );
}
