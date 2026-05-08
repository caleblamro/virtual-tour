import { FlatList, Pressable, Text, View, Image, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Plus, Video, CheckCircle, Clock, Loader, AlertCircle } from "lucide-react-native";
import { useJobs } from "hooks/use-api/use-tours";
import type { Job } from "lib/api/tours";

const USER_ID = "demo-user"; // MVP: no auth

function StatusIcon({ status }: { status: Job["status"] }) {
  const props = { size: 18 };
  if (status === "done") return <CheckCircle {...props} className="text-green-500" />;
  if (status === "failed") return <AlertCircle {...props} className="text-destructive" />;
  if (status === "running" || status === "queued") return <Loader {...props} className="text-primary" />;
  return <Clock {...props} className="text-muted-foreground" />;
}

function TourCard({ job, onPress }: { job: Job; onPress: () => void }) {
  const label = {
    uploading: "Uploading…",
    queued: "Queued",
    running: `Processing ${job.progress}%`,
    done: "Ready",
    failed: "Failed",
  }[job.status];

  return (
    <Pressable
      onPress={onPress}
      className="bg-card border border-border rounded-xl overflow-hidden mb-3 active:opacity-80"
    >
      {job.outputUrls?.thumbnail ? (
        <Image source={{ uri: job.outputUrls.thumbnail }} className="w-full h-44" resizeMode="cover" />
      ) : (
        <View className="w-full h-44 bg-muted items-center justify-center">
          <Video size={40} className="text-muted-foreground" />
        </View>
      )}
      <View className="p-4 flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="font-semibold text-foreground">Tour {job.jobId.slice(-6).toUpperCase()}</Text>
          <Text className="text-xs text-muted-foreground mt-0.5">
            {new Date(job.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-muted-foreground">{label}</Text>
          <StatusIcon status={job.status} />
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { data: jobs } = useJobs(USER_ID);

  function handleTourPress(job: Job) {
    if (job.status === "done") {
      router.push(`/viewer/${job.jobId}`);
    } else if (job.status === "failed") {
      Alert.alert("Processing Failed", job.errorMessage ?? "Unknown error");
    } else {
      router.push(`/processing/${job.jobId}`);
    }
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-card border-b border-border px-6 pt-14 pb-5">
        <Text className="text-2xl font-bold text-foreground">Virtual Tours</Text>
        <Text className="text-muted-foreground text-sm mt-1">Scan a space. Walk through it anywhere.</Text>
      </View>

      <FlatList
        data={jobs ?? []}
        keyExtractor={(j) => j.jobId}
        contentContainerClassName="p-4"
        renderItem={({ item }) => (
          <TourCard job={item} onPress={() => handleTourPress(item)} />
        )}
        ListEmptyComponent={
          <View className="items-center py-24 gap-4">
            <View className="bg-muted rounded-full p-5">
              <Video size={36} className="text-muted-foreground" />
            </View>
            <Text className="text-foreground font-semibold text-lg">No tours yet</Text>
            <Text className="text-muted-foreground text-sm text-center max-w-xs">
              Tap the button below to record your first walkthrough and create a virtual tour.
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <View className="absolute bottom-8 right-6">
        <Pressable
          onPress={() => router.push("/capture")}
          className="bg-primary rounded-full w-16 h-16 items-center justify-center shadow-lg active:opacity-80"
        >
          <Plus size={28} className="text-primary-foreground" />
        </Pressable>
      </View>
    </View>
  );
}
