"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  Bot,
  LoaderCircle,
  MessageSquare,
  Mic,
  Plus,
  Send,
  Square,
  Trash2,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Streamdown } from "streamdown";

import { EmailApprovalCard } from "@/components/email-approval-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSpeechPlayback } from "@/hooks/use-speech-playback";
import type { EmailAction } from "@/lib/ai-actions";
import {
  createAIConversation,
  deleteAIConversation,
  listAllAIConversationMessages,
  listAllAIConversations,
  type AIConversation,
  type AIConversationMessage,
} from "@/lib/ai-conversations";
import { transcribeAudio } from "@/lib/speech";
import { cn } from "@/lib/utils";

const MAX_RECORDING_SECONDS = 5 * 60;
const RECORDING_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];
const ACTIVE_CONVERSATION_STORAGE_KEY =
  "knowledge-hub:active-conversation-id";

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

function createChatTransport(conversationId: string) {
  return new DefaultChatTransport<AIChatMessage>({
    api: `/api/ai/conversations/${encodeURIComponent(conversationId)}/chat/stream`,
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
}

function getMessageText(message: AIChatMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

function toAIChatMessages(messages: AIConversationMessage[]) {
  if (messages.length === 0) {
    return INITIAL_MESSAGES;
  }

  return messages.map<AIChatMessage>((message) => ({
    id: message.id,
    role: message.role,
    parts: [{ type: "text", text: message.content }],
  }));
}

function getErrorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatConversationTime(value: string | null) {
  if (!value) {
    return "暂无消息";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "时间未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function AIChat() {
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [initialMessages, setInitialMessages] = useState<
    AIChatMessage[] | null
  >(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState<
    string | null
  >(null);
  const [busyConversationId, setBusyConversationId] = useState<string | null>(
    null,
  );
  const [conversationError, setConversationError] = useState<string | null>(
    null,
  );
  const [messageError, setMessageError] = useState<string | null>(null);
  const [historyReloadKey, setHistoryReloadKey] = useState(0);

  const rememberActiveConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
    window.localStorage.setItem(
      ACTIVE_CONVERSATION_STORAGE_KEY,
      conversationId,
    );
  }, []);

  const refreshConversationList = useCallback(async () => {
    const items = await listAllAIConversations();
    setConversations(items);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function loadConversations() {
      setIsLoadingConversations(true);
      setConversationError(null);

      try {
        const items = await listAllAIConversations(controller.signal);
        if (!isActive) {
          return;
        }

        setConversations(items);
        const storedConversationId = window.localStorage.getItem(
          ACTIVE_CONVERSATION_STORAGE_KEY,
        );
        const nextConversation =
          items.find((item) => item.id === storedConversationId) ?? items[0];

        if (nextConversation) {
          rememberActiveConversation(nextConversation.id);
        } else {
          setActiveConversationId(null);
          window.localStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY);
        }
      } catch (error) {
        if (isActive && !controller.signal.aborted) {
          setConversationError(
            getErrorText(error, "会话列表加载失败，请稍后重试"),
          );
        }
      } finally {
        if (isActive) {
          setIsLoadingConversations(false);
        }
      }
    }

    void loadConversations();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [rememberActiveConversation]);

  useEffect(() => {
    if (!activeConversationId) {
      setInitialMessages(null);
      setMessageError(null);
      return;
    }

    const controller = new AbortController();
    let isActive = true;
    setInitialMessages(null);
    setMessageError(null);

    async function loadMessages() {
      try {
        const items = await listAllAIConversationMessages(
          activeConversationId!,
          controller.signal,
        );
        if (isActive) {
          setInitialMessages(toAIChatMessages(items));
        }
      } catch (error) {
        if (isActive && !controller.signal.aborted) {
          setMessageError(
            getErrorText(error, "聊天记录加载失败，请稍后重试"),
          );
        }
      }
    }

    void loadMessages();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [activeConversationId, historyReloadKey]);

  async function handleCreateConversation() {
    if (busyConversationId || isCreatingConversation) {
      return;
    }

    setIsCreatingConversation(true);
    setConversationError(null);

    try {
      const conversation = await createAIConversation();
      setConversations((current) => [
        conversation,
        ...current.filter((item) => item.id !== conversation.id),
      ]);
      rememberActiveConversation(conversation.id);
    } catch (error) {
      setConversationError(getErrorText(error, "新建会话失败，请稍后重试"));
    } finally {
      setIsCreatingConversation(false);
    }
  }

  async function handleDeleteConversation(conversation: AIConversation) {
    if (
      busyConversationId ||
      deletingConversationId ||
      !window.confirm(`确定删除会话“${conversation.title}”吗？`)
    ) {
      return;
    }

    setDeletingConversationId(conversation.id);
    setConversationError(null);

    try {
      await deleteAIConversation(conversation.id);
      const remaining = conversations.filter(
        (item) => item.id !== conversation.id,
      );
      setConversations(remaining);

      if (activeConversationId === conversation.id) {
        const nextConversation = remaining[0];
        if (nextConversation) {
          rememberActiveConversation(nextConversation.id);
        } else {
          setActiveConversationId(null);
          setInitialMessages(null);
          window.localStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY);
        }
      }
    } catch (error) {
      setConversationError(getErrorText(error, "删除会话失败，请稍后重试"));
    } finally {
      setDeletingConversationId(null);
    }
  }

  const handleBusyChange = useCallback(
    (conversationId: string, isBusy: boolean) => {
      setBusyConversationId((current) => {
        if (isBusy) {
          return conversationId;
        }
        return current === conversationId ? null : current;
      });
    },
    [],
  );

  const handleConversationChanged = useCallback(async () => {
    try {
      await refreshConversationList();
    } catch {
      // The message is already visible. A later page load can refresh its title.
    }
  }, [refreshConversationList]);

  return (
    <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-1">
      <aside className="flex max-h-44 min-h-0 flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10 lg:max-h-none">
        <div className="flex items-center justify-between border-b border-border px-3 py-3">
          <div>
            <strong className="block text-sm">会话</strong>
            <span className="text-[11px] text-muted-foreground">
              {conversations.length} 个会话
            </span>
          </div>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="rounded-xl"
            disabled={Boolean(busyConversationId) || isCreatingConversation}
            onClick={() => void handleCreateConversation()}
            aria-label="新建会话"
            title="新建会话"
          >
            {isCreatingConversation ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Plus />
            )}
          </Button>
        </div>

        {conversationError ? (
          <p className="px-3 pt-2 text-xs text-destructive" role="alert">
            {conversationError}
          </p>
        ) : null}

        <div className="table-scrollbar flex min-h-0 gap-2 overflow-auto p-2 lg:flex-1 lg:flex-col">
          {isLoadingConversations ? (
            <div className="flex min-w-52 items-center gap-2 rounded-xl bg-muted px-3 py-3 text-xs text-muted-foreground lg:min-w-0">
              <LoaderCircle className="size-4 animate-spin" />
              正在加载会话...
            </div>
          ) : conversations.length === 0 ? (
            <button
              type="button"
              className="min-w-52 rounded-xl border border-dashed border-border px-3 py-4 text-left text-xs text-muted-foreground hover:bg-muted lg:min-w-0"
              onClick={() => void handleCreateConversation()}
            >
              还没有会话，点击这里开始
            </button>
          ) : (
            conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;
              const isDeleting =
                conversation.id === deletingConversationId;

              return (
                <div
                  key={conversation.id}
                  className={cn(
                    "flex min-w-52 items-center rounded-xl transition-colors lg:min-w-0",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/70 hover:bg-muted",
                  )}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left"
                    disabled={Boolean(busyConversationId)}
                    onClick={() =>
                      rememberActiveConversation(conversation.id)
                    }
                    aria-current={isActive ? "true" : undefined}
                  >
                    <MessageSquare className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-xs font-semibold">
                        {conversation.title}
                      </strong>
                      <span
                        className={cn(
                          "block truncate text-[10px]",
                          isActive
                            ? "text-primary-foreground/65"
                            : "text-muted-foreground",
                        )}
                      >
                        {formatConversationTime(
                          conversation.last_message_at,
                        )}
                      </span>
                    </span>
                  </button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className={cn(
                      "mr-1 shrink-0 rounded-lg",
                      isActive &&
                        "text-primary-foreground hover:bg-white/10 hover:text-primary-foreground",
                    )}
                    disabled={Boolean(busyConversationId) || isDeleting}
                    onClick={() =>
                      void handleDeleteConversation(conversation)
                    }
                    aria-label={`删除会话${conversation.title}`}
                    title="删除会话"
                  >
                    {isDeleting ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <Trash2 />
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0">
        {activeConversationId && initialMessages ? (
          <ConversationChat
            key={activeConversationId}
            conversationId={activeConversationId}
            initialMessages={initialMessages}
            onBusyChange={handleBusyChange}
            onConversationChanged={handleConversationChanged}
          />
        ) : activeConversationId && messageError ? (
          <div className="grid min-h-0 flex-1 place-items-center rounded-2xl bg-card p-6 text-center ring-1 ring-foreground/10">
            <div>
              <p className="text-sm text-destructive">{messageError}</p>
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={() => setHistoryReloadKey((current) => current + 1)}
              >
                重新加载
              </Button>
            </div>
          </div>
        ) : activeConversationId ? (
          <div className="grid min-h-0 flex-1 place-items-center rounded-2xl bg-card text-sm text-muted-foreground ring-1 ring-foreground/10">
            <span className="flex items-center gap-2">
              <LoaderCircle className="size-4 animate-spin" />
              正在加载聊天记录...
            </span>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 place-items-center rounded-2xl bg-card p-6 text-center ring-1 ring-foreground/10">
            <div>
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
                <Bot className="size-5" />
              </span>
              <h2 className="mt-3 font-semibold">开始一个新会话</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                每个会话都会单独保存聊天记录。
              </p>
              <Button
                type="button"
                className="mt-4"
                disabled={isCreatingConversation}
                onClick={() => void handleCreateConversation()}
              >
                <Plus />
                新建会话
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type ConversationChatProps = {
  conversationId: string;
  initialMessages: AIChatMessage[];
  onBusyChange: (conversationId: string, isBusy: boolean) => void;
  onConversationChanged: () => Promise<void>;
};

function ConversationChat({
  conversationId,
  initialMessages,
  onBusyChange,
  onConversationChanged,
}: ConversationChatProps) {
  const chatTransport = useMemo(
    () => createChatTransport(conversationId),
    [conversationId],
  );
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
      id: conversationId,
      messages: initialMessages,
      transport: chatTransport,
      throttle: 45,
    });
  const isSending = status === "submitted" || status === "streaming";

  useEffect(() => {
    onBusyChange(conversationId, isSending);
  }, [conversationId, isSending, onBusyChange]);

  useEffect(() => {
    return () => onBusyChange(conversationId, false);
  }, [conversationId, onBusyChange]);

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
      await onConversationChanged();
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
