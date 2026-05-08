import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createJob, getJob, listJobs, uploadVideo } from "lib/api/tours";
import type { Job } from "lib/api/tours";

export function useJobs(userId: string) {
  return useQuery({
    queryKey: ["jobs", userId],
    queryFn: () => listJobs(userId),
    enabled: !!userId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const hasActive = data.some((j) => j.status === "queued" || j.status === "running");
      return hasActive ? 5000 : false;
    },
  });
}

export function useJob(jobId: string | null) {
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: () => getJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data as Job | undefined;
      if (!data) return 5000;
      if (data.status === "done" || data.status === "failed") return false;
      return 5000;
    },
  });
}

export function useCreateAndUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      videoUri,
      userId,
      onProgress,
    }: {
      videoUri: string;
      userId?: string;
      onProgress?: (progress: number) => void;
    }) => {
      const { jobId, uploadUrl } = await createJob(userId);
      await uploadVideo(uploadUrl, videoUri, onProgress);
      return jobId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}
