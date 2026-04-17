"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import type {
  GameCounts,
  GameSlug,
  PresenceUser,
  SnakeRealtimeState,
} from "@/lib/realtime/types";

type RealtimeContextValue = {
  connected: boolean;
  username: string;
  setUsername: (name: string) => void;
  selfId: string | null;
  users: PresenceUser[];
  counts: GameCounts;
  snakeState: SnakeRealtimeState | null;
  sendSnakeReady: (value: boolean) => void;
  sendSnakeDirection: (dir: "up" | "down" | "left" | "right") => void;
};

const defaultCounts: GameCounts = {
  total: 0,
  hub: 0,
  snake: 0,
  tetris: 0,
  typing: 0,
  minecraft: 0,
};

const Ctx = createContext<RealtimeContextValue | null>(null);

function toGame(pathname: string): GameSlug {
  if (pathname.startsWith("/games/snake")) return "snake";
  if (pathname.startsWith("/games/tetris")) return "tetris";
  if (pathname.startsWith("/games/typing")) return "typing";
  if (pathname.startsWith("/games/minecraft")) return "minecraft";
  return "hub";
}

function wsUrlFromBase(base: string): string {
  if (base.startsWith("ws://") || base.startsWith("wss://")) return `${base}/ws`;
  if (base.startsWith("http://")) return `ws://${base.slice("http://".length)}/ws`;
  if (base.startsWith("https://")) return `wss://${base.slice("https://".length)}/ws`;
  return `ws://${base}/ws`;
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const helloSentRef = useRef(false);
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const [connected, setConnected] = useState(false);
  const [username, setUsernameState] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("games_web_username") ?? "";
  });
  const [selfId, setSelfId] = useState<string | null>(null);
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [counts, setCounts] = useState<GameCounts>(defaultCounts);
  const [snakeState, setSnakeState] = useState<SnakeRealtimeState | null>(null);

  const setUsername = useCallback((name: string) => {
    const cleaned = name.trim().slice(0, 24);
    setUsernameState(cleaned);
    localStorage.setItem("games_web_username", cleaned);
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "hello", name: cleaned }));
    }
  }, []);

  const sendPage = useCallback(() => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "page", page: pathname }));
  }, [pathname]);

  useEffect(() => {
    if (!username) return;
    const configured = process.env.NEXT_PUBLIC_REALTIME_WS_URL;
    const base =
      configured && configured.trim().length > 0
        ? configured
        : window.location.hostname === "localhost"
          ? "ws://127.0.0.1:8787"
          : "";
    if (!base) {
      return;
    }
    const ws = new WebSocket(wsUrlFromBase(base));
    socketRef.current = ws;
    helloSentRef.current = false;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "hello", name: username }));
      helloSentRef.current = true;
      ws.send(JSON.stringify({ type: "page", page: pathnameRef.current }));
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "welcome" && typeof msg.id === "string") {
          setSelfId(msg.id);
        } else if (msg.type === "name_ack" && typeof msg.name === "string") {
          setUsernameState((prev) => {
            if (prev === msg.name) return prev;
            localStorage.setItem("games_web_username", msg.name);
            return msg.name;
          });
        } else if (msg.type === "presence") {
          setUsers(Array.isArray(msg.users) ? msg.users : []);
          setCounts(msg.counts ?? defaultCounts);
        } else if (msg.type === "snake_state") {
          setSnakeState(msg);
        }
      } catch {
        // ignore malformed payload
      }
    };
    ws.onclose = () => {
      setConnected(false);
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      reconnectRef.current = window.setTimeout(() => {
        setSelfId(null);
        setSnakeState(null);
        setCounts(defaultCounts);
      }, 1200);
    };
    ws.onerror = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [username]);

  useEffect(() => {
    if (!connected || !helloSentRef.current) return;
    sendPage();
  }, [pathname, connected, sendPage]);

  const sendSnakeReady = useCallback((value: boolean) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "ready", value }));
  }, []);

  const sendSnakeDirection = useCallback(
    (dir: "up" | "down" | "left" | "right") => {
      const ws = socketRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "direction", dir }));
    },
    []
  );

  const value = useMemo<RealtimeContextValue>(
    () => ({
      connected,
      username,
      setUsername,
      selfId,
      users,
      counts,
      snakeState,
      sendSnakeReady,
      sendSnakeDirection,
    }),
    [
      connected,
      username,
      setUsername,
      selfId,
      users,
      counts,
      snakeState,
      sendSnakeReady,
      sendSnakeDirection,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRealtime() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useRealtime must be used inside RealtimeProvider");
  }
  return ctx;
}

export function useCurrentGame() {
  const pathname = usePathname();
  return toGame(pathname);
}
