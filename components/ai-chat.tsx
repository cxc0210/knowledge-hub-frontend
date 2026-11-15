"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  Bot,
  LoaderCircle,
  Mic,
  Send,
  Square,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Streamdown } from "streamdown";

import { EmailApprovalCard } from "@/components/email-approval-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSpeechPlayback } from "@/hooks/use-speech-playback";
import type { EmailAction } from "@/lib/ai-actions";
import { transcribeAudio } from "@/lib/speech";
import { cn } from "@/lib/utils";

const MAX_RECORDING_SECONDS = 5 * 60;
const RECORDING_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

type AIChatDataParts = {
  "email-approval": EmailAction;
};

type AIChatMessage = UIMessage<unknown, AIChatDataParts>;

const INITIAL_MESSAGES: AIChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "你好，我是 Knowledge Hub AI。有什么问题想问我？",
      },
    ],
  },
];

const CHAT_TRANSPORT = new DefaultChatTransport<AIChatMessage>({
  api: "/api/ai/chat/stream",
  credentials: "same-origin",
  prepareSendMessagesRequest({ messages, body }) {
    let prompt = "";

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];

      if (message.role === "user") {
        prompt = message.parts
          .map((part) => (part.type === "text" ? part.text : ""))
          .join("");
        break;
      }
    }

    return { body: { ...body, prompt } };
  },
});

function getMessageText(message: AIChatMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

export function AIChat() {
  const [prompt, setPrompt] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [emailActionOverrides, setEmailActionOverrides] = useState<
    Record<string, EmailAction>
  >({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const shouldTranscribeRef = useRef(false);
  const submitPendingRef = useRef(false);
  const {
    enabled: speechPlaybackEnabled,
    status: speechPlaybackStatus,
    error: speechPlaybackError,
    preparePlayback,
    stopPlayback,
    toggleEnabled: toggleSpeechPlayback,
  } = useSpeechPlayback();
  const { messages, sendMessage, status, error, stop, clearError } =
    useChat<AIChatMessage>({
      messages: INITIAL_MESSAGES,
      transport: CHAT_TRANSPORT,
      throttle: 45,
    });
  const isSending = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages, isSending]);

  useEffect(() => {
    if (!isSending) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [isSending]);

  useEffect(() => {
    return () => {
      shouldTranscribeRef.current = false;

      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }

      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());

      if (recordingTimerRef.current !== null) {
        window.clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  async function sendPrompt() {
    const question = prompt.trim();

    if (
      !question ||
      isSending ||
      isRecording ||
      isTranscribing ||
      submitPendingRef.current
    ) {
      return;
    }

    submitPendingRef.current = true;
    shouldAutoScrollRef.current = true;
    clearError();

    try {
      const requestId = crypto.randomUUID();
      const ttsReady = speechPlaybackEnabled
        ? await preparePlayback(requestId)
        : false;

      setPrompt("");
      await sendMessage(
        { text: question },
        {
          body: {
            request_id: ttsReady ? requestId : null,
            tts_enabled: ttsReady,
          },
        },
      );
    } catch {
      stopPlayback();
    } finally {
      submitPendingRef.current = false;
    }
  }

  function stopResponse() {
    stopPlayback();
    void stop();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendPrompt();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void sendPrompt();
    }
  }

  function clearRecordingTimer() {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  function releaseMicrophone() {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      return;
    }

    shouldTranscribeRef.current = true;
    recorder.stop();
  }

  async function transcribeRecording(audio: Blob) {
    setIsTranscribing(true);
    setSpeechError(null);

    try {
      const result = await transcribeAudio(audio);
      const text = result.text.trim();

      if (!text) {
        setSpeechError("没有识别到语音内容，请重新录制");
        return;
      }

      setPrompt((current) => {
        const existing = current.trim();
        return existing ? `${existing} ${text}` : text;
      });
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (error) {
      setSpeechError(
        error instanceof Error ? error.message : "语音识别失败，请稍后重试",
      );
    } finally {
      setIsTranscribing(false);
    }
  }

  async function startRecording() {
    if (isSending || isTranscribing) {
      return;
    }

    setSpeechError(null);

    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setSpeechError("当前浏览器不支持录音，请使用最新版 Chrome、Edge 或 Safari");
      return;
    }

    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const mimeType = RECORDING_MIME_TYPES.find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      shouldTranscribeRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const shouldTranscribe = shouldTranscribeRef.current;
        shouldTranscribeRef.current = false;
        mediaRecorderRef.current = null;
        setIsRecording(false);
        clearRecordingTimer();
        releaseMicrophone();

        if (!shouldTranscribe) {
          return;
        }

        const audio = new Blob(audioChunksRef.current, {
          type:
            recorder.mimeType ||
            audioChunksRef.current[0]?.type ||
            "audio/webm",
        });
        audioChunksRef.current = [];

        if (audio.size === 0) {
          setSpeechError("没有录制到音频，请重新尝试");
          return;
        }

        void transcribeRecording(audio);
      };

      recorder.onerror = () => {
        setSpeechError("录音过程中发生错误，请重新尝试");
      };

      recorder.start(1_000);
      setRecordingSeconds(0);
      setIsRecording(true);

      const startedAt = Date.now();
      recordingTimerRef.current = window.setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1_000);
        setRecordingSeconds(elapsedSeconds);

        if (elapsedSeconds >= MAX_RECORDING_SECONDS) {
          stopRecording();
        }
      }, 1_000);
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      releaseMicrophone();
      clearRecordingTimer();
      setIsRecording(false);
      setSpeechError(getRecordingErrorMessage(error));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
      <div
        className="table-scrollbar flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-7 sm:py-8"
        aria-live="polite"
        aria-label="聊天记录"
        onScroll={(event) => {
          const element = event.currentTarget;
          const distanceFromBottom =
            element.scrollHeight - element.scrollTop - element.clientHeight;
          shouldAutoScrollRef.current = distanceFromBottom < 80;
        }}
      >
        {messages.map((message, index) => {
          const isUser = message.role === "user";
          const Icon = isUser ? UserRound : Bot;
          const content = getMessageText(message);
          const emailApprovalParts = message.parts.filter(
            (part) => part.type === "data-email-approval",
          );
          const isLastMessage = index === messages.length - 1;
          const isStreamingMessage =
            !isUser && isLastMessage && status === "streaming";

          return (
            <div
              key={message.id}
              className={cn(
                "flex max-w-[88%] items-start gap-3 sm:max-w-[78%]",
                isUser && "ml-auto flex-row-reverse",
              )}
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl",
                  isUser
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent text-accent-foreground",
                )}
                aria-hidden="true"
              >
                <Icon className="size-4" />
              </span>
              <div
                className={cn(
                  "relative min-w-0 rounded-2xl px-4 py-3 text-sm leading-7 sm:px-5",
                  isUser
                    ? "rounded-tr-sm bg-primary text-primary-foreground whitespace-pre-wrap"
                    : "rounded-tl-sm bg-muted text-foreground",
                )}
              >
                {isUser ? (
                  content
                ) : content ? (
                  <Streamdown
                    animated
                    caret="circle"
                    className="markdown-preview ai-markdown"
                    isAnimating={isStreamingMessage}
                    mode={isStreamingMessage ? "streaming" : "static"}
                  >
                    {content}
                  </Streamdown>
                ) : null}
                {!isUser
                  ? emailApprovalParts.map((part) => {
                      const action =
                        emailActionOverrides[part.data.id] ?? part.data;
                      return (
                        <EmailApprovalCard
                          key={action.id}
                          action={action}
                          onChange={(updatedAction) =>
                            setEmailActionOverrides((current) => ({
                              ...current,
                              [updatedAction.id]: updatedAction,
                            }))
                          }
                        />
                      );
                    })
                  : null}
                {isStreamingMessage && !content ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" />
                    正在思考...
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}

        {status === "submitted" ? (
          <div className="flex max-w-[78%] items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
              <Bot className="size-4" />
            </span>
            <div className="flex h-12 items-center gap-2 rounded-2xl rounded-tl-sm bg-muted px-5 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              正在思考...
            </div>
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <form
        className="shrink-0 border-t border-border bg-card p-3 sm:p-4"
        onSubmit={handleSubmit}
      >
        {error || speechError || speechPlaybackError ? (
          <p className="mb-2 px-1 text-sm text-destructive" role="alert">
            {speechError ||
              speechPlaybackError ||
              error?.message ||
              "发送失败，请稍后重试"}
          </p>
        ) : null}

        {isRecording || isTranscribing ? (
          <p
            className={cn(
              "mb-2 px-1 text-xs",
              isRecording ? "text-destructive" : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {isRecording
              ? `正在录音 ${formatDuration(recordingSeconds)}，点击红色按钮结束`
              : "正在识别语音..."}
          </p>
        ) : null}

        {speechPlaybackStatus !== "idle" ? (
          <p
            className="mb-2 flex items-center gap-1.5 px-1 text-xs text-muted-foreground"
            aria-live="polite"
          >
            {speechPlaybackStatus === "speaking" ? (
              <Volume2 className="size-3.5 animate-pulse" />
            ) : (
              <LoaderCircle className="size-3.5 animate-spin" />
            )}
            {speechPlaybackStatus === "connecting"
              ? "正在连接语音服务..."
              : speechPlaybackStatus === "waiting"
                ? "等待语音合成..."
                : "正在朗读回答..."}
          </p>
        ) : null}

        <div className="flex items-end gap-2 rounded-xl border border-input bg-background p-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
          <Textarea
            ref={textareaRef}
            className="max-h-36 min-h-11 flex-1 border-0 bg-transparent px-2 py-2.5 shadow-none focus-visible:border-0 focus-visible:ring-0"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题，Enter 发送，Shift + Enter 换行"
            aria-label="输入问题"
            maxLength={20_000}
            rows={1}
            disabled={isSending || speechPlaybackStatus === "connecting"}
            autoFocus
          />
          <Button
            type="button"
            size="icon-lg"
            variant={speechPlaybackEnabled ? "secondary" : "ghost"}
            className={cn(
              "mb-0.5 rounded-xl",
              speechPlaybackStatus === "speaking" && "animate-pulse",
            )}
            onClick={() => void toggleSpeechPlayback()}
            aria-label={
              speechPlaybackEnabled ? "关闭自动朗读" : "开启自动朗读"
            }
            aria-pressed={speechPlaybackEnabled}
            title={
              speechPlaybackEnabled ? "关闭自动朗读" : "开启自动朗读"
            }
          >
            {speechPlaybackEnabled ? <Volume2 /> : <VolumeX />}
          </Button>
          <Button
            type="button"
            size="icon-lg"
            variant={isRecording ? "destructive" : "ghost"}
            className={cn(
              "mb-0.5 rounded-xl",
              isRecording && "animate-pulse",
            )}
            disabled={
              isSending ||
              isTranscribing ||
              speechPlaybackStatus === "connecting"
            }
            onClick={isRecording ? stopRecording : () => void startRecording()}
            aria-label={isRecording ? "停止录音" : "开始录音"}
            aria-pressed={isRecording}
            title={isRecording ? "停止录音" : "语音输入"}
          >
            {isTranscribing ? (
              <LoaderCircle className="animate-spin" />
            ) : isRecording ? (
              <Square className="size-3.5 fill-current" />
            ) : (
              <Mic />
            )}
          </Button>
          <Button
            type={isSending ? "button" : "submit"}
            size="icon-lg"
            className="mb-0.5 rounded-xl"
            disabled={
              !isSending &&
              (!prompt.trim() ||
                isRecording ||
                isTranscribing ||
                speechPlaybackStatus === "connecting")
            }
            onClick={isSending ? stopResponse : undefined}
            aria-label={isSending ? "停止生成" : "发送问题"}
          >
            {isSending ? (
              <Square className="size-3.5 fill-current" />
            ) : (
              <Send />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function getRecordingErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "麦克风权限被拒绝，请在浏览器设置中允许访问麦克风";
    }

    if (error.name === "NotFoundError") {
      return "没有找到可用的麦克风";
    }
  }

  return error instanceof Error ? error.message : "无法启动录音，请稍后重试";
}
