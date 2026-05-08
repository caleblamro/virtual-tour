import { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle, AlertCircle } from "lucide-react-native";
import { useJob } from "hooks/use-api/use-tours";

const STATUS_LABELS: Record<string, string> = {
  uploading: "Uploading video…",
  queued: "Waiting in queue…",
  running: "Processing your tour…",
  done: "Tour ready!",
  failed: "Processing failed",
};

const STATUS_SUBLABELS: Record<string, string> = {
  uploading: "Your video is being transferred",
  queued: "A GPU is being allocated",
  running: "Running COLMAP + 3D Gaussian Splat training",
  done: "Your walkable tour is ready",
  failed: "Something went wrong during processing",
};

export default function ProcessingScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const { data: job } = useJob(jobId ?? null);

  useEffect(() => {
    if (job?.status === "done") {
      // Auto-navigate after 1.5 seconds
      const t = setTimeout(() => router.replace(`/viewer/${jobId}`), 1500);
      return () => clearTimeout(t);
    }
  }, [job?.status]);

  const status = job?.status ?? "queued";
  const progress = job?.progress ?? 0;
  const isDone = status === "done";
  const isFailed = status === "failed";

  return (
    <View className="flex-1 bg-background items-center justify-center px-8 gap-8">
      {/* Icon */}
      <View className="items-center gap-4">
        {isDone ? (
          <CheckCircle size={64} className="text-green-500" />
        ) : isFailed ? (
          <AlertCircle size={64} className="text-destructive" />
        ) : (
          <View className="w-16 h-16 rounded-full border-4 border-muted border-t-primary" />
        )}

        <Text className="text-2xl font-bold text-foreground text-center">
          {STATUS_LABELS[status]}
        </Text>
        <Text className="text-muted-foreground text-center text-sm">
          {isFailed ? job?.error ?? STATUS_SUBLABELS.failed : STATUS_SUBLABELS[status]}
        </Text>
      </View>

      {/* Progress bar */}
      {!isFailed && (
        <View className="w-full gap-2">
          <View className="w-full h-3 bg-muted rounded-full overflow-hidden">
            <View
              className="h-full bg-primary rounded-full"
              style={{ width: `${progress}%` }}
            />
          </View>
          <Text className="text-xs text-muted-foreground text-center">{progress}%</Text>
        </View>
      )}

      {/* Steps */}
      {!isFailed && (
        <View className="w-full gap-2">
          {[
            { label: "Extract frames", threshold: 10 },
            { label: "COLMAP reconstruction", threshold: 35 },
            { label: "3DGS training (15k steps)", threshold: 90 },
            { label: "Format conversion", threshold: 100 },
          ].map(({ label, threshold }) => (
            <View key={label} className="flex-row items-center gap-3">
              <View
                className={`w-5 h-5 rounded-full items-center justify-center ${
                  progress >= threshold ? "bg-green-500" : "bg-muted border border-border"
                }`}
              >
                {progress >= threshold && <CheckCircle size={12} color="white" />}
              </View>
              <Text
                className={`text-sm ${progress >= threshold ? "text-foreground" : "text-muted-foreground"}`}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      {isFailed && (
        <View className="gap-3 w-full">
          <View className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
            <Text className="text-destructive text-sm font-medium mb-1">Reconstruction tip:</Text>
            <Text className="text-destructive/80 text-xs">
              COLMAP couldn't reconstruct the scene. Try filming with slower side-to-side motion,
              more overlap between steps, and no fast rotations.
            </Text>
          </View>
          <Pressable
            onPress={() => router.replace("/")}
            className="bg-primary rounded-xl py-3 items-center"
          >
            <Text className="text-primary-foreground font-semibold">Try Again</Text>
          </Pressable>
        </View>
      )}

      {isDone && (
        <Pressable
          onPress={() => router.replace(`/viewer/${jobId}`)}
          className="bg-primary rounded-xl py-3 px-8 items-center"
        >
          <Text className="text-primary-foreground font-semibold">Open Tour</Text>
        </Pressable>
      )}
    </View>
  );
}
