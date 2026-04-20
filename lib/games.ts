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
    description: "Solo atau multiplayer — WASD / sentuh, tepi layar dilipat.",
    accent: "#5ecf7a",
    icon: "◇",
  },
  {
    slug: "tetris",
    title: "Tetris",
    description: "Solo atau versus — WASD, Q, Spasi, atau tombol sentuh.",
    accent: "#c792ea",
    icon: "▣",
  },
  {
    slug: "bomberman",
    title: "Bomberman",
    description: "Multiplayer (min. 2 pemain) — WASD + Spasi / sentuh.",
    accent: "#a78bfa",
    icon: "◉",
  },
];
