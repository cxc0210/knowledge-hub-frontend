"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Bot, LoaderCircle, Send, Square, UserRound } from "lucide-react";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Streamdown } from "streamdown";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const INITIAL_MESSAGES: UIMessage[] = [
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

const CHAT_TRANSPORT = new DefaultChatTransport<UIMessage>({
  api: "/api/ai/chat/stream",
  credentials: "same-origin",
  prepareSendMessagesRequest({ messages }) {
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

    return { body: { prompt } };
  },
});

function getMessageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

export function AIChat() {
  const [prompt, setPrompt] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const { messages, sendMessage, status, error, stop, clearError } = useChat({
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

  async function sendPrompt() {
    const question = prompt.trim();

    if (!question || isSending) {
      return;
    }

    shouldAutoScrollRef.current = true;
    setPrompt("");
    clearError();
    await sendMessage({ text: question });
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
        {messages.map((message, index) => {
          const isUser = message.role === "user";
          const Icon = isUser ? UserRound : Bot;
          const content = getMessageText(message);
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
        {error ? (
          <p className="mb-2 px-1 text-sm text-destructive" role="alert">
            {error.message || "发送失败，请稍后重试"}
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
            type={isSending ? "button" : "submit"}
            size="icon-lg"
            className="mb-0.5 rounded-xl"
            disabled={!isSending && !prompt.trim()}
            onClick={isSending ? () => void stop() : undefined}
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
