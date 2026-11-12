export type AIChatResponse = {
  answer: string;
};

export class AIStreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIStreamError";
  }
}

type AIStreamPayload = {
  content?: unknown;
  message?: unknown;
};

export async function readAIChatStream(
  stream: ReadableStream<Uint8Array>,
  onToken: (token: string) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = parseSSEFrame(frame);

        if (event?.type === "token" && typeof event.data.content === "string") {
          onToken(event.data.content);
        } else if (event?.type === "done") {
          completed = true;
        } else if (event?.type === "error") {
          throw new AIStreamError(
            typeof event.data.message === "string"
              ? event.data.message
              : "模型调用失败，请稍后重试",
          );
        }

        boundary = buffer.indexOf("\n\n");
      }

      if (done) {
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!completed) {
    throw new AIStreamError("回答意外中断，请重试");
  }
}

function parseSSEFrame(frame: string) {
  let type = "message";
  const dataLines: string[] = [];

  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) {
      type = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (!dataLines.length) {
    return null;
  }

  let data: AIStreamPayload;
  try {
    data = JSON.parse(dataLines.join("\n")) as AIStreamPayload;
  } catch {
    throw new AIStreamError("流式响应格式错误");
  }

  return { type, data };
}
