import { useRef, useState, useEffect } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { Video, X } from "lucide-react-native";
import { useCreateAndUpload } from "hooks/use-api/use-tours";

const USER_ID = "demo-user";
const MAX_DURATION_S = 90;
const MIN_DURATION_S = 15;

type RecordingState = "idle" | "recording" | "uploading";

export default function CaptureScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { mutateAsync: createAndUpload } = useCreateAndUpload();

  // Request permissions on mount
  useEffect(() => {
    (async () => {
      if (!cameraPermission?.granted) await requestCameraPermission();
      if (!micPermission?.granted) await requestMicPermission();
    })();
  }, []);

  // Timer
  useEffect(() => {
    if (recordingState === "recording") {
      intervalRef.current = setInterval(() => {
        setElapsed((e) => {
          if (e + 1 >= MAX_DURATION_S) {
            stopRecording();
            return e + 1;
          }
          return e + 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [recordingState]);

  async function startRecording() {
    if (!cameraRef.current) return;
    setElapsed(0);
    setRecordingState("recording");
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: MAX_DURATION_S });
      if (video?.uri) await handleUpload(video.uri);
    } catch (e) {
      setRecordingState("idle");
      Alert.alert("Recording Error", String(e));
    }
  }

  async function stopRecording() {
    if (!cameraRef.current) return;
    cameraRef.current.stopRecording();
  }

  async function handleUpload(uri: string) {
    if (elapsed < MIN_DURATION_S) {
      Alert.alert(
        "Too Short",
        `Please record at least ${MIN_DURATION_S} seconds for best results.`,
        [{ text: "OK", onPress: () => setRecordingState("idle") }],
      );
      return;
    }
    setRecordingState("uploading");
    setUploadProgress(0);
    try {
      const jobId = await createAndUpload({
        videoUri: uri,
        userId: USER_ID,
        onProgress: setUploadProgress,
      });
      router.replace(`/processing/${jobId}`);
    } catch (e) {
      Alert.alert("Upload Failed", String(e));
      setRecordingState("idle");
    }
  }

  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");

  if (!cameraPermission?.granted || !micPermission?.granted) {
    return (
      <View className="flex-1 bg-black items-center justify-center gap-4 px-8">
        <Video size={48} color="white" />
        <Text className="text-white text-xl font-semibold text-center">Camera Access Needed</Text>
        <Text className="text-white/70 text-center">
          Grant camera and microphone permissions to record a virtual tour.
        </Text>
        <Pressable
          onPress={async () => {
            await requestCameraPermission();
            await requestMicPermission();
          }}
          className="bg-white rounded-full px-6 py-3"
        >
          <Text className="text-black font-semibold">Grant Permissions</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <Text className="text-white/50">Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing="back"
        mode="video"
        videoQuality="1080p"
      />

      {/* Overlay */}
      <View className="absolute inset-0 pointer-events-none">
        {/* Top bar */}
        <View className="absolute top-0 left-0 right-0 bg-black/50 pt-14 pb-4 px-6 flex-row items-center justify-between">
          <Pressable
            className="pointer-events-auto"
            onPress={() => {
              if (recordingState === "recording") stopRecording();
              else router.back();
            }}
          >
            <X size={24} color="white" />
          </Pressable>
          {recordingState === "recording" && (
            <View className="flex-row items-center gap-2">
              <View className="w-3 h-3 rounded-full bg-red-500" />
              <Text className="text-white font-mono text-lg">{mins}:{secs}</Text>
            </View>
          )}
          <View className="w-8" />
        </View>

        {/* Coach tips */}
        {recordingState === "idle" && (
          <View className="absolute bottom-40 left-6 right-6 gap-2">
            {[
              "Walk slowly — translate sideways, don't just rotate",
              "Keep 80% overlap between steps",
              "Turn on lights; avoid mixed sun/shadow",
              "No moving people, pets, or fans",
              "1080p 30fps — 30–90 seconds is ideal",
            ].map((tip) => (
              <View key={tip} className="bg-black/60 rounded-lg px-4 py-2">
                <Text className="text-white text-xs">{tip}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Uploading overlay */}
        {recordingState === "uploading" && (
          <View className="absolute inset-0 bg-black/70 items-center justify-center gap-4">
            <Text className="text-white text-xl font-semibold">Uploading…</Text>
            <View className="w-48 h-2 bg-white/20 rounded-full overflow-hidden">
              <View
                className="h-full bg-white rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
            </View>
            <Text className="text-white/70">{uploadProgress}%</Text>
          </View>
        )}

        {/* Record button */}
        {recordingState !== "uploading" && (
          <View className="absolute bottom-16 left-0 right-0 items-center">
            <Pressable
              className="pointer-events-auto"
              onPress={recordingState === "idle" ? startRecording : stopRecording}
            >
              {recordingState === "idle" ? (
                <View className="w-20 h-20 rounded-full border-4 border-white items-center justify-center">
                  <View className="w-14 h-14 rounded-full bg-red-500" />
                </View>
              ) : (
                <View className="w-20 h-20 rounded-full border-4 border-white items-center justify-center">
                  <View className="w-8 h-8 rounded-sm bg-white" />
                </View>
              )}
            </Pressable>
            {recordingState === "idle" && (
              <Text className="text-white/70 text-sm mt-3">Tap to start recording</Text>
            )}
            {recordingState === "recording" && elapsed < MAX_DURATION_S - 10 && (
              <Text className="text-white/70 text-sm mt-3">Tap to stop</Text>
            )}
            {recordingState === "recording" && elapsed >= MAX_DURATION_S - 10 && (
              <Text className="text-red-400 text-sm mt-3">Auto-stopping soon…</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
