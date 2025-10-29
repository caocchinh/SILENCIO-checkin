export const TICKET_IMAGE = {
  Tamer: "/assets/tamer.webp",
  Ringmaster: "/assets/ringmaster.webp",
  Juggler: "/assets/juggler.webp",
  Jester: "/assets/jester.webp",
  "Jester - Vé CTV": "/assets/jester.webp",
  "Juggler - The Phlox": "/assets/juggler.webp",
  "Juggler - CLB giảm 40%": "/assets/juggler.webp",
};

export const ADMIN_NAVIGATION_ITEMS = [
  {
    label: "Check in online",
    path: "/admin/online",
  },
  {
    label: "Check in truyền thống",
    path: "/admin/traditional",
  },
];

// PIN verification settings
export const PIN_VERIFICATION_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
export const PIN_SESSION_KEY = "admin_pin_verified";
