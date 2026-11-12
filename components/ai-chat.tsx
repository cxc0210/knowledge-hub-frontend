"use client";

import { Bot, LoaderCircle, Send, UserRound } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AIStreamError, readAIChatStream } from "@/lib/ai";
import { cn } from "@/lib/utils";
import { HttpError, httpService } from "@/services/http";

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
};

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    role: "assistant",
    content: "你好，我是 Knowledge Hub AI。有什么问题想问我？",
  },
];

const STREAM_RENDER_INTERVAL_MS = 45;

function getStreamBatchSize(queueLength: number) {
  if (queueLength <= 4) {
    return queueLength;
  }

  return Math.min(18, Math.max(2, Math.ceil(queueLength * 0.2)));
}

function waitForStreamRenderTick(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(finish, STREAM_RENDER_INTERVAL_MS);

    function finish() {
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    }

    signal.addEventListener("abort", finish, { once: true });
  });
}

export function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const messageIdRef = useRef(INITIAL_MESSAGES.length + 1);
  const controllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages, isSending]);

  useEffect(() => {
    return () => {
      const controller = controllerRef.current;
      controllerRef.current = null;
      controller?.abort();
    };
  }, []);

  async function sendPrompt() {
    const question = prompt.trim();

    if (!question || isSending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: messageIdRef.current++,
      role: "user",
      content: question,
    };
    const assistantMessage: ChatMessage = {
      id: messageIdRef.current++,
      role: "assistant",
      content: "",
      isStreaming: true,
    };
    const controller = new AbortController();
    let receivedContent = "";
    let displayedContent = "";
    let streamFinished = false;
    const renderState: { wake: (() => void) | null } = { wake: null };
    const displayQueue: string[] = [];
    let renderTask: Promise<void> | null = null;
    controllerRef.current = controller;
    shouldAutoScrollRef.current = true;
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setPrompt("");
    setError(null);
    setIsSending(true);

    try {
      const stream = await httpService.postStream(
        "ai/chat/stream",
        { prompt: question },
        { signal: controller.signal },
      );

      renderTask = (async () => {
        while (
          !controller.signal.aborted &&
          (!streamFinished || displayQueue.length > 0)
        ) {
          if (!displayQueue.length) {
            await new Promise<void>((resolve) => {
              renderState.wake = resolve;
            });
            continue;
          }

          const nextText = displayQueue
            .splice(0, getStreamBatchSize(displayQueue.length))
            .join("");
          displayedContent += nextText;
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantMessage.id
                ? { ...message, content: message.content + nextText }
                : message,
            ),
          );
          await waitForStreamRenderTick(controller.signal);
        }
      })();

      try {
        await readAIChatStream(stream, (token) => {
          receivedContent += token;
          displayQueue.push(...Array.from(token));
          renderState.wake?.();
          renderState.wake = null;
        });
      } finally {
        streamFinished = true;
        renderState.wake?.();
        renderState.wake = null;
      }

      await renderTask;

      if (!receivedContent) {
        throw new AIStreamError("模型没有返回内容，请重试");
      }
    } catch (requestError) {
      streamFinished = true;
      renderState.wake?.();
      renderState.wake = null;
      await renderTask;

      if (!controller.signal.aborted) {
        if (!displayedContent) {
          setMessages((current) =>
            current.filter((message) => message.id !== assistantMessage.id),
          );
        }
        setError(
          requestError instanceof HttpError ||
            requestError instanceof AIStreamError
            ? requestError.message
            : "发送失败，请稍后重试",
        );
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessage.id
              ? { ...message, isStreaming: false }
              : message,
          ),
        );
        setIsSending(false);
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
    }
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
        {messages.map((message) => {
          const isUser = message.role === "user";
          const Icon = isUser ? UserRound : Bot;

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
                  message.content
                ) : message.content ? (
                  <article className="markdown-preview ai-markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  </article>
                ) : null}
                {message.isStreaming && !message.content ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" />
                    正在思考...
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      <form
        className="shrink-0 border-t border-border bg-card p-3 sm:p-4"
        onSubmit={handleSubmit}
      >
        {error ? (
          <p className="mb-2 px-1 text-sm text-destructive" role="alert">
            {error}
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
            disabled={isSending}
            autoFocus
          />
          <Button
            type="submit"
            size="icon-lg"
            className="mb-0.5 rounded-xl"
            disabled={!prompt.trim() || isSending}
            aria-label="发送问题"
          >
            {isSending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Send />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
