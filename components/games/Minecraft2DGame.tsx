"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useKeyboardState } from "@/lib/game/useKeyboardState";
import { useRafTicker } from "@/lib/game/useRafTicker";

const CELL = 18;
const COLS = 96;
const ROWS = 48;
const W = 960;
const H = 540;
const GRAVITY = 0.45;
const JUMP_V = -9.2;
const MOVE_ACCEL = 0.8;
const MAX_RUN = 4.2;
const FRICTION = 0.82;

const AIR = 0;
const GRASS = 1;
const DIRT = 2;
const STONE = 3;
const WOOD = 4;
const BLOCK_NAMES = ["Udara", "Rumput", "Tanah", "Batu", "Kayu"];
const HOT_BLOCKS = [GRASS, DIRT, STONE, WOOD] as const;

const COLORS: Record<number, string> = {
  [GRASS]: "#5daf5d",
  [DIRT]: "#8b6914",
  [STONE]: "#7a7a82",
  [WOOD]: "#6b4423",
};

function genWorld(): { world: number[][]; spawnX: number; spawnY: number } {
  const w: number[][] = Array.from({ length: ROWS }, () =>
    Array(COLS).fill(AIR)
  );
  const base = ROWS - 8;
  for (let x = 0; x < COLS; x++) {
    const h = base + Math.floor(4 * Math.random()) - Math.floor(3 * Math.random());
    for (let y = 0; y < ROWS; y++) {
      if (y < h - 4) continue;
      if (y === h) w[y][x] = GRASS;
      else if (y < h + 5) w[y][x] = DIRT;
      else w[y][x] = STONE;
    }
  }

  for (let t = 0; t < 18; t++) {
    const x = 5 + Math.floor(Math.random() * (COLS - 10));
    let ground = -1;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (w[y][x] === GRASS) {
        ground = y;
        break;
      }
    }
    if (ground < 0) continue;
    const trunk = Math.min(ground - 1, 4);
    for (let i = 0; i < trunk; i++) {
      const yy = ground - 1 - i;
      if (yy >= 0) w[yy][x] = WOOD;
    }
    const leaves = [
      [-1, -trunk - 1],
      [0, -trunk - 1],
      [1, -trunk - 1],
      [0, -trunk - 2],
    ];
    for (const [dx, dy] of leaves) {
      const xx = x + dx;
      const yy = ground + dy;
      if (xx >= 0 && xx < COLS && yy >= 0 && yy < ROWS && w[yy][xx] === AIR) {
        w[yy][xx] = GRASS;
      }
    }
  }
  const sx = 42;
  let sy = 10 * CELL;
  for (let y = ROWS - 2; y > 2; y--) {
    if (w[y][sx] === AIR && w[y + 1][sx] !== AIR) {
      sy = y * CELL - 0.01;
      break;
    }
  }

  return { world: w, spawnX: sx * CELL + CELL / 2, spawnY: sy };
}

const PW = 11;
const PH = 26;

export function Minecraft2DGame() {
  const init = genWorld();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef(init.world);
  const pxRef = useRef(init.spawnX);
  const pyRef = useRef(init.spawnY);
  const vxRef = useRef(0);
  const vyRef = useRef(0);
  const camRef = useRef({ x: 0, y: 0 });
  const hotRef = useRef(0);
  const keysRef = useRef<Record<string, boolean>>({ a: false, d: false, space: false });

  const [hotbar, setHotbar] = useState(0);

  const rect = useCallback(() => ({
    l: pxRef.current - PW / 2,
    t: pyRef.current - PH,
    r: pxRef.current + PW / 2,
    b: pyRef.current,
  }), []);

  const overlaps = useCallback(() => {
    const { l, t, r, b } = rect();
    if (l < 0 || r > COLS * CELL || t < 0 || b > ROWS * CELL) return true;
    const w = worldRef.current;
    for (let cy = Math.max(0, Math.floor(t / CELL)); cy <= Math.floor(b / CELL); cy++) {
      for (let cx = Math.max(0, Math.floor(l / CELL)); cx <= Math.floor(r / CELL); cx++) {
        if (w[cy]?.[cx] && w[cy][cx] !== AIR) {
          const cl = cx * CELL,
            ct = cy * CELL,
            cr = cl + CELL,
            cb = ct + CELL;
          if (l < cr && r > cl && t < cb && b > ct) return true;
        }
      }
    }
    return false;
  }, [rect]);

  const onGround = useCallback(() => {
    pyRef.current += 1;
    const o = overlaps();
    pyRef.current -= 1;
    return o;
  }, [overlaps]);

  const spawnOnSurface = useCallback(() => {
    const x = 42;
    const w = worldRef.current;
    for (let y = ROWS - 2; y > 2; y--) {
      if (w[y][x] === AIR && w[y + 1][x] !== AIR) {
        pxRef.current = x * CELL + CELL / 2;
        pyRef.current = y * CELL - 0.01;
        vyRef.current = 0;
        return;
      }
    }
  }, []);

  const resolveX = useCallback(() => {
    if (!overlaps()) return;
    if (vxRef.current !== 0) {
      const step = vxRef.current > 0 ? -1 : 1;
      for (let i = 0; i < 96; i++) {
        pxRef.current += step;
        if (!overlaps()) {
          vxRef.current = 0;
          return;
        }
      }
    } else {
      for (const step of [-1, 1]) {
        for (let i = 0; i < 48; i++) {
          pxRef.current += step;
          if (!overlaps()) return;
        }
      }
    }
    vxRef.current = 0;
    if (overlaps()) spawnOnSurface();
  }, [overlaps, spawnOnSurface]);

  const resolveY = useCallback(() => {
    if (!overlaps()) return;
    if (vyRef.current > 0) {
      for (let i = 0; i < 96; i++) {
        pyRef.current -= 1;
        if (!overlaps()) break;
      }
    } else {
      for (let i = 0; i < 96; i++) {
        pyRef.current += 1;
        if (!overlaps()) break;
      }
    }
    vyRef.current = 0;
    if (overlaps()) spawnOnSurface();
  }, [overlaps, spawnOnSurface]);

  const render = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#87ceeb";
    ctx.fillRect(0, 0, W, H);
    const cx = camRef.current.x;
    const cy = camRef.current.y;
    const w = worldRef.current;
    const x0 = Math.floor(cx / CELL) - 2;
    const x1 = Math.floor(cx / CELL) + Math.floor(W / CELL) + 4;
    const y0 = Math.floor(cy / CELL) - 2;
    const y1 = Math.floor(cy / CELL) + Math.floor(H / CELL) + 4;

    for (let y = Math.max(0, y0); y < Math.min(ROWS, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(COLS, x1); x++) {
        const b = w[y][x];
        if (b === AIR) continue;
        const sx = x * CELL - cx + W / 2;
        const sy = y * CELL - cy + H / 2;
        if (sx < -CELL || sx > W + CELL || sy < -CELL || sy > H + CELL) continue;
        ctx.fillStyle = COLORS[b] ?? "#666";
        ctx.fillRect(sx, sy, CELL, CELL);
        ctx.strokeStyle = "#2a2a30";
        ctx.strokeRect(sx, sy, CELL, CELL);
      }
    }

    const px = pxRef.current - cx + W / 2;
    const py = pyRef.current - cy + H / 2;
    ctx.fillStyle = "#3d4a6e";
    ctx.fillRect(px - PW / 2, py - PH, PW, PH);
    ctx.strokeStyle = "#1a2030";
    ctx.lineWidth = 2;
    ctx.strokeRect(px - PW / 2, py - PH, PW, PH);

    const facing = vxRef.current < 0 ? -1 : 1;
    ctx.strokeStyle = "#ffd080";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py - PH + 8);
    ctx.lineTo(px + facing * 8, py - PH + 12);
    ctx.stroke();

    const selected = HOT_BLOCKS[hotRef.current];
    const name = BLOCK_NAMES[selected];
    ctx.fillStyle = "#1e2430";
    ctx.fillRect(8, 8, 420, 44);
    ctx.strokeStyle = "#4a5568";
    ctx.lineWidth = 1;
    ctx.strokeRect(8, 8, 420, 44);
    ctx.fillStyle = "#e0e4ec";
    ctx.font = "10px Segoe UI";
    ctx.textAlign = "left";
    ctx.fillText(
      `Hotbar [1-4 / scroll / Q E]: ${name}  |  Klik kiri gali  |  Klik kanan pasang`,
      16,
      30
    );
    ctx.fillStyle = "#304050";
    ctx.fillText("A D gerak · Spasi lompat · Klik blok dalam jangkauan", 16, H - 24);
  }, []);

  const update = useCallback(() => {
    const keys = keysRef.current;
    if (keys.space && onGround()) {
      vyRef.current = JUMP_V;
    }

    if (keys.a) {
      vxRef.current -= MOVE_ACCEL;
    }
    if (keys.d) {
      vxRef.current += MOVE_ACCEL;
    }
    vxRef.current = Math.max(-MAX_RUN, Math.min(MAX_RUN, vxRef.current));
    if (!keys.a && !keys.d) {
      vxRef.current *= FRICTION;
    }

    pxRef.current += vxRef.current;
    resolveX();

    vyRef.current += GRAVITY;
    pyRef.current += vyRef.current;
    resolveY();

    pxRef.current = Math.max(PW / 2, Math.min(COLS * CELL - PW / 2, pxRef.current));
    if (pyRef.current > ROWS * CELL + 80) spawnOnSurface();
    camRef.current.x += (pxRef.current - camRef.current.x) * 0.12;
    camRef.current.y += (pyRef.current - camRef.current.y) * 0.08;
  }, [onGround, resolveX, resolveY, spawnOnSurface]);

  useKeyboardState({
    active: true,
    onKeyDown: (key) => {
      if (key === "a") keysRef.current.a = true;
      if (key === "d") keysRef.current.d = true;
      if (key === " " || key === "space") keysRef.current.space = true;
      if (key === "q") {
        hotRef.current = (hotRef.current - 1 + HOT_BLOCKS.length) % HOT_BLOCKS.length;
        setHotbar(hotRef.current);
      }
      if (key === "e") {
        hotRef.current = (hotRef.current + 1) % HOT_BLOCKS.length;
        setHotbar(hotRef.current);
      }
      if (["1", "2", "3", "4"].includes(key)) {
        hotRef.current = Number(key) - 1;
        setHotbar(hotRef.current);
      }
    },
    onKeyUp: (key) => {
      if (key === "a") keysRef.current.a = false;
      if (key === "d") keysRef.current.d = false;
      if (key === " " || key === "space") keysRef.current.space = false;
    },
  });

  useRafTicker({
    running: true,
    onFrame: () => {
      update();
      keysRef.current.space = false;
      render();
    },
  });

  const mine = (sx: number, sy: number) => {
    const cx = camRef.current.x;
    const cy = camRef.current.y;
    const wx = sx - W / 2 + cx;
    const wy = sy - H / 2 + cy;
    const gx = Math.floor(wx / CELL);
    const gy = Math.floor(wy / CELL);
    if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return;
    if (worldRef.current[gy][gx] === AIR) return;
    const d = Math.hypot(wx - pxRef.current, wy - pyRef.current - PH / 2);
    if (d > 5.5 * CELL) return;
    worldRef.current[gy][gx] = AIR;
  };

  const place = (sx: number, sy: number) => {
    const cx = camRef.current.x;
    const cy = camRef.current.y;
    const wx = sx - W / 2 + cx;
    const wy = sy - H / 2 + cy;
    const gx = Math.floor(wx / CELL);
    const gy = Math.floor(wy / CELL);
    if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return;
    if (worldRef.current[gy][gx] !== AIR) return;
    const d = Math.hypot(
      gx * CELL + CELL / 2 - pxRef.current,
      gy * CELL + CELL / 2 - pyRef.current + PH / 2
    );
    if (d > 5.5 * CELL) return;
    const { l, t, r, b } = rect();
    const bl = gx * CELL,
      br = bl + CELL,
      bt = gy * CELL,
      bb = bt + CELL;
    if (!(br < l || bl > r || bb < t || bt > b)) return;
    worldRef.current[gy][gx] = HOT_BLOCKS[hotbar];
  };

  useEffect(() => {
    render();
  }, [render]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-8">
      <h1 className="text-xl font-bold text-[#e8ecff]">Blok sandbox 2D</h1>
      <p className="mt-2 text-center text-sm text-[#8f96ac]">
        Parity Python: A/D + Spasi, hotbar 1-4/Q/E/scroll, gali & bangun.
      </p>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="mt-4 cursor-crosshair rounded-lg border border-[#2a3142]"
        onWheel={(e) => {
          const d = e.deltaY > 0 ? 1 : -1;
          hotRef.current = (hotRef.current + d + HOT_BLOCKS.length) % HOT_BLOCKS.length;
          setHotbar(hotRef.current);
        }}
        onMouseDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const sx = ((e.clientX - r.left) / r.width) * W;
          const sy = ((e.clientY - r.top) / r.height) * H;
          if (e.button === 0) mine(sx, sy);
          if (e.button === 2) {
            e.preventDefault();
            place(sx, sy);
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
      <p className="mt-2 text-xs text-[#5a6278]">
        Hotbar aktif: {BLOCK_NAMES[HOT_BLOCKS[hotbar]]}
      </p>
    </div>
  );
}
