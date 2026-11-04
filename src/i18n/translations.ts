import type { Locale } from "./locales";

/**
 * UI dictionaries. Greek (`el`) is the source of truth for the shape;
 * every other locale must provide exactly the same keys (enforced by the
 * `Dictionary` type below). Entries that need interpolation are functions.
 */
const el = {
  language: {
    label: "Γλώσσα",
    switchTo: "Αλλαγή γλώσσας",
    names: { el: "Ελληνικά", en: "English" },
    short: { el: "GR", en: "EN" },
  },
  nav: {
    services: "Υπηρεσίες",
    about: "Σχετικά",
    testimonials: "Κριτικές",
    faq: "Συχνές Ερωτήσεις",
    contact: "Επικοινωνία",
    book: "Κλείστε Ραντεβού",
  },
  hero: {
    book: "Κλείστε Ραντεβού",
    viewServices: "Δείτε τις υπηρεσίες",
    patientsTreated: "ασθενείς έχουν εξυπηρετηθεί",
    gesyLogoAlt: "Λογότυπο ΓεΣΥ",
  },
  sections: {
    bookingEyebrow: "Online Κράτηση",
    bookingTitle: "Κλείστε το ραντεβού σας",
    servicesEyebrow: "Θεραπείες",
    servicesTitle: "Υπηρεσίες & κάλυψη",
    aboutEyebrow: "Γνωρίστε τον Θεραπευτή",
    aboutTitle: "Φροντίδα που πρώτα ακούει.",
    testimonialsEyebrow: "Κριτικές",
    testimonialsTitle: "Τι λένε οι ασθενείς μας",
    faqEyebrow: "Συχνές Ερωτήσεις",
    faqTitle: "Απαντήσεις σε συνήθεις απορίες",
    contactEyebrow: "Επίσκεψη",
    contactTitle: "Επικοινωνία & τοποθεσία",
  },
  services: {
    privateFee: (fee: number) => `Ιδιωτική χρέωση · €${fee}`,
  },
  contact: {
    address: "Διεύθυνση",
    phone: "Τηλέφωνο",
    email: "Email",
    workingHours: "Ωράριο λειτουργίας",
    mapTitle: "Χάρτης τοποθεσίας κλινικής",
  },
  footer: {
    rights: "Με την επιφύλαξη παντός δικαιώματος.",
  },
  booking: {
    steps: ["Υπηρεσία", "Ημερομηνία & Ώρα", "Στοιχεία", "Επιβεβαίωση"],
    categoryLegend: "Επιλέξτε κατηγορία ραντεβού",
    selectDate: "Επιλέξτε ημερομηνία",
    availableSlots: "Διαθέσιμες ώρες για επίσκεψη στην κλινική",
    fields: {
      fullName: { label: "Ονοματεπώνυμο", placeholder: "π.χ. Μαρία Γεωργίου" },
      phone: { label: "Αριθμός τηλεφώνου", placeholder: "π.χ. +357 99 123456" },
      email: { label: "Διεύθυνση email", placeholder: "π.χ. maria@example.com" },
      notes: {
        label: "Σημειώσεις / Λόγος επίσκεψης (Προαιρετικό)",
        placeholder: "Αναφέρετε τυχόν συμπτώματα, πρόσφατο τραυματισμό ή στοιχεία παραπεμπτικού...",
      },
      preferredLanguage: {
        label: "Γλώσσα ειδοποιήσεων",
        help: "Σε αυτή τη γλώσσα θα λάβετε το email και το SMS επιβεβαίωσης.",
      },
    },
    summary: {
      title: "Σύνοψη κράτησης",
      doctor: "Θεραπευτής / Κλινική",
      category: "Κατηγορία ραντεβού",
      service: "Υπηρεσία",
      date: "Ημερομηνία",
      time: "Ώρα",
      patientName: "Ονοματεπώνυμο",
      phone: "Τηλέφωνο",
      email: "Email",
      notes: "Σημειώσεις",
      notificationLanguage: "Γλώσσα ειδοποιήσεων",
      coverage: "Κάλυψη",
      privateFee: "Ιδιωτική χρέωση",
    },
    actions: {
      back: "Πίσω",
      continue: "Συνέχεια",
      review: "Έλεγχος κράτησης",
      confirm: "Επιβεβαίωση ραντεβού",
      bookAnother: "Νέο ραντεβού",
    },
    success: {
      title: "Το αίτημα ραντεβού καταχωρήθηκε",
      body: (p: { firstName: string; doctor: string; service: string; category: string; date: string; time: string }) =>
        `Ευχαριστούμε, ${p.firstName}. Το ραντεβού σας με ${p.doctor} για «${p.service}» (${p.category}) την ${p.date} στις ${p.time} έχει καταχωρηθεί.`,
      note: "Θα λάβετε επιβεβαίωση μέσω email/SMS και η κλινική θα επικοινωνήσει μαζί σας εάν χρειαστεί αλλαγή.",
    },
    errors: {
      fullName: "Παρακαλώ εισάγετε το ονοματεπώνυμό σας",
      phone: "Παρακαλώ εισάγετε έγκυρο αριθμό τηλεφώνου",
      email: "Παρακαλώ εισάγετε έγκυρο email",
      notes: "Οι σημειώσεις είναι πολύ μεγάλες",
      invalid_service: "Παρακαλώ επιλέξτε μια έγκυρη υπηρεσία.",
      slot_taken: "Η ώρα αυτή μόλις κρατήθηκε. Παρακαλώ επιλέξτε άλλη.",
      save_failed: "Δεν ήταν δυνατή η αποθήκευση της κράτησης. Παρακαλώ δοκιμάστε ξανά.",
      generic: "Κάτι πήγε στραβά. Παρακαλώ δοκιμάστε ξανά.",
    },
  },
};

export type Dictionary = typeof el;

const en: Dictionary = {
  language: {
    label: "Language",
    switchTo: "Change language",
    names: { el: "Ελληνικά", en: "English" },
    short: { el: "GR", en: "EN" },
  },
  nav: {
    services: "Services",
    about: "About",
    testimonials: "Testimonials",
    faq: "FAQ",
    contact: "Contact",
    book: "Book Appointment",
  },
  hero: {
    book: "Book Appointment",
    viewServices: "View services",
    patientsTreated: "patients treated",
    gesyLogoAlt: "GeSY Logo",
  },
  sections: {
    bookingEyebrow: "Online Booking",
    bookingTitle: "Book your appointment",
    servicesEyebrow: "Treatments",
    servicesTitle: "Services & coverage",
    aboutEyebrow: "About the Specialist",
    aboutTitle: "Care that listens first.",
    testimonialsEyebrow: "Testimonials",
    testimonialsTitle: "What patients say",
    faqEyebrow: "FAQ",
    faqTitle: "Common questions",
    contactEyebrow: "Visit",
    contactTitle: "Contact & location",
  },
  services: {
    privateFee: (fee: number) => `Private fee · €${fee}`,
  },
  contact: {
    address: "Address",
    phone: "Phone",
    email: "Email",
    workingHours: "Working hours",
    mapTitle: "Clinic location map",
  },
  footer: {
    rights: "All rights reserved.",
  },
  booking: {
    steps: ["Service", "Date & Time", "Your Details", "Confirm"],
    categoryLegend: "Choose Appointment Category",
    selectDate: "Select a date",
    availableSlots: "Available time slots for clinic visits",
    fields: {
      fullName: { label: "Full Name", placeholder: "e.g. Maria Georgiou" },
      phone: { label: "Phone Number", placeholder: "e.g. +357 99 123456" },
      email: { label: "Email Address", placeholder: "e.g. maria@example.com" },
      notes: {
        label: "Notes / Reason for Visit (Optional)",
        placeholder: "Mention any symptoms, recent injury, or referral details...",
      },
      preferredLanguage: {
        label: "Notification Language",
        help: "Your confirmation email and SMS will be sent in this language.",
      },
    },
    summary: {
      title: "Booking Summary",
      doctor: "Doctor / Clinic",
      category: "Appointment Category",
      service: "Service",
      date: "Date",
      time: "Time",
      patientName: "Patient Name",
      phone: "Phone",
      email: "Email",
      notes: "Notes",
      notificationLanguage: "Notification Language",
      coverage: "Coverage",
      privateFee: "Private Fee",
    },
    actions: {
      back: "Back",
      continue: "Continue",
      review: "Review booking",
      confirm: "Confirm appointment",
      bookAnother: "Book another appointment",
    },
    success: {
      title: "Appointment requested",
      body: (p) =>
        `Thank you, ${p.firstName}. Your appointment with ${p.doctor} for "${p.service}" (${p.category}) on ${p.date} at ${p.time} has been received.`,
      note: "You will receive a confirmation by email/SMS and our clinic will reach out if any scheduling adjustment is needed.",
    },
    errors: {
      fullName: "Please enter your full name",
      phone: "Please enter a valid phone number",
      email: "Please enter a valid email",
      notes: "Notes are too long",
      invalid_service: "Please choose a valid service.",
      slot_taken: "That time slot was just taken. Please choose another.",
      save_failed: "Could not save your booking. Please try again.",
      generic: "Something went wrong. Please try again.",
    },
  },
};

export const translations: Record<Locale, Dictionary> = { el, en };

export function getDictionary(locale: Locale): Dictionary {
  return translations[locale];
}

