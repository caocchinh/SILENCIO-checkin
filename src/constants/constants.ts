import { EmailHauntedHouseTicketInfo } from "@/constants/types";

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
    label: "Check in traditional",
    path: "/admin/traditional",
  },
];

// PIN verification settings
export const PIN_VERIFICATION_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
export const PIN_SESSION_KEY = "admin_pin_verified";

export const EMAIL_HAUNTED_HOUSE_TICKET_INFO: EmailHauntedHouseTicketInfo = {
  "Melody of Darkness": {
    ticketImageUrl:
      "https://vteam-online-ticket.vercel.app/assets/melody_of_darkness.webp",
  },
  "Orphaned Soul": {
    ticketImageUrl:
      "https://vteam-online-ticket.vercel.app/assets/orphaned_soul.webp",
  },

  "Whispering Sewers": {
    ticketImageUrl:
      "https://vteam-online-ticket.vercel.app/assets/whispering_sewers.webp",
  },
  Twins: {
    ticketImageUrl: "https://vteam-online-ticket.vercel.app/assets/twins.webp",
  },
};
