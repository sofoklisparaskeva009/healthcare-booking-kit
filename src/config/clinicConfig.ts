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
    name: "Dr. Elena Markou",
    prefix: "Dr.",
    specialty: "Physiotherapy & Rehabilitation",
    specialtyGreek: "Φυσικοθεραπεία & Αποκατάσταση",
    tagline: "Move freely. Live fully.",
    heroHeading: {
      regular: "Move freely.",
      highlight: "Live fully.",
    },
    heroDescription:
      "Evidence-based care for pain, injury and recovery — delivered with patience, precision and a plan tailored around you.",
    bioParagraphs: [
      "Dr. Elena Markou is a board-certified physiotherapist specialising in musculoskeletal rehabilitation, sports injuries and post-operative recovery.",
      "With over a decade of clinical experience across hospital and private practice, she combines hands-on manual therapy with modern, evidence-based exercise programmes.",
    ],
    avatarUrl: doctorAvatar,
    avatarAlt: "Dr. Elena Markou — Specialist Physiotherapist",
    stats: {
      patientsTreated: "2,500+",
      patientRating: "4.9",
      experienceYears: "10+",
      statCards: [
        { value: "10+", label: "Years practice" },
        { value: "MSc", label: "Sports Rehab" },
        { value: "EU", label: "Board Certified" },
      ],
    },
    trustBadges: [
      { label: "10+ Years Experience", iconName: "Award" },
      { label: "Board Certified", iconName: "ShieldCheck" },
      { label: "4.9 Patient Rating", iconName: "Star" },
    ],
  },
  gesy: {
    isProvider: true,
    badgeText: "Συμβεβλημένος Ιατρός ΓεΣΥ / GeSY Provider",
    subText: "Covered with valid referral",
    logoUrl: gesyLogoAsset.url,
    description:
      "Beneficiaries of the General Healthcare System (GeSY / ΓεΣΥ) can book covered sessions with a valid specialist referral.",
    referralNotice: "Covered by GeSY (With Referral)",
  },
  services: [
    {
      id: "initial",
      title: "Initial Consultation",
      description:
        "Comprehensive clinical assessment, medical history review, biomechanical evaluation and a personalised treatment plan.",
      isGesyCovered: true,
      gesyCoverageNote: "Covered by GeSY (With Referral)",
      privateFee: 60,
      featured: true,
    },
    {
      id: "followup",
      title: "Follow-up Visit",
      description:
        "Progress review, targeted treatment adjustments, functional reassessment and continuous rehabilitation care.",
      isGesyCovered: true,
      gesyCoverageNote: "Covered by GeSY (With Referral)",
      privateFee: 40,
    },
    {
      id: "therapy",
      title: "Specialized Therapy",
      description:
        "Targeted manual therapy, neuromuscular rehabilitation and evidence-based functional exercises for complex conditions.",
      isGesyCovered: true,
      gesyCoverageNote: "Covered by GeSY (With Referral)",
      privateFee: 80,
    },
  ],
  timeSlots: ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"],
  workingHours: [
    { days: "Monday – Friday", hours: "09:00 – 18:00", isOpen: true },
    { days: "Saturday", hours: "09:00 – 13:00", isOpen: true },
    { days: "Sunday", hours: "Closed", isOpen: false },
  ],
  contact: {
    phone: "+357 22 123 456",
    phoneHref: "tel:+35722123456",
    email: "hello@drmarkou.clinic",
    emailHref: "mailto:hello@drmarkou.clinic",
    emergencyNote:
      "For acute emergencies, please visit your nearest hospital emergency department.",
    address: {
      street: "24 Ermou Street",
      city: "Nicosia",
      postalCode: "1011",
      country: "Cyprus",
      full: "24 Ermou Street, 1011 Nicosia, Cyprus",
    },
    location: {
      mapEmbedUrl:
        "https://www.openstreetmap.org/export/embed.html?bbox=33.357%2C35.168%2C33.375%2C35.180&layer=mapnik&marker=35.1742%2C33.3644",
      googleMapsUrl: "https://maps.google.com/?q=35.1742,33.3644",
      accessibilityNote: "Ground-floor clinic with wheelchair accessibility and nearby parking.",
    },
  },
  testimonials: [
    {
      name: "Maria K.",
      treatment: "Post-op Knee Rehab",
      text: "After months of back pain, three sessions made a real difference. Calm, attentive and thorough.",
      rating: 5,
    },
    {
      name: "Andreas P.",
      treatment: "Sports Injury",
      text: "Recovered from my knee surgery faster than expected. The plan was clear and easy to follow.",
      rating: 5,
    },
    {
      name: "Sophie L.",
      treatment: "Spine Rehabilitation",
      text: "Booking online was effortless, and the care itself was outstanding. Highly recommend.",
      rating: 5,
    },
  ],
  faqs: [
    {
      q: "Do I need a referral for GeSY appointments?",
      a: "Yes, to have your session covered under GeSY (ΓεΣΥ), you will need an active referral from your personal doctor or specialist.",
    },
    {
      q: "Can I book privately without a referral?",
      a: "Absolutely. Private consultations do not require a referral and can be booked directly online at your convenience.",
    },
    {
      q: "What should I bring to my first visit?",
      a: "Please bring your ID / GeSY beneficiary card (if applicable), any recent medical imaging or reports, and wear comfortable clothing.",
    },
    {
      q: "Can I reschedule or cancel my appointment?",
      a: "Yes. Please contact us via phone or email at least 24 hours in advance so we can offer your slot to another patient.",
    },
  ],
  theme: {
    accentColor: "oklch(0.95 0.02 170)",
    primaryColor: "oklch(0.38 0.08 170)",
    goldColor: "oklch(0.74 0.11 80)",
  },
};
