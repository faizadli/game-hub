export type GameMeta = {
  slug: string;
  title: string;
  description: string;
  accent: string;
  icon: string;
  /** Teks & visual kartu home — mengikuti mockup stitch */
  hubTitle: string;
  hubDescription: string;
  /** Gambar hero kartu (mockup game hub) */
  coverImage: string | null;
};

export const GAMES: GameMeta[] = [
  {
    slug: "snake",
    title: "Snake (Nokia)",
    description: "Solo atau multiplayer — WASD / sentuh, tepi layar dilipat.",
    accent: "#5ecf7a",
    icon: "◇",
    hubTitle: "Snake",
    hubDescription:
      "Kembali ke klasik dengan sentuhan modern. Berikan makan ularmu dan jadilah yang terpanjang di papan peringkat.",
    coverImage:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBeYWqnLrzKWoWqJxh87lj4LWzFCkvgcTNsxP6I4sGPd5H_JZF82MX-GJbEPEiXvrVxSxDH5lwCqmRCnl_WLb8TPfs2S1hz4f4juyef1DvMq8Aku8p81YP9ALEnWRjzLkKrU2HGT-0W4vVc1uBCDw_ekJIUV7_ODoG7_u1b-JoUNoxK5Ppy0sywCdozgiXtGV5CzhxBiS06yIVr_ZOTGcHF-faKTvNspIcwVW7WwfGW6gyYifcGup1nUTACElqcv101pSl_yL84Vbo",
  },
  {
    slug: "tetris",
    title: "Tetris",
    description: "Solo atau versus — WASD, Q, Spasi, atau tombol sentuh.",
    accent: "#c792ea",
    icon: "▣",
    hubTitle: "Tetris",
    hubDescription: "Susun balok dengan presisi. Kecepatan dan strategi adalah kunci kemenanganmu.",
    coverImage:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBBc5NsBfLnBF2ojSF17kqNh-FhB0ol55Y0M5Ib1TnGatl_bO5Alh9HyrE_5hlQjGiN3m2K17Fn5w427dw7_SjrTD1hj0ePGW83-a8-9e8LYcLKa2FAV9fA_3LueYoFwoaGm8SCSjnCzSSGkIkG12QS25Hx5gk4PAzdbQb8O0G21KrqQPlpjeqGUQ0R_usrYpkPY2Qu7xj10FavEMvi3EXBzK7rFeWGiY93QU4Ae4qe4qj8IXjD_Q48dBrRc80DQ38biAGoyJxziPI",
  },
  {
    slug: "bomberman",
    title: "Bomberman",
    description: "Multiplayer (min. 2 pemain) — WASD + Spasi / sentuh.",
    accent: "#a78bfa",
    icon: "◉",
    hubTitle: "Bomberman",
    hubDescription:
      "Pasang bom, hancurkan rintangan, dan kalahkan lawanmu dalam arena yang menantang.",
    coverImage:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAYhVUTnWwg3pXQ-zDtIxoN_lOXtsbGKxdVkuitSWSK8nQEXxlf6UnK010ufFfqHr4YbvNgRepxAhRgZf808bdBh_ssp_cS-R3DGQvYA2UGXVdtkJlW2J2KcBfcupgbuGbNoym0f_h-Bh6D19lAS3F0NFcrW4fWGvoh1Qwdv9n4wLR5x59Yi54faGtmttT35m3L5SgB_oI8TgaRd2akjrk8W-6cBZP4gaju8hKAjsqqU68f22Wl2IBd_FE6zotNwy0Fsg3rUNMbxqU",
  },
  {
    slug: "flappy",
    title: "Flappy Bird",
    description: "Solo — Spasi / sentuh, skor terbaik tersimpan di perangkat.",
    accent: "#38bdf8",
    icon: "△",
    hubTitle: "Flappy Bird",
    hubDescription:
      "Ketuk untuk terbang melewati pipa-pipa. Berapa jauh kamu bisa bertahan kali ini?",
    coverImage:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCrqzS6Eed_kYtAUh_Y63XvmBY3TbK6UEcdzFevaNNDOqvqt-6FEVydguKl_-gfEcS_gaBnvoOvd9jyOTqIj27AsuKCYpeoaLU_3G2nUoUBKo-lBdjN-3QFEzBnjuuIHpj6GcAOUT7s5Tib4MCLRFnAFJwVvN-6ixYqWc22zHMiqfA49andFuHlNPIwvDBxjAfSEaSfMOX7MnPVw99irCrVq6CbB2b9087dLhB4k1pPFkNAtrkXP90i7Mk2n_hiBhER3esZ5WjJArQ",
  },
  {
    slug: "maze",
    title: "Invisible Maze Race",
    description: "Multiplayer race — hafalkan peta, lalu menangi jalur tersembunyi.",
    accent: "#f59e0b",
    icon: "▦",
    hubTitle: "Invisible Maze Race",
    hubDescription:
      "Ingat jalannya atau terjebak selamanya. Balapan labirin yang tak terlihat namun mematikan.",
    coverImage:
      "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80",
  },
];
