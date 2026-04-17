# Games Web (Next.js + Realtime Multiplayer)

Project ini berisi:

- Game Hub + game browser (`snake`, `tetris`)
- Realtime multiplayer untuk **Snake** menggunakan **Cloudflare Durable Objects**
- Tanpa akun/register dan tanpa database tradisional

## Struktur penting

- Frontend Next.js: root project ini
- Worker realtime: `realtime-worker/`

## 1) Jalankan lokal (frontend + realtime)

### A. Jalankan frontend

```bash
npm install
npm run dev
```

Frontend: `http://localhost:3000`

### B. Jalankan realtime worker (terminal kedua)

Syarat: install Wrangler.

```bash
npm i -g wrangler
```

Lalu dari folder worker:

```bash
cd realtime-worker
wrangler dev
```

Worker lokal default: `http://127.0.0.1:8787`

Frontend sudah otomatis mencoba websocket ke `ws://127.0.0.1:8787/ws` saat di localhost.

## 2) Environment variable frontend

Di production, set:

```bash
NEXT_PUBLIC_REALTIME_WS_URL=wss://<worker-url>
```

Contoh ada di `.env.example`.

## 3) Deploy gratis (rekomendasi)

### A. Deploy realtime ke Cloudflare Workers

1. Login wrangler:

```bash
wrangler login
```

2. Dari folder `realtime-worker/`, deploy:

```bash
wrangler deploy
```

3. Ambil URL worker hasil deploy, contoh:
`https://games-web-realtime.<subdomain>.workers.dev`

Websocket endpoint-nya:
`wss://games-web-realtime.<subdomain>.workers.dev/ws`

### B. Deploy frontend ke Vercel

1. Push repo ke GitHub/GitLab.
2. Import project ke Vercel.
3. Set Environment Variable di Vercel:

```bash
NEXT_PUBLIC_REALTIME_WS_URL=wss://games-web-realtime.<subdomain>.workers.dev
```

4. Deploy.

## 4) Cara kerja fitur multiplayer Snake

- User masuk website -> isi nama -> nama dipakai sebagai identitas sesi.
- Hub menampilkan:
  - siapa saja online
  - jumlah user per game card
- Snake room:
  - semua pemain harus klik **Ready**
  - game mulai kalau semua ready (minimal 2 pemain)
  - user yang join saat game berjalan jadi **spectator**
  - setelah round selesai, spectator bisa ikut round berikutnya

## 5) Catatan teknis

- State multiplayer disimpan in-memory di Durable Object room `global`.
- Tidak ada penyimpanan akun atau data user permanen.
- Jika worker restart, state room akan reset (sesuai desain tanpa database).
