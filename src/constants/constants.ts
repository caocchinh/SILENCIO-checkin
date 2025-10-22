export const TICKET_IMAGE = {
  tamer: "/assets/tamer.webp",
  ringmaster: "/assets/ringmaster.webp",
  juggler: "/assets/juggler.webp",
  jester: "/assets/jester.webp",
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

// Admin PIN for enhanced security (change this to your desired PIN)
export const ADMIN_PIN = "694200";

// PIN verification settings
export const PIN_VERIFICATION_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
export const PIN_SESSION_KEY = "admin_pin_verified";
