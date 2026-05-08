import { api } from "./client";

export interface Job {
  jobId: string;
  userId: string;
  status: "uploading" | "queued" | "running" | "done" | "failed";
  progress: number;
  createdAt: string;
  updatedAt: string;
  outputPrefix?: string;
  errorMessage?: string;
  outputUrls?: {
    sog: string;
    collision: string;
    thumbnail: string;
  };
}

export interface CreateJobResponse {
  jobId: string;
  uploadUrl: string;
}

export async function createJob(userId?: string): Promise<CreateJobResponse> {
  return api.post<CreateJobResponse>("/jobs", { userId: userId ?? "anonymous" });
}

export async function getJob(jobId: string): Promise<Job> {
  return api.get<Job>(`/jobs/${jobId}`);
}

export async function listJobs(userId: string): Promise<Job[]> {
  return api.get<Job[]>("/jobs", { userId });
}

export async function uploadVideo(
  uploadUrl: string,
  videoUri: string,
  onProgress?: (progress: number) => void,
): Promise<void> {
  // Use XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", "video/mp4");

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Upload network error"));

    // React Native: fetch the blob from URI and send it
    fetch(videoUri)
      .then((r) => r.blob())
      .then((blob) => xhr.send(blob))
      .catch(reject);
  });
}
