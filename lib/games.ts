export type GameMeta = {
  slug: string;
  title: string;
  description: string;
  accent: string;
  icon: string;
};

export const GAMES: GameMeta[] = [
  {
    slug: "snake",
    title: "Snake (Nokia)",
    description: "Ular, WASD, tepi layar dilipat.",
    accent: "#5ecf7a",
    icon: "◇",
  },
  {
    slug: "tetris",
    title: "Tetris",
    description: "Blok klasik — panah, putar, spasi.",
    accent: "#c792ea",
    icon: "▣",
  },
  {
    slug: "typing",
    title: "Typing Shooter",
    description: "Ketik kata Indonesia — musuh turun.",
    accent: "#ffab6b",
    icon: "⌁",
  },
  {
    slug: "minecraft",
    title: "Blok sandbox 2D",
    description: "Gali & bangun — A/D, lompat, klik.",
    accent: "#9acd32",
    icon: "▦",
  },
];
