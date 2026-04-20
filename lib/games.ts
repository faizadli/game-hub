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
    description: "Blok klasik multiplayer — WASD, Q, Spasi.",
    accent: "#c792ea",
    icon: "▣",
  },
  {
    slug: "bomberman",
    title: "Bomberman",
    description: "Ledakan, brick, power-up — WASD + Spasi.",
    accent: "#a78bfa",
    icon: "◉",
  },
];
