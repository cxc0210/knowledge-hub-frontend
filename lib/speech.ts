import { httpService } from "@/services/http";

export type SpeechTranscription = {
  text: string;
  duration_seconds: number | null;
  request_id: string | null;
};

const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/aac": "aac",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "audio/x-m4a": "m4a",
  "audio/x-wav": "wav",
};

export function transcribeAudio(audio: Blob) {
  const formData = new FormData();
  const contentType = audio.type.split(";", 1)[0].toLowerCase();
  const extension = AUDIO_EXTENSIONS[contentType] ?? "webm";

  formData.append("file", audio, `recording-${Date.now()}.${extension}`);

  return httpService.postForm<SpeechTranscription>(
    "/speech/transcriptions",
    formData,
  );
}
