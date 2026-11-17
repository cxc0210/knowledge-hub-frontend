import { httpService } from "@/services/http";

const CONVERSATION_PAGE_SIZE = 100;
const MESSAGE_PAGE_SIZE = 200;

type PageResponse<T> = {
  items: T[];
  page: number;
  size: number;
  total: number;
  pages: number;
};

export type AIConversation = {
  id: string;
  user_id: number;
  title: string;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AIConversationMessage = {
  id: string;
  conversation_id: string;
  request_id: string;
  role: "user" | "assistant";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export function createAIConversation() {
  return httpService.post<AIConversation>("ai/conversations", {});
}

export function deleteAIConversation(conversationId: string) {
  return httpService.delete<void>(
    `ai/conversations/${encodeURIComponent(conversationId)}`,
  );
}

export async function listAllAIConversations(signal?: AbortSignal) {
  const firstPage = await httpService.get<PageResponse<AIConversation>>(
    `ai/conversations?page=1&size=${CONVERSATION_PAGE_SIZE}`,
    { signal },
  );

  if (firstPage.pages <= 1) {
    return firstPage.items;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.pages - 1 }, (_, index) =>
      httpService.get<PageResponse<AIConversation>>(
        `ai/conversations?page=${index + 2}&size=${CONVERSATION_PAGE_SIZE}`,
        { signal },
      ),
    ),
  );

  return [firstPage, ...remainingPages].flatMap((page) => page.items);
}

export async function listAllAIConversationMessages(
  conversationId: string,
  signal?: AbortSignal,
) {
  const path = `ai/conversations/${encodeURIComponent(conversationId)}/messages`;
  const firstPage = await httpService.get<PageResponse<AIConversationMessage>>(
    `${path}?page=1&size=${MESSAGE_PAGE_SIZE}`,
    { signal },
  );

  if (firstPage.pages <= 1) {
    return firstPage.items;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.pages - 1 }, (_, index) =>
      httpService.get<PageResponse<AIConversationMessage>>(
        `${path}?page=${index + 2}&size=${MESSAGE_PAGE_SIZE}`,
        { signal },
      ),
    ),
  );

  return [firstPage, ...remainingPages].flatMap((page) => page.items);
}
