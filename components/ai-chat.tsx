"use client";

import { Bot, LoaderCircle, Send, UserRound } from "lucide-react";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AIChatResponse } from "@/lib/ai";
import { cn } from "@/lib/utils";
import { HttpError, httpService } from "@/services/http";

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
};

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    role: "assistant",
    content: "你好，我是 Knowledge Hub AI。有什么问题想问我？",
  },
];

export function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const messageIdRef = useRef(INITIAL_MESSAGES.length + 1);
  const controllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => {
    return () => controllerRef.current?.abort();
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
    const controller = new AbortController();
    controllerRef.current = controller;
    setMessages((current) => [...current, userMessage]);
    setPrompt("");
    setError(null);
    setIsSending(true);

    try {
      const response = await httpService.post<AIChatResponse>(
        "ai/chat",
        { prompt: question },
        { signal: controller.signal },
      );

      if (!controller.signal.aborted) {
        setMessages((current) => [
          ...current,
          {
            id: messageIdRef.current++,
            role: "assistant",
            content: response.answer,
          },
        ]);
      }
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setError(
          requestError instanceof HttpError
            ? requestError.message
            : "发送失败，请稍后重试",
        );
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
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
                  "rounded-2xl px-4 py-3 text-sm leading-7 whitespace-pre-wrap sm:px-5",
                  isUser
                    ? "rounded-tr-sm bg-primary text-primary-foreground"
                    : "rounded-tl-sm bg-muted text-foreground",
                )}
              >
                {message.content}
              </div>
            </div>
          );
        })}

        {isSending ? (
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
