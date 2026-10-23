import doctorAvatar from "@/assets/doctor.jpg";
import gesyLogoAsset from "@/assets/gesy-logo.png.asset.json";

export interface ClinicService {
  id: string;
  title: string;
  description: string;
  isGesyCovered: boolean;
  gesyCoverageNote: string;
  privateFee?: number | undefined;
  featured?: boolean | undefined;
}

export interface WorkingHours {
  days: string;
  hours: string;
  isOpen: boolean;
}

export interface Testimonial {
  name: string;
  text: string;
  rating: number;
  treatment?: string | undefined;
}

export interface FAQ {
  q: string;
  a: string;
}

export interface TrustBadge {
  label: string;
  iconName: "Award" | "ShieldCheck" | "Star" | "Stethoscope";
}

export interface ClinicConfig {
  doctor: {
    name: string;
    prefix: string;
    specialty: string;
    specialtyGreek?: string | undefined;
    tagline: string;
    heroHeading: {
      regular: string;
      highlight: string;
    };
    heroDescription: string;
    bioParagraphs: string[];
    avatarUrl: string;
    avatarAlt: string;
    stats: {
      patientsTreated: string;
      patientRating: string;
      experienceYears: string;
      statCards: Array<{
        value: string;
        label: string;
      }>;
    };
    trustBadges: TrustBadge[];
  };
  gesy: {
    isProvider: boolean;
    badgeText: string;
    subText: string;
    logoUrl: string;
    description: string;
    referralNotice: string;
  };
  services: ClinicService[];
  timeSlots: string[];
  workingHours: WorkingHours[];
  contact: {
    phone: string;
    phoneHref: string;
    email: string;
    emailHref: string;
    emergencyNote?: string | undefined;
    address: {
      street: string;
      city: string;
      postalCode: string;
      country: string;
      full: string;
    };
    location: {
      mapEmbedUrl: string;
      googleMapsUrl?: string | undefined;
      accessibilityNote?: string | undefined;
    };
  };
  testimonials: Testimonial[];
  faqs: FAQ[];
  theme: {
    accentColor: string;
    primaryColor: string;
    goldColor: string;
  };
}

export const clinicConfig: ClinicConfig = {
  doctor: {
    name: "Dr. Marinos Stylianou",
    prefix: "Dr.",
    specialty: "Physiotherapist (Φυσικοθεραπευτής)",
    specialtyGreek: "Φυσικοθεραπευτής",
    tagline: "Εξειδικευμένη Μυοσκελετική Αποκατάσταση & Φυσικοθεραπεία",
    heroHeading: {
      regular: "Εξειδικευμένη Μυοσκελετική Αποκατάσταση &",
      highlight: "Φυσικοθεραπεία.",
    },
    heroDescription:
      "Εξατομικευμένη κλινική φροντίδα, manual therapy και σύγχρονη αποκατάσταση για μυοσκελετικό πόνο, αθλητικούς τραυματισμούς και μετεγχειρητική ενδυνάμωση στη Λεμεσό.",
    bioParagraphs: [
      "Ο Δρ. Μαρίνος Στυλιανού είναι πτυχιούχος φυσικοθεραπευτής με εξειδίκευση στη μυοσκελετική αποκατάσταση, το Manual Therapy και την αθλητική φυσικοθεραπεία.",
      "Στο σύγχρονο κέντρο φυσικοθεραπείας στη Λεμεσό, παρέχει επιστημονικά τεκμηριωμένες θεραπείες, συνδυάζοντας εξειδικευμένες τεχνικές κινητοποίησης με στοχευμένη θεραπευτική άσκηση.",
    ],
    avatarUrl: doctorAvatar,
    avatarAlt: "Dr. Marinos Stylianou — Physiotherapist (Φυσικοθεραπευτής)",
    stats: {
      patientsTreated: "3,000+",
      patientRating: "4.9",
      experienceYears: "12+",
      statCards: [
        { value: "12+", label: "Χρόνια Εμπειρίας" },
        { value: "MSc", label: "Sports Rehab" },
        { value: "ΓεΣΥ", label: "Συμβεβλημένος" },
      ],
    },
    trustBadges: [
      { label: "12+ Χρόνια Εμπειρίας", iconName: "Award" },
      { label: "Συμβεβλημένος ΓεΣΥ", iconName: "ShieldCheck" },
      { label: "4.9 Αξιολόγηση Ασθενών", iconName: "Star" },
    ],
  },
  gesy: {
    isProvider: true,
    badgeText: "Συμβεβλημένος Πάροχος ΓεΣΥ",
    subText: "Καλύπτεται με έγκυρο παραπεμπτικό",
    logoUrl: gesyLogoAsset.url,
    description:
      "Οι δικαιούχοι του Γενικού Συστήματος Υγείας (ΓεΣΥ) μπορούν να πραγματοποιήσουν τις συνεδρίες τους με έγκυρο παραπεμπτικό ειδικού ιατρού.",
    referralNotice: "Covered by GeSY (With Referral)",
  },
  services: [
    {
      id: "initial",
      title: "Αρχική Εκτίμηση & Μυοσκελετικός Έλεγχος",
      description:
        "Ολοκληρωμένη κλινική αξιολόγηση, λήψη ιστορικού, εμβιομηχανικός έλεγχος και σχεδιασμός εξατομικευμένου πλάνου αποκατάστασης.",
      isGesyCovered: true,
      gesyCoverageNote: "Covered by GeSY (With Referral)",
      featured: true,
    },
    {
      id: "rehabilitation",
      title: "Συνεδρία Φυσικοθεραπείας / Rehabilitation",
      description:
        "Εξατομικευμένη κινησιοθεραπεία, νευρομυϊκή επανεκπαίδευση, θεραπευτική ενδυνάμωση και συνεχής αξιολόγηση της αποκατάστασης.",
      isGesyCovered: true,
      gesyCoverageNote: "Covered by GeSY (With Referral)",
    },
    {
      id: "manual-therapy",
      title: "Ειδική Θεραπεία / Manual Therapy",
      description:
        "Εξειδικευμένες τεχνικές κινητοποίησης μαλακών μορίων και αρθρώσεων, μυοπεριτονιακή απελευθέρωση και άμεση ανακούφιση από χρόνιο πόνο.",
      isGesyCovered: false,
      gesyCoverageNote: "",
      privateFee: 50,
    },
  ],
  timeSlots: [
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:30",
    "14:30",
    "15:30",
    "16:30",
    "17:30",
    "18:30",
  ],
  workingHours: [
    { days: "Δευτέρα – Παρασκευή", hours: "08:30 – 19:30", isOpen: true },
    { days: "Σάββατο", hours: "09:00 – 13:00", isOpen: true },
    { days: "Κυριακή", hours: "Κλειστά", isOpen: false },
  ],
  contact: {
    phone: "+357 25 987 654",
    phoneHref: "tel:+35725987654",
    email: "info@drstylianou.clinic",
    emailHref: "mailto:info@drstylianou.clinic",
    emergencyNote:
      "Για επείγοντα περιστατικά εκτός ωραρίου, παρακαλούμε απευθυνθείτε στο πλησιέστερο νοσοκομείο.",
    address: {
      street: "45 Gladstonos Street, Office 201",
      city: "Limassol",
      postalCode: "3040",
      country: "Cyprus",
      full: "45 Gladstonos Street, Office 201, 3040 Limassol, Cyprus",
    },
    location: {
      mapEmbedUrl:
        "https://www.openstreetmap.org/export/embed.html?bbox=33.035%2C34.675%2C33.055%2C34.685&layer=mapnik&marker=34.6800%2C33.0450",
      googleMapsUrl: "https://maps.google.com/?q=34.6800,33.0450",
      accessibilityNote:
        "Πλήρως προσβάσιμο φυσικοθεραπευτήριο με ανελκυστήρα και θέσεις στάθμευσης για ασθενείς.",
    },
  },
  testimonials: [
    {
      name: "Κώστας Νικολάου",
      treatment: "Μυοσκελετική Αποκατάσταση",
      text: "Μετά από μήνες με οσφυαλγία, το πλάνο θεραπείας του κ. Στυλιανού μου έδωσε πίσω την καθημερινότητά μου. Εξαιρετικός επαγγελματίας.",
      rating: 5,
    },
    {
      name: "Ελένη Παπαδοπούλου",
      treatment: "Αθλητικός Τραυματισμός Ώμου",
      text: "Στοχευμένη θεραπεία και ουσιαστική παρακολούθηση. Η επαναφορά μου στις προπονήσεις έγινε ταχύτερα και με απόλυτη ασφάλεια.",
      rating: 5,
    },
    {
      name: "Μιχάλης Γεωργίου",
      treatment: "Μετεγχειρητική Αποκατάσταση Γόνατος",
      text: "Η ευγένεια, η υπομονή και οι σύγχρονες γνώσεις του γιατρού έκαναν τη διαδικασία της αποκατάστασης απόλυτα επιτυχημένη.",
      rating: 5,
    },
  ],
  faqs: [
    {
      q: "Χρειάζεται παραπεμπτικό για συνεδρίες μέσω ΓεΣΥ;",
      a: "Ναι, για την κάλυψη των φυσικοθεραπειών μέσω ΓεΣΥ απαιτείται ενεργό παραπεμπτικό από τον προσωπικό ή ειδικό σας ιατρό.",
    },
    {
      q: "Μπορώ να κλείσω ραντεβού ιδιωτικά χωρίς παραπεμπτικό;",
      a: "Βεβαίως. Μπορείτε να προγραμματίσετε ιδιωτική συνεδρία ή Manual Therapy απευθείας online χωρίς παραπεμπτικό.",
    },
    {
      q: "Τι χρειάζεται να έχω μαζί μου στην πρώτη επίσκεψη;",
      a: "Παρακαλούμε να έχετε την ταυτότητα / αριθμό ΓεΣΥ, τυχόν πρόσφατες απεικονιστικές εξετάσεις (μαγνητική, ακτινογραφία) και άνετα ρούχα.",
    },
    {
      q: "Πώς μπορώ να αλλάξω ή να ακυρώσω το ραντεβού μου;",
      a: "Επικοινωνήστε τηλεφωνικώς ή μέσω email τουλάχιστον 24 ώρες πριν από το ραντεβού σας για να εξυπηρετηθεί άλλος ασθενής.",
    },
  ],
  theme: {
    accentColor: "oklch(0.95 0.02 170)",
    primaryColor: "oklch(0.38 0.08 170)",
    goldColor: "oklch(0.74 0.11 80)",
  },
};
