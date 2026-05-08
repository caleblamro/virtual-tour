export type JobStatus = 'uploading' | 'queued' | 'processing' | 'done' | 'failed';

export interface Job {
  jobId: string;
  userId: string;
  status: JobStatus;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  progress: number; // 0–100
  /** S3 key prefix under which outputs are stored (set when Batch job starts) */
  outputPrefix?: string;
  /** Error message when status === 'failed' */
  errorMessage?: string;
}

export interface OutputUrls {
  sog: string;
  collision: string;
  thumbnail: string;
}

export interface JobWithOutputs extends Job {
  outputUrls?: OutputUrls;
}
