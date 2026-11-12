type RequestOptions = Omit<RequestInit, "body" | "method">;

type ErrorPayload = {
  detail?: unknown;
  message?: unknown;
};

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

class HttpService {
  constructor(private readonly baseUrl: string) {}

  get<T>(path: string, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: "POST", body });
  }

  async postStream(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<ReadableStream<Uint8Array>> {
    const headers = new Headers(options?.headers);
    const hasBody = body !== undefined;

    if (hasBody && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    let response: Response;

    try {
      response = await fetch(this.resolveUrl(path), {
        ...options,
        method: "POST",
        headers,
        credentials: "same-origin",
        body: hasBody ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      throw new HttpError("暂时无法连接服务，请稍后重试", 0, error);
    }

    if (!response.ok) {
      const payload = await this.parseResponse(response);
      throw new HttpError(
        this.getErrorMessage(payload, response.status),
        response.status,
        payload,
      );
    }

    if (!response.body) {
      throw new HttpError("服务未返回可读取的响应流", response.status, null);
    }

    return response.body;
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: "PUT", body });
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: "PATCH", body });
  }

  delete<T>(path: string, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }

  private async request<T>(
    path: string,
    options: RequestOptions & { method: string; body?: unknown },
  ): Promise<T> {
    const { body, headers: customHeaders, ...requestOptions } = options;
    const headers = new Headers(customHeaders);
    const hasBody = body !== undefined;

    if (hasBody && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    let response: Response;

    try {
      response = await fetch(this.resolveUrl(path), {
        ...requestOptions,
        headers,
        credentials: "same-origin",
        body: hasBody ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      throw new HttpError("暂时无法连接服务，请稍后重试", 0, error);
    }

    const payload = await this.parseResponse(response);

    if (!response.ok) {
      throw new HttpError(
        this.getErrorMessage(payload, response.status),
        response.status,
        payload,
      );
    }

    return payload as T;
  }

  private resolveUrl(path: string) {
    return `${this.baseUrl}/${path.replace(/^\/+/, "")}`;
  }

  private async parseResponse(response: Response): Promise<unknown> {
    if (response.status === 204) {
      return undefined;
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      return response.json();
    }

    return response.text();
  }

  private getErrorMessage(payload: unknown, status: number) {
    if (payload && typeof payload === "object") {
      const errorPayload = payload as ErrorPayload;

      if (typeof errorPayload.detail === "string") {
        return errorPayload.detail;
      }

      if (typeof errorPayload.message === "string") {
        return errorPayload.message;
      }
    }

    return `请求失败 (${status})`;
  }
}

export const httpService = new HttpService("/api");
