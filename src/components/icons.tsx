const paths = {
  dashboard: "M4 18a8 8 0 1 1 16 0M12 14l4-5M3 18h18",
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  cog: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM10 2h4l.6 2.6 2.3 1 2.3-1.4 2.8 2.8-1.4 2.3 1 2.3L22 10v4l-2.6.6-1 2.3 1.4 2.3-2.8 2.8-2.3-1.4-2.3 1L14 22h-4l-.6-2.6-2.3-1-2.3 1.4-2.8-2.8 1.4-2.3-1-2.3L2 14v-4l2.6-.6 1-2.3-1.4-2.3 2.8-2.8 2.3 1.4 2.3-1z",
  calendar: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  globe:
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18",
  alert: "M12 3 22 21H2zM12 10v4M12 17v.5",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  list: "M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1",
  user: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21a8 8 0 0 1 16 0",
  users:
    "M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a7 7 0 0 1 4 6",
  barcode: "M4 5v14M7 5v14M10 5v14M14 5v14M16 5v14M20 5v14",
  heart:
    "M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z",
  star: "M12 3l2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 3 1.1-6.2L3 9.7l6.2-.9z",
  chart: "M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-7",
  cart: "M2 3h3l2.5 12h11L21 7H6M9 20h.01M18 20h.01",
  file: "M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h6",
  filter: "M3 4h18l-7 9v6l-4 2v-8z",
  plus: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v8M8 12h8",
  chevronDown: "M6 9l6 6 6-6",
  chevronUp: "M6 15l6-6 6 6",
  chevronsLeft: "M11 17l-5-5 5-5M18 17l-5-5 5-5",
  chevronsRight: "M13 17l5-5-5-5M6 17l5-5-5-5",
  download: "M12 3v12M7 10l5 5 5-5M4 21h16",
  folder: "M3 6h6l2 2h10v11H3z",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  truck: "M2 6h12v10H2zM14 9h4l3 3v4h-7M6 19h.01M17 19h.01",
  chat: "M4 5h16v11H9l-5 4z",
  tag: "M3 3h8l10 10-8 8L3 11zM7.5 7.5h.01",
  print: "M6 9V3h12v6M6 18H3v-8h18v8h-3M6 14h12v7H6z",
  clipboard: "M8 3h8v4H8zM6 5H4v16h16V5h-2M8 12h8M8 16h5",
  edit: "M4 20h4L19 9l-4-4L4 16z",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  eraser: "M8 20h12M5 15l9-9 5 5-9 9H8z",
  table: "M3 4h18v16H3zM3 10h18M3 15h18M9 4v16",
  dollar: "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  money: "M2 6h20v12H2zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  undo: "M4 4v6h6M4 10a8 8 0 1 1 1.5 7",
  pie: "M12 3v9h9a9 9 0 1 1-9-9zM15 3a6 6 0 0 1 6 6h-6z",
  image: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 8.5h.01",
  minus: "M5 12h14",
  plusSmall: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6 6 18",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  card: "M2 5h20v14H2zM2 10h20M6 15h4",
  percent:
    "M19 5 5 19M6.5 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM17.5 15a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  wrench:
    "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z",
  building: "M5 21V3h10v18M15 9h4v12M3 21h18M8 7h4M8 11h4M8 15h4",
  key: "M15 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM10.8 13.2 3 21M6 18l3 3M15 7.5h.01",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  calculator:
    "M5 2h14v20H5zM8 6h8v4H8zM8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01",
  receipt: "M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6",
  pause: "M8 5v14M16 5v14",
  check: "M5 12l5 5L20 7",
  userPlus:
    "M9 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM2 21a7 7 0 0 1 14 0M19 8v6M16 11h6",
  store: "M3 9l2-5h14l2 5M4 9v11h16V9M3 9h18M9 20v-6h6v6",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  layers: "M12 3 2 8l10 5 10-5zM2 13l10 5 10-5",
  fileExcel: "M14 3H6v18h12V7zM14 3v4h4M9 11l6 6M15 11l-6 6",
  filePdf: "M14 3H6v18h12V7zM14 3v4h4M9 13h2a1.5 1.5 0 0 1 0 3H9v-5",
  refresh: "M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4",
  logout: "M9 21H4V3h5M16 17l5-5-5-5M21 12H9",
  menu: "M3 6h18M3 12h18M3 18h18",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
