"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useKeyboardState } from "@/lib/game/useKeyboardState";
import { useRafTicker } from "@/lib/game/useRafTicker";

const SCREEN_W = 960;
const SCREEN_H = 640;
const DANGER_Y = SCREEN_H - 110;

type Enemy = { id: number; word: string; x: number; y: number };
type Phase = "menu" | "playing" | "level_complete" | "game_over" | "victory";
type LevelConfig = {
  nama: string;
  killsTarget: number;
  spawnIntervalMs: number;
  fallSpeed: number;
  maxOnScreen: number;
  words: string[];
};

const COLORS = {
  bg: "#121620",
  ui: "#dce0eb",
  accent: "#5ac8a0",
  warn: "#f07864",
  target: "#ffdc78",
  enemy: "#a0aac8",
  line: "#505a78",
  progress: "#468cdc",
  overlay: "#0a0c12",
  targetPad: "#3c3220",
};

function buildLevels(): LevelConfig[] {
  const mudah = [
    "apel",
    "bola",
    "citra",
    "duka",
    "elok",
    "film",
    "gula",
    "hutan",
    "ikan",
    "jalan",
    "kopi",
    "lidah",
    "mobil",
    "nasi",
    "obat",
    "pintu",
    "radio",
    "sudut",
    "taman",
    "ular",
  ];
  const sedang = [
    "bangun",
    "cetak",
    "duduk",
    "empat",
    "fajar",
    "gerak",
    "hujan",
    "istana",
    "jaket",
    "kalung",
    "lampu",
    "meja",
    "nomor",
    "orang",
    "pagar",
    "qasidah",
    "roti",
    "sandal",
    "topi",
    "unggas",
  ];
  const panjang = [
    "komputer",
    "mengetik",
    "belajar",
    "membaca",
    "menulis",
    "keyboard",
    "layar",
    "kalimat",
    "huruf",
    "gambar",
    "jendela",
    "kursi",
    "lemari",
    "monitor",
    "speaker",
    "printer",
    "internet",
    "website",
    "password",
    "folder",
  ];
  const frasa = [
    "satu dua tiga",
    "saya suka python",
    "belajar itu menyenangkan",
    "tekan tombol dengan benar",
    "jangan sampai salah ketik",
    "musuh akan turun perlahan",
    "ketik cepat dan tepat",
    "pertahanan garis bawah",
    "kemenangan butuh fokus",
    "bahasa indonesia indah",
    "pemrograman itu seni",
    "semangat pagi hari",
    "kopi dan kode",
    "tidur cukup penting",
    "debug dengan sabar",
    "error adalah guru",
    "commit lalu push",
    "pull request siap",
    "merge tanpa konflik",
    "deploy ke produksi",
  ];
  const boss = [
    "final boss mengetik panjang sekali",
    "pertempuran terakhir lawan kata rumit",
    "jangan panik tetap tenang dan fokus",
    "kemenangan milik yang tidak menyerah",
    "selamat anda telah menyelesaikan semua level",
  ];
  return [
    {
      nama: "Pembuka — kata pendek",
      killsTarget: 10,
      spawnIntervalMs: 2200,
      fallSpeed: 0.55,
      maxOnScreen: 3,
      words: mudah,
    },
    {
      nama: "Latihan — sedang",
      killsTarget: 12,
      spawnIntervalMs: 1900,
      fallSpeed: 0.72,
      maxOnScreen: 4,
      words: [...mudah, ...sedang],
    },
    {
      nama: "Makin cepat",
      killsTarget: 14,
      spawnIntervalMs: 1600,
      fallSpeed: 0.88,
      maxOnScreen: 4,
      words: [...sedang, ...panjang],
    },
    {
      nama: "Frasa & fokus",
      killsTarget: 16,
      spawnIntervalMs: 1400,
      fallSpeed: 1.0,
      maxOnScreen: 5,
      words: [...panjang, ...frasa],
    },
    {
      nama: "FINAL — sang pengetik",
      killsTarget: 18,
      spawnIntervalMs: 1200,
      fallSpeed: 1.15,
      maxOnScreen: 5,
      words: [...frasa, ...boss],
    },
  ];
}

export function TypingShooterGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levels = useRef(buildLevels());

  const phaseRef = useRef<Phase>("menu");
  const levelIndexRef = useRef(0);
  const enemiesRef = useRef<Enemy[]>([]);
  const typedRef = useRef("");
  const hpRef = useRef(100);
  const killsRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const spawningActiveRef = useRef(true);
  const idRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("menu");
  const [levelIndex, setLevelIndex] = useState(0);
  const [hp, setHp] = useState(100);
  const [kills, setKills] = useState(0);
  const [typedBuffer, setTypedBuffer] = useState("");

  const currentLevel = useCallback(
    () => levels.current[levelIndexRef.current],
    []
  );

  const targetEnemy = useCallback(() => {
    if (!enemiesRef.current.length) return null;
    return enemiesRef.current.reduce((a, b) => (a.y > b.y ? a : b));
  }, []);

  const resetLevel = useCallback(() => {
    enemiesRef.current = [];
    typedRef.current = "";
    spawnTimerRef.current = 0;
    spawningActiveRef.current = true;
    killsRef.current = 0;
    setKills(0);
    setTypedBuffer("");
  }, []);

  const resetGame = useCallback(() => {
    levelIndexRef.current = 0;
    setLevelIndex(0);
    hpRef.current = 100;
    setHp(100);
    resetLevel();
  }, [resetLevel]);

  const spawnEnemy = useCallback(() => {
    const cfg = currentLevel();
    const word = cfg.words[Math.floor(Math.random() * cfg.words.length)];
    const margin = 80;
    enemiesRef.current.push({
      id: ++idRef.current,
      word,
      x: margin + Math.random() * (SCREEN_W - margin * 2),
      y: 80,
    });
  }, [currentLevel]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    if (phaseRef.current === "menu") {
      ctx.fillStyle = COLORS.ui;
      ctx.font = "700 30px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("Typing Shooter (Bahasa Indonesia)", SCREEN_W / 2, 160);
      const tips = [
        "Musuh turun dengan sebuah kata atau frasa.",
        "Ketik persis teks musuh paling bawah (yang disorot).",
        "Salah huruf: buffer reset + HP berkurang sedikit.",
        "Musuh mencapai garis merah: HP berkurang banyak.",
        `Ada ${levels.current.length} level. Selesaikan semua untuk menang.`,
      ];
      ctx.font = "12px Segoe UI";
      tips.forEach((line, idx) => {
        ctx.fillText(line, SCREEN_W / 2, 240 + idx * 26);
      });
      ctx.fillStyle = COLORS.accent;
      ctx.font = "18px Segoe UI";
      ctx.fillText("ENTER — mulai   |   ESC — kembali", SCREEN_W / 2, SCREEN_H - 120);
      return;
    }

    if (phaseRef.current === "victory") {
      ctx.fillStyle = COLORS.overlay;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      ctx.fillStyle = COLORS.accent;
      ctx.font = "700 32px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("Anda menang!", SCREEN_W / 2, SCREEN_H / 2 - 50);
      ctx.fillStyle = COLORS.ui;
      ctx.font = "18px Segoe UI";
      ctx.fillText("Semua level telah diselesaikan.", SCREEN_W / 2, SCREEN_H / 2 + 10);
      ctx.fillText(
        "Terima kasih sudah bermain Typing Shooter.",
        SCREEN_W / 2,
        SCREEN_H / 2 + 44
      );
      ctx.fillStyle = COLORS.accent;
      ctx.font = "12px Segoe UI";
      ctx.fillText("ENTER — main lagi   |   ESC — menu", SCREEN_W / 2, SCREEN_H / 2 + 90);
      return;
    }

    const cfg = currentLevel();
    ctx.fillStyle = COLORS.ui;
    ctx.font = "12px Segoe UI";
    ctx.textAlign = "left";
    ctx.fillText(
      `Level ${levelIndexRef.current + 1}/${levels.current.length} — ${cfg.nama}`,
      16,
      16
    );
    ctx.fillText(`HP: ${hpRef.current}`, 16, 38);
    ctx.fillText(`Musuh hancur: ${killsRef.current}/${cfg.killsTarget}`, 16, 60);
    ctx.fillStyle = "#283040";
    ctx.fillRect(16, 72, 280, 8);
    ctx.fillStyle = COLORS.progress;
    const ratio = Math.min(1, killsRef.current / Math.max(1, cfg.killsTarget));
    ctx.fillRect(16, 72, Math.floor(280 * ratio), 8);

    ctx.strokeStyle = COLORS.line;
    ctx.beginPath();
    ctx.moveTo(0, DANGER_Y);
    ctx.lineTo(SCREEN_W, DANGER_Y);
    ctx.stroke();
    ctx.fillStyle = COLORS.warn;
    ctx.textAlign = "right";
    ctx.fillText("Garis bahaya — musuh di sini mengurangi HP", SCREEN_W - 16, DANGER_Y - 18);

    const te = targetEnemy();
    ctx.textAlign = "center";
    ctx.font = "18px Segoe UI";
    enemiesRef.current.forEach((e) => {
      const isTarget = te?.id === e.id;
      const width = ctx.measureText(e.word).width;
      if (isTarget) {
        ctx.fillStyle = COLORS.targetPad;
        ctx.fillRect(e.x - width / 2 - 6, e.y - 20, width + 12, 30);
      }
      ctx.fillStyle = isTarget ? COLORS.target : COLORS.enemy;
      ctx.fillText(e.word, e.x, e.y);
    });

    ctx.textAlign = "left";
    ctx.font = "14px Consolas";
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(`Ketik: [${typedRef.current || "..."}]`, 16, SCREEN_H - 48);
    ctx.font = "12px Segoe UI";
    ctx.fillStyle = "#8c91a5";
    ctx.fillText(
      "Huruf/backspace: ketik | ESC: keluar ke menu (progress hilang)",
      16,
      SCREEN_H - 22
    );

    if (phaseRef.current === "level_complete" || phaseRef.current === "game_over") {
      ctx.fillStyle = COLORS.overlay;
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      ctx.textAlign = "center";
      if (phaseRef.current === "level_complete") {
        ctx.fillStyle = COLORS.accent;
        ctx.font = "700 30px Segoe UI";
        ctx.fillText(
          `Level ${levelIndexRef.current + 1} selesai!`,
          SCREEN_W / 2,
          SCREEN_H / 2 - 40
        );
        ctx.fillStyle = COLORS.ui;
        ctx.font = "18px Segoe UI";
        ctx.fillText("Tekan ENTER untuk level berikutnya", SCREEN_W / 2, SCREEN_H / 2 + 10);
      } else {
        ctx.fillStyle = COLORS.warn;
        ctx.font = "700 30px Segoe UI";
        ctx.fillText("Game Over", SCREEN_W / 2, SCREEN_H / 2 - 40);
        ctx.fillStyle = COLORS.ui;
        ctx.font = "12px Segoe UI";
        ctx.fillText("HP habis atau terlalu banyak kesalahan.", SCREEN_W / 2, SCREEN_H / 2);
        ctx.fillStyle = COLORS.accent;
        ctx.font = "18px Segoe UI";
        ctx.fillText(
          "ENTER — coba lagi dari awal   |   ESC — menu",
          SCREEN_W / 2,
          SCREEN_H / 2 + 50
        );
      }
    }
  }, [currentLevel, targetEnemy]);

  const updatePlaying = useCallback((deltaMs: number) => {
    const cfg = currentLevel();

    if (hpRef.current <= 0) {
      phaseRef.current = "game_over";
      setPhase("game_over");
      return;
    }

    if (spawningActiveRef.current && killsRef.current < cfg.killsTarget) {
      spawnTimerRef.current += deltaMs;
      if (
        spawnTimerRef.current >= cfg.spawnIntervalMs &&
        enemiesRef.current.length < cfg.maxOnScreen
      ) {
        spawnTimerRef.current = 0;
        spawnEnemy();
      }
    } else if (killsRef.current >= cfg.killsTarget) {
      spawningActiveRef.current = false;
    }

    const moved: Enemy[] = [];
    for (const e of enemiesRef.current) {
      const ny = e.y + eSpeed(cfg.fallSpeed, deltaMs);
      if (ny >= DANGER_Y) {
        hpRef.current = Math.max(0, hpRef.current - 14);
        typedRef.current = "";
      } else {
        moved.push({ ...e, y: ny });
      }
    }
    enemiesRef.current = moved;

    if (hpRef.current <= 0) {
      setHp(hpRef.current);
      phaseRef.current = "game_over";
      setPhase("game_over");
      return;
    }

    if (killsRef.current >= cfg.killsTarget && enemiesRef.current.length === 0) {
      spawningActiveRef.current = false;
      if (levelIndexRef.current >= levels.current.length - 1) {
        phaseRef.current = "victory";
        setPhase("victory");
      } else {
        phaseRef.current = "level_complete";
        setPhase("level_complete");
      }
    }
    setHp(hpRef.current);
    setTypedBuffer(typedRef.current);
  }, [currentLevel, spawnEnemy]);

  useKeyboardState({
    active: true,
    onKeyDown: (key, event) => {
      if (key === "escape") {
        if (phaseRef.current === "playing") {
          phaseRef.current = "menu";
          setPhase("menu");
        }
        return;
      }
      if (key === "enter") {
        if (phaseRef.current === "menu") {
          resetGame();
          phaseRef.current = "playing";
          setPhase("playing");
        } else if (phaseRef.current === "level_complete") {
          levelIndexRef.current += 1;
          setLevelIndex(levelIndexRef.current);
          resetLevel();
          phaseRef.current = "playing";
          setPhase("playing");
        } else if (phaseRef.current === "game_over" || phaseRef.current === "victory") {
          resetGame();
          phaseRef.current = "playing";
          setPhase("playing");
        }
        return;
      }
      if (phaseRef.current !== "playing") return;
      if (key === "backspace") {
        event.preventDefault();
        typedRef.current = typedRef.current.slice(0, -1);
        setTypedBuffer(typedRef.current);
        return;
      }
      if (event.key.length !== 1) return;
      const target = targetEnemy();
      if (!target) return;
      const next = typedRef.current + event.key;
      if (target.word.startsWith(next)) {
        typedRef.current = next;
        if (next === target.word) {
          enemiesRef.current = enemiesRef.current.filter((e) => e.id !== target.id);
          typedRef.current = "";
          killsRef.current += 1;
          setKills(killsRef.current);
        }
      } else {
        typedRef.current = "";
        hpRef.current = Math.max(0, hpRef.current - 6);
        setHp(hpRef.current);
      }
      setTypedBuffer(typedRef.current);
    },
  });

  useRafTicker({
    running: true,
    onFrame: (deltaMs) => {
      if (phaseRef.current === "playing") {
        updatePlaying(deltaMs);
      }
      render();
    },
  });

  useEffect(() => {
    render();
  }, [phase, levelIndex, hp, kills, typedBuffer, render]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-8">
      <h1 className="text-xl font-bold text-[#e8ecff]">Typing Shooter</h1>
      <p className="mt-2 text-center text-sm text-[#8f96ac]">
        Parity Python: 5 level, menu/complete/game-over/victory.
      </p>
      <canvas
        ref={canvasRef}
        width={SCREEN_W}
        height={SCREEN_H}
        className="mt-4 w-full max-w-[960px] rounded-lg border border-[#2a3142]"
      />
      {phase !== "playing" && (
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => {
              if (phase === "level_complete") {
                levelIndexRef.current += 1;
                setLevelIndex(levelIndexRef.current);
                resetLevel();
              } else {
                resetGame();
              }
              phaseRef.current = "playing";
              setPhase("playing");
            }}
            className="rounded-lg bg-[#3d4860] px-4 py-2 text-sm text-white hover:bg-[#4d5a78]"
          >
            {phase === "menu"
              ? "Mulai"
              : phase === "level_complete"
                ? "Lanjut Level"
                : "Main lagi"}
          </button>
        </div>
      )}
    </div>
  );
}

function eSpeed(base: number, deltaMs: number) {
  return base * (deltaMs / 16);
}
