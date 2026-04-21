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
  MazeRealtimeState,
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
  mazeState: MazeRealtimeState | null;
  sendTetrisReady: (value: boolean) => void;
  sendSnakeReady: (value: boolean) => void;
  sendSnakeDirection: (dir: "up" | "down" | "left" | "right") => void;
  sendTetrisInput: (action: TetrisInputAction) => void;
  sendBomberReady: (value: boolean) => void;
  sendBomberDirection: (dir: "up" | "down" | "left" | "right") => void;
  sendBomberBomb: () => void;
  sendMazeReady: (value: boolean) => void;
  sendMazeMove: (dir: "up" | "down" | "left" | "right") => void;
};

const defaultCounts: GameCounts = {
  total: 0,
  hub: 0,
  snake: 0,
  tetris: 0,
  bomberman: 0,
  flappy: 0,
  maze: 0,
};

const ACTIVITY_KEY = "games_web_last_activity_at";
const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

const Ctx = createContext<RealtimeContextValue | null>(null);

function toGame(pathname: string): GameSlug {
  if (pathname.startsWith("/games/snake")) return "snake";
  if (pathname.startsWith("/games/tetris")) return "tetris";
  if (pathname.startsWith("/games/bomberman")) return "bomberman";
  if (pathname.startsWith("/games/flappy")) return "flappy";
  if (pathname.startsWith("/games/maze")) return "maze";
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
  const idleCheckRef = useRef<number | null>(null);
  const helloSentRef = useRef(false);
  const lastActivityRef = useRef<number>(0);
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
  const [mazeState, setMazeState] = useState<MazeRealtimeState | null>(null);

  const resetRealtimeState = useCallback(() => {
    setSelfId(null);
    setUsers([]);
    setSnakeState(null);
    setTetrisState(null);
    setBomberState(null);
    setMazeState(null);
    setCounts(defaultCounts);
  }, []);

  const markActivity = useCallback((ts = Date.now()) => {
    lastActivityRef.current = ts;
    localStorage.setItem(ACTIVITY_KEY, String(ts));
  }, []);

  const expireIdentity = useCallback(() => {
    setConnected(false);
    setUsernameState("");
    resetRealtimeState();
    localStorage.removeItem("games_web_username");
    localStorage.removeItem("games_web_session_key");
    localStorage.removeItem(ACTIVITY_KEY);
    const ws = socketRef.current;
    if (ws) {
      ws.close();
      socketRef.current = null;
    }
  }, [resetRealtimeState]);

  const setUsername = useCallback((name: string) => {
    const cleaned = name.trim().slice(0, 24);
    setUsernameState(cleaned);
    localStorage.setItem("games_web_username", cleaned);
    if (cleaned) markActivity();
    else localStorage.removeItem(ACTIVITY_KEY);
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "hello",
          name: cleaned,
          session: getOrCreateSessionKey(),
        })
      );
    }
  }, [markActivity]);

  useEffect(() => {
    if (!username) return;

    const now = Date.now();
    const fromStorage = Number(localStorage.getItem(ACTIVITY_KEY) ?? "0");
    const initial = Number.isFinite(fromStorage) && fromStorage > 0 ? fromStorage : now;
    lastActivityRef.current = initial;

    if (now - initial >= IDLE_TIMEOUT_MS) {
      const expireTimer = window.setTimeout(() => {
        expireIdentity();
      }, 0);
      return () => window.clearTimeout(expireTimer);
    }

    markActivity(now);

    const onActivity = () => markActivity();
    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "touchstart",
      "mousedown",
      "scroll",
    ];
    for (const ev of activityEvents) {
      window.addEventListener(ev, onActivity, { passive: true });
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        onActivity();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    if (idleCheckRef.current) window.clearInterval(idleCheckRef.current);
    idleCheckRef.current = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
        expireIdentity();
      }
    }, 30000);

    return () => {
      for (const ev of activityEvents) {
        window.removeEventListener(ev, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      if (idleCheckRef.current) {
        window.clearInterval(idleCheckRef.current);
        idleCheckRef.current = null;
      }
    };
  }, [expireIdentity, markActivity, username]);

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
        } else if (msg.type === "maze_state") {
          setMazeState(msg);
        }
      } catch {
        // ignore malformed payload
      }
    };
    ws.onclose = () => {
      setConnected(false);
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      reconnectRef.current = window.setTimeout(() => {
        resetRealtimeState();
      }, 1200);
    };
    ws.onerror = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [resetRealtimeState, username]);

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

  const sendMazeReady = useCallback((value: boolean) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "maze_ready", value }));
  }, []);

  const sendMazeMove = useCallback((dir: "up" | "down" | "left" | "right") => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "maze_move", dir }));
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
      mazeState,
      sendTetrisReady,
      sendSnakeReady,
      sendSnakeDirection,
      sendTetrisInput,
      sendBomberReady,
      sendBomberDirection,
      sendBomberBomb,
      sendMazeReady,
      sendMazeMove,
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
      mazeState,
      sendTetrisReady,
      sendSnakeReady,
      sendSnakeDirection,
      sendTetrisInput,
      sendBomberReady,
      sendBomberDirection,
      sendBomberBomb,
      sendMazeReady,
      sendMazeMove,
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
