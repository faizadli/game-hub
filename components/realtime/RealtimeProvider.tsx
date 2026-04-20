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
  BomberRealtimeState,
  GameCounts,
  GameSlug,
  PresenceUser,
  SnakeRealtimeState,
  TetrisInputAction,
  TetrisRealtimeState,
} from "@/lib/realtime/types";

type RealtimeContextValue = {
  connected: boolean;
  username: string;
  setUsername: (name: string) => void;
  selfId: string | null;
  users: PresenceUser[];
  counts: GameCounts;
  snakeState: SnakeRealtimeState | null;
  tetrisState: TetrisRealtimeState | null;
  bomberState: BomberRealtimeState | null;
  sendTetrisReady: (value: boolean) => void;
  sendSnakeReady: (value: boolean) => void;
  sendSnakeDirection: (dir: "up" | "down" | "left" | "right") => void;
  sendTetrisInput: (action: TetrisInputAction) => void;
  sendBomberReady: (value: boolean) => void;
  sendBomberDirection: (dir: "up" | "down" | "left" | "right") => void;
  sendBomberBomb: () => void;
};

const defaultCounts: GameCounts = {
  total: 0,
  hub: 0,
  snake: 0,
  tetris: 0,
  bomberman: 0,
  flappy: 0,
};

const Ctx = createContext<RealtimeContextValue | null>(null);

function toGame(pathname: string): GameSlug {
  if (pathname.startsWith("/games/snake")) return "snake";
  if (pathname.startsWith("/games/tetris")) return "tetris";
  if (pathname.startsWith("/games/bomberman")) return "bomberman";
  if (pathname.startsWith("/games/flappy")) return "flappy";
  return "hub";
}

function wsUrlFromBase(base: string): string {
  if (base.startsWith("ws://") || base.startsWith("wss://")) return `${base}/ws`;
  if (base.startsWith("http://")) return `ws://${base.slice("http://".length)}/ws`;
  if (base.startsWith("https://")) return `wss://${base.slice("https://".length)}/ws`;
  return `ws://${base}/ws`;
}

function getOrCreateSessionKey() {
  const key = "games_web_session_key";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(key, generated);
  return generated;
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
  const [tetrisState, setTetrisState] = useState<TetrisRealtimeState | null>(null);
  const [bomberState, setBomberState] = useState<BomberRealtimeState | null>(null);

  const setUsername = useCallback((name: string) => {
    const cleaned = name.trim().slice(0, 24);
    setUsernameState(cleaned);
    localStorage.setItem("games_web_username", cleaned);
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "hello",
          name: cleaned,
          session: getOrCreateSessionKey(),
        })
      );
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
      ws.send(
        JSON.stringify({
          type: "hello",
          name: username,
          session: getOrCreateSessionKey(),
        })
      );
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
        } else if (msg.type === "tetris_state") {
          setTetrisState(msg);
        } else if (msg.type === "bomber_state") {
          setBomberState(msg);
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
        setTetrisState(null);
        setBomberState(null);
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

  const sendTetrisReady = useCallback((value: boolean) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "tetris_ready", value }));
  }, []);

  const sendSnakeDirection = useCallback(
    (dir: "up" | "down" | "left" | "right") => {
      const ws = socketRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "direction", dir }));
    },
    []
  );

  const sendTetrisInput = useCallback((action: TetrisInputAction) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "tetris_input", action }));
  }, []);

  const sendBomberReady = useCallback((value: boolean) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "bomber_ready", value }));
  }, []);

  const sendBomberDirection = useCallback((dir: "up" | "down" | "left" | "right") => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "bomber_direction", dir }));
  }, []);

  const sendBomberBomb = useCallback(() => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "bomber_bomb" }));
  }, []);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      connected,
      username,
      setUsername,
      selfId,
      users,
      counts,
      snakeState,
      tetrisState,
      bomberState,
      sendTetrisReady,
      sendSnakeReady,
      sendSnakeDirection,
      sendTetrisInput,
      sendBomberReady,
      sendBomberDirection,
      sendBomberBomb,
    }),
    [
      connected,
      username,
      setUsername,
      selfId,
      users,
      counts,
      snakeState,
      tetrisState,
      bomberState,
      sendTetrisReady,
      sendSnakeReady,
      sendSnakeDirection,
      sendTetrisInput,
      sendBomberReady,
      sendBomberDirection,
      sendBomberBomb,
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
