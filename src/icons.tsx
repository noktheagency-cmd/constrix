const paths = {
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.6 19c.7-2.7 2.8-4 5.4-4s4.7 1.3 5.4 4" />
      <circle cx="17" cy="9" r="2.2" />
      <path d="M16 15.2c1.7.3 3 1.3 3.6 2.8" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.2 19.2c.9-3.2 3.4-4.8 6.8-4.8s5.9 1.6 6.8 4.8" />
    </>
  ),
  office: (
    <>
      <path d="M4 21h16" />
      <path d="M6 21V4.5h12V21" />
      <path d="M10 21v-4h4v4" />
      <path d="M9 8h2M13 8h2M9 12h2M13 12h2" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="12" cy="7" rx="7" ry="2.6" />
      <path d="M5 7v4.2c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6V7" />
      <path d="M5 11.2v4.2c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6v-4.2" />
    </>
  ),
  crane: (
    <>
      <path d="M4 21h16" />
      <path d="M6 21V9.5L12 5l6 4.5V21" />
      <path d="M10 21v-5.5h4V21" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10.5h18" />
      <circle cx="16" cy="14.5" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  asset: (
    <>
      <rect x="3" y="8" width="18" height="11" rx="2" />
      <path d="M8 8V5.5h8V8" />
      <path d="M12 11.5v4" />
      <path d="M10 13.5h4" />
    </>
  ),
  factory: (
    <>
      <path d="M3 21V11l5.5 3.2V11L14 14.2V9l7 3.2V21" />
      <path d="M3 21h18" />
    </>
  ),
  warehouse: (
    <>
      <path d="M3 10.5 12 4l9 6.5V21H3z" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  truck: (
    <>
      <path d="M3 7.5h11v9H3z" />
      <path d="M14 11h4.2L21 14v2.5h-7" />
      <circle cx="7" cy="18" r="1.4" />
      <circle cx="17.5" cy="18" r="1.4" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s6.2-5.1 6.2-10.1a6.2 6.2 0 1 0-12.4 0C5.8 15.9 12 21 12 21z" />
      <circle cx="12" cy="10.8" r="2.1" />
    </>
  ),
  hardhat: (
    <>
      <path d="M4 14.5a8 8 0 0 1 16 0" />
      <path d="M3 14.5h18v1.8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M12 4.5v2" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V10a6 6 0 1 1 12 0v6l1.4 2H4.6L6 16z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15" />
      <path d="M9 7V5h6v2" />
      <path d="M7.5 7 8.4 19h7.2l.9-12" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  bin: (
    <>
      <path fill="currentColor" stroke="none" d="M10 3.2h4a1 1 0 0 1 1 1V5.4H9V4.2a1 1 0 0 1 1-1z" />
      <path fill="currentColor" stroke="none" d="M3.8 6.2h16.4a1 1 0 0 1 0 2H3.8a1 1 0 0 1 0-2z" />
      <path fill="currentColor" fillRule="evenodd" stroke="none" d="M6.3 9.4h11.4l-.8 9.5a1.7 1.7 0 0 1-1.7 1.6H8.8a1.7 1.7 0 0 1-1.7-1.6l-.8-9.5zm3.2 1.7v6.1h1.5v-6.1H9.5zm3.5 0v6.1h1.5v-6.1h-1.5z" />
    </>
  ),
  more: (
    <>
      <circle cx="12" cy="5.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  note: (
    <>
      <path d="M7 3.5h7l5 5V20.5H7z" />
      <path d="M14 3.5V9h5" />
      <path d="M9.5 13h5" />
      <path d="M9.5 16.5h5" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,
  check: <path d="m5 12.5 4.2 4.2L19 7.5" />,
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16" />
      <path d="M8 3.5v3M16 3.5v3" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5v1.8M12 18.7v1.8M3.5 12h1.8M18.7 12h1.8M6 6l1.3 1.3M16.7 16.7 18 18M18 6l-1.3 1.3M7.3 16.7 6 18" />
    </>
  ),
  moon: <path d="M16.5 14.2A6.4 6.4 0 0 1 9.8 4.8 6.6 6.6 0 1 0 16.5 14.2z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  logout: (
    <>
      <path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10" />
      <path d="M10 12h9" />
      <path d="m16 8.5 3.5 3.5L16 15.5" />
    </>
  ),
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.2" />
      <path d="m4.2 7.2 7.8 5.6 7.8-5.6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6.2 6.8 12 6.8 21.5 12 21.5 12 17.8 17.2 12 17.2 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M4 5.5 19 19" />
      <path d="M9.5 7.1A9 9 0 0 1 12 6.8c5.8 0 9.5 5.2 9.5 5.2a16 16 0 0 1-3.1 3.4" />
      <path d="M6.4 7.4A16 16 0 0 0 2.5 12S6.2 17.2 12 17.2a9 9 0 0 0 3.4-.7" />
      <path d="M10 10.2a2.5 2.5 0 0 0 3.4 3.4" />
    </>
  ),
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  calc: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M8 7.5h8" />
      <circle cx="8.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="15.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  files: <path d="M4 8.2V6.6A1.2 1.2 0 0 1 5.2 5.4h3.6L11 7.4h7.6A1.4 1.4 0 0 1 20 8.8V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z" />,
  boxes: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="8.5" y="13.5" width="7" height="7" rx="1.4" />
    </>
  ),
  layers: (
    <>
      <path d="m12 4 8 4-8 4-8-4z" />
      <path d="m4 12 8 4 8-4" />
      <path d="m4 16 8 4 8-4" />
    </>
  ),
  route: (
    <>
      <circle cx="6.5" cy="7" r="2" />
      <circle cx="17.5" cy="17" r="2" />
      <path d="M8.5 7H13a4 4 0 0 1 4 4v4" />
    </>
  ),
  tag: (
    <>
      <path d="M12.2 4.5H19v6.8L11 19.3 4.7 13z" />
      <circle cx="15.2" cy="8.3" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  flow: (
    <>
      <rect x="3.5" y="4" width="6" height="4.5" rx="1" />
      <rect x="14.5" y="9.8" width="6" height="4.5" rx="1" />
      <rect x="3.5" y="15.5" width="6" height="4.5" rx="1" />
      <path d="M6.5 8.5v7M9.5 6.2h3.2a3 3 0 0 1 3 3v.6" />
    </>
  ),
  percent: (
    <>
      <path d="m7 17 10-10" />
      <circle cx="8.2" cy="8.2" r="1.7" />
      <circle cx="15.8" cy="15.8" r="1.7" />
    </>
  ),
  cloud: <path d="M7.2 18h9.6a3.4 3.4 0 0 0 .5-6.8 4.8 4.8 0 0 0-9.2-1.3A3.3 3.3 0 0 0 7.2 18z" />,
  list: (
    <>
      <path d="M9 7h11M9 12h11M9 17h11" />
      <circle cx="5" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="17" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  badge: (
    <>
      <rect x="5" y="3.5" width="14" height="11" rx="2" />
      <circle cx="12" cy="8" r="2" />
      <path d="m8.5 20 3.5-3.8L15.5 20" />
    </>
  ),
  clipboard: (
    <>
      <rect x="6" y="4.5" width="12" height="15.5" rx="2" />
      <path d="M9 4.5h6V7H9z" />
      <path d="M9 11h6M9 14.5h4" />
    </>
  ),
  form: (
    <>
      <path d="M7 3.5h7l4 4V20.5H7z" />
      <path d="M14 3.5V8h4" />
      <path d="M9.5 12.5h5M9.5 16h3.2" />
    </>
  ),
  stamp: (
    <>
      <circle cx="12" cy="8.5" r="3.4" />
      <path d="M8.2 12.2V16h7.6v-3.8" />
      <path d="M6 19.5h12" />
    </>
  ),
  table: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="1.6" />
      <path d="M3.5 9.5h17M3.5 14h17M9.5 5v14" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 19 6.4v5.2c0 3.8-2.7 6.4-7 8.4-4.3-2-7-4.6-7-8.4V6.4z" />
      <path d="m9 11.4 2 2 4-4" />
    </>
  ),
  checks: (
    <>
      <path d="M9 7h10M9 12h10M9 17h10" />
      <path d="m4 7.2 1.1 1.1L7.4 6" />
      <path d="m4 12.2 1.1 1.1L7.4 11" />
      <path d="m4 17.2 1.1 1.1L7.4 16" />
    </>
  ),
  store: (
    <>
      <path d="M4 10.2 5.8 5h12.4L20 10.2" />
      <path d="M4 10.2h16V19H4z" />
      <path d="M10 19v-4h4v4" />
    </>
  ),
  window: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="1.6" />
      <path d="M12 4v16M4 12h16" />
    </>
  ),
  shop: (
    <>
      <path d="m4 10.5 8-6.5 8 6.5" />
      <path d="M6 10.2V19h12v-8.8" />
      <path d="M10 19v-4h4v4" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19h16" />
      <path d="M7 16V11M12 16V7M17 16v-3" />
    </>
  ),
  swap: (
    <>
      <path d="M7 7h11" />
      <path d="m15 4.2 3 2.8-3 2.8" />
      <path d="M17 17H6" />
      <path d="m9 14.2-3 2.8 3 2.8" />
    </>
  ),
  invoice: (
    <>
      <path d="M7 3.5h10v17l-2.2-1.3L12.5 20 10 18.7 7.8 20z" />
      <path d="M10 8.5h4M10 12h4" />
    </>
  ),
  bank: (
    <>
      <path d="m4 10 8-5.5L20 10" />
      <path d="M5 10h14" />
      <path d="M7 10v7M12 10v7M17 10v7" />
      <path d="M4.5 19h15" />
    </>
  ),
  handshake: (
    <>
      <path d="M8 14 5.2 11.2a1.8 1.8 0 0 1 0-2.5L7.5 6.4" />
      <path d="m16 14 2.8-2.8a1.8 1.8 0 0 0 0-2.5L16.5 6.4" />
      <path d="M8.2 10.2h2.2l1.6 1.6 1.6-1.6h2.2" />
      <path d="m8 14 2.4 2.4a2.2 2.2 0 0 0 3.2 0L16 14" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.2C10.4 5.2 8.6 4.8 6 4.8v13.2c2.6 0 4.4.4 6 1.4 1.6-1 3.4-1.4 6-1.4V4.8c-2.6 0-4.4.4-6 1.4z" />
      <path d="M12 6.2v13.2" />
    </>
  ),
  cover: (
    <>
      <path d="M4 13a8 8 0 0 1 16 0z" />
      <path d="M12 13.2V19" />
      <path d="M12 19a2 2 0 0 0 2.2-2" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3.5" y="8" width="17" height="11" rx="2" />
      <path d="M9 8V6.4A1.4 1.4 0 0 1 10.4 5h3.2A1.4 1.4 0 0 1 15 6.4V8" />
      <path d="M3.5 13h17" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 8.2V12l2.6 1.8" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10.5h18" />
      <path d="M6.5 15h4" />
    </>
  ),
  sitemap: (
    <>
      <rect x="9" y="3.5" width="6" height="4" rx="1" />
      <path d="M12 7.5V10M6 10h12" />
      <path d="M6 10v2.5M12 10v2.5M18 10v2.5" />
      <rect x="3.5" y="14.5" width="5" height="4" rx="1" />
      <rect x="9.5" y="14.5" width="5" height="4" rx="1" />
      <rect x="15.5" y="14.5" width="5" height="4" rx="1" />
    </>
  ),
  layout: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M3.5 9h17M9.5 9v11" />
    </>
  ),
  download: (
    <>
      <path d="M12 4.5v9" />
      <path d="M8.5 10.5 12 14l3.5-3.5" />
      <path d="M5 17.5h14" />
    </>
  ),
  history: (
    <>
      <path d="M5 12a7 7 0 1 0 1.8-4.7" />
      <path d="M4.5 4.8V8h3.2" />
      <path d="M12 8.5V12l2.3 1.5" />
    </>
  ),
  widen: (
    <>
      <path d="M8 12H3" />
      <path d="M16 12h5" />
      <path d="M8 8 4 12l4 4" />
      <path d="m16 16 4-4-4-4" />
    </>
  ),
  narrow: (
    <>
      <path d="M3 12h5" />
      <path d="M21 12h-5" />
      <path d="m7 8 4 4-4 4" />
      <path d="m17 16-4-4 4-4" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.4" />
      <path d="m6.2 16.2 3.2-3.1a1 1 0 0 1 1.4 0l2.4 2.3 1.3-1.2a1 1 0 0 1 1.3 0l2.2 2" />
    </>
  ),
}

export type IconName = keyof typeof paths

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}
