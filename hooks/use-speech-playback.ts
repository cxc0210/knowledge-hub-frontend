"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { StreamingPcmPlayer } from "@/lib/streaming-pcm-player";

const ENABLED_STORAGE_KEY = "knowledge-hub:tts-enabled";
const CONNECTION_TIMEOUT_MS = 5_000;

type SpeechPlaybackStatus =
  | "idle"
  | "connecting"
  | "waiting"
  | "speaking";

type SpeechControlMessage = {
  type?: unknown;
  message?: unknown;
  sample_rate?: unknown;
};

export function useSpeechPlayback() {
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState<SpeechPlaybackStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<StreamingPcmPlayer | null>(null);
  const providerFinishedRef = useRef(false);
  const finishPlaybackRef = useRef<() => void>(() => undefined);

  const finishPlayback = useCallback(() => {
    const socket = socketRef.current;
    socketRef.current = null;
    providerFinishedRef.current = false;
    if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close(1000, "playback finished");
    }
    setStatus("idle");
  }, []);
  finishPlaybackRef.current = finishPlayback;

  const getPlayer = useCallback(() => {
    if (!playerRef.current) {
      playerRef.current = new StreamingPcmPlayer(() => {
        if (providerFinishedRef.current) {
          finishPlaybackRef.current();
        }
      });
    }
    return playerRef.current;
  }, []);

  const stopPlayback = useCallback(() => {
    const socket = socketRef.current;
    socketRef.current = null;
    providerFinishedRef.current = false;

    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "stop" }));
    }
    if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close(1000, "playback stopped");
    }

    playerRef.current?.stop();
    setStatus("idle");
  }, []);

  const preparePlayback = useCallback(
    async (requestId: string) => {
      if (!enabled) {
        return false;
      }

      stopPlayback();
      setError(null);
      setStatus("connecting");

      try {
        await getPlayer().unlock();
      } catch {
        setError("浏览器阻止了音频播放，请点击朗读按钮后重试");
        setStatus("idle");
        return false;
      }

      const socket = new WebSocket(buildSpeechWebSocketUrl(requestId));
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;
      providerFinishedRef.current = false;

      return new Promise<boolean>((resolve) => {
        let resolved = false;
        const resolveOnce = (value: boolean) => {
          if (resolved) {
            return;
          }
          resolved = true;
          window.clearTimeout(timeout);
          resolve(value);
        };
        const timeout = window.setTimeout(() => {
          if (socketRef.current === socket) {
            socketRef.current = null;
          }
          socket.close();
          setError("语音服务连接超时，文字回答仍可正常使用");
          setStatus("idle");
          resolveOnce(false);
        }, CONNECTION_TIMEOUT_MS);

        socket.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            getPlayer().enqueuePcm(event.data);
            setStatus("speaking");
            return;
          }

          if (typeof event.data !== "string") {
            return;
          }

          const message = parseControlMessage(event.data);
          if (!message) {
            return;
          }

          if (message.type === "ready") {
            if (typeof message.sample_rate === "number") {
              getPlayer().configure(message.sample_rate);
            }
            setStatus("waiting");
            resolveOnce(true);
          } else if (message.type === "started") {
            setStatus("waiting");
          } else if (message.type === "finished") {
            providerFinishedRef.current = true;
            if (getPlayer().isIdle) {
              finishPlayback();
            }
          } else if (message.type === "stopped") {
            finishPlayback();
          } else if (message.type === "error") {
            setError(
              typeof message.message === "string"
                ? message.message
                : "语音合成失败，请稍后重试",
            );
            getPlayer().stop();
            finishPlayback();
            resolveOnce(false);
          }
        };

        socket.onerror = () => {
          if (!resolved) {
            setError("无法连接语音服务，文字回答仍可正常使用");
            setStatus("idle");
            resolveOnce(false);
          }
        };

        socket.onclose = () => {
          if (socketRef.current !== socket) {
            return;
          }

          socketRef.current = null;
          if (!providerFinishedRef.current && resolved) {
            getPlayer().stop();
            setError("语音连接意外中断");
          }
          setStatus("idle");
          resolveOnce(false);
        };
      });
    },
    [enabled, finishPlayback, getPlayer, stopPlayback],
  );

  const toggleEnabled = useCallback(async () => {
    const nextEnabled = !enabled;
    setEnabled(nextEnabled);
    window.localStorage.setItem(
      ENABLED_STORAGE_KEY,
      nextEnabled ? "true" : "false",
    );
    setError(null);

    if (nextEnabled) {
      try {
        await getPlayer().unlock();
      } catch {
        setEnabled(false);
        window.localStorage.setItem(ENABLED_STORAGE_KEY, "false");
        setError("浏览器阻止了音频播放，请检查站点声音权限");
      }
    } else {
      stopPlayback();
    }
  }, [enabled, getPlayer, stopPlayback]);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(ENABLED_STORAGE_KEY);
    if (storedValue !== null) {
      setEnabled(storedValue === "true");
    }

    return () => {
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket && socket.readyState < WebSocket.CLOSING) {
        socket.close(1000, "component unmounted");
      }
      void playerRef.current?.close();
    };
  }, []);

  return {
    enabled,
    status,
    error,
    preparePlayback,
    stopPlayback,
    toggleEnabled,
  };
}

function parseControlMessage(value: string): SpeechControlMessage | null {
  try {
    const message = JSON.parse(value) as unknown;
    return message && typeof message === "object"
      ? (message as SpeechControlMessage)
      : null;
  } catch {
    return null;
  }
}

function buildSpeechWebSocketUrl(requestId: string) {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL?.replace(
    /\/$/,
    "",
  );
  if (configuredBaseUrl) {
    return `${configuredBaseUrl}/ai/speech/${encodeURIComponent(requestId)}`;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const isLocal = ["localhost", "127.0.0.1"].includes(
    window.location.hostname,
  );
  const host = isLocal
    ? `${window.location.hostname}:8000`
    : window.location.host;
  return `${protocol}//${host}/ai/speech/${encodeURIComponent(requestId)}`;
}
