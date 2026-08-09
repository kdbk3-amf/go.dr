/**
 * Bangladesh administrative structure (divisions + districts).
 *
 * Used by the seed and by location-normalization helpers so that
 * controller code never hardcodes location logic. "Chattogram" is
 * the official name; the normalizer accepts the legacy "Chittagong"
 * spelling and maps it to "Chattogram" for consistent storage/search.
 */

export interface DivisionSeed {
  name: string;
  nameBn: string;
  districts: { name: string; nameBn: string }[];
}

export const BANGLADESH_DIVISIONS: DivisionSeed[] = [
  {
    name: "Barishal",
    nameBn: "বরিশাল",
    districts: [
      { name: "Barishal", nameBn: "বরিশাল" },
      { name: "Barguna", nameBn: "বরগুনা" },
      { name: "Bhola", nameBn: "ভোলা" },
      { name: "Jhalokati", nameBn: "ঝালকাঠি" },
      { name: "Patuakhali", nameBn: "পটুয়াখালী" },
      { name: "Pirojpur", nameBn: "পিরোজপুর" },
    ],
  },
  {
    name: "Chattogram",
    nameBn: "চট্টগ্রাম",
    districts: [
      { name: "Chattogram", nameBn: "চট্টগ্রাম" },
      { name: "Cox's Bazar", nameBn: "কক্সবাজার" },
      { name: "Comilla", nameBn: "কুমিল্লা" },
      { name: "Brahmanbaria", nameBn: "ব্রাহ্মণবাড়িয়া" },
      { name: "Chandpur", nameBn: "চাঁদপুর" },
      { name: "Feni", nameBn: "ফেনী" },
      { name: "Khagrachhari", nameBn: "খাগড়াছড়ি" },
      { name: "Rangamati", nameBn: "রাঙ্গামাটি" },
      { name: "Noakhali", nameBn: "নোয়াখালী" },
    ],
  },
  {
    name: "Dhaka",
    nameBn: "ঢাকা",
    districts: [
      { name: "Dhaka", nameBn: "ঢাকা" },
      { name: "Gazipur", nameBn: "গাজীপুর" },
      { name: "Narayanganj", nameBn: "নারায়ণগঞ্জ" },
      { name: "Manikganj", nameBn: "মানিকগঞ্জ" },
      { name: "Munshiganj", nameBn: "মুন্সিগঞ্জ" },
      { name: "Narsingdi", nameBn: "নরসিংদী" },
      { name: "Tangail", nameBn: "টাঙ্গাইল" },
      { name: "Faridpur", nameBn: "ফরিদপুর" },
      { name: "Gopalganj", nameBn: "গোপালগঞ্জ" },
      { name: "Madaripur", nameBn: "মাদারীপুর" },
      { name: "Rajbari", nameBn: "রাজবাড়ী" },
      { name: "Shariatpur", nameBn: "শরিয়তপুর" },
      { name: "Kishoreganj", nameBn: "কিশোরগঞ্জ" },
      { name: "Netrokona", nameBn: "নেত্রকোণা" },
    ],
  },
  {
    name: "Khulna",
    nameBn: "খুলনা",
    districts: [
      { name: "Khulna", nameBn: "খুলনা" },
      { name: "Bagerhat", nameBn: "বাগেরহাট" },
      { name: "Chuadanga", nameBn: "চুয়াডাঙ্গা" },
      { name: "Jessore", nameBn: "যশোর" },
      { name: "Jhenaidah", nameBn: "ঝিনাইদহ" },
      { name: "Magura", nameBn: "মাগুরা" },
      { name: "Narail", nameBn: "নড়াইল" },
      { name: "Satkhira", nameBn: "সাতক্ষীরা" },
    ],
  },
  {
    name: "Mymensingh",
    nameBn: "ময়মনসিংহ",
    districts: [
      { name: "Mymensingh", nameBn: "ময়মনসিংহ" },
      { name: "Jamalpur", nameBn: "জামালপুর" },
      { name: "Netrokona", nameBn: "নেত্রকোণা" },
      { name: "Sherpur", nameBn: "শেরপুর" },
    ],
  },
  {
    name: "Rajshahi",
    nameBn: "রাজশাহী",
    districts: [
      { name: "Rajshahi", nameBn: "রাজশাহী" },
      { name: "Bogura", nameBn: "বগুড়া" },
      { name: "Joypurhat", nameBn: "জয়পুরহাট" },
      { name: "Naogaon", nameBn: "নওগাঁ" },
      { name: "Natore", nameBn: "নাটোর" },
      { name: "Nawabganj", nameBn: "নবাবগঞ্জ" },
      { name: "Pabna", nameBn: "পাবনা" },
      { name: "Sirajganj", nameBn: "সিরাজগঞ্জ" },
    ],
  },
  {
    name: "Rangpur",
    nameBn: "রংপুর",
    districts: [
      { name: "Rangpur", nameBn: "রংপুর" },
      { name: "Dinajpur", nameBn: "দিনাজপুর" },
      { name: "Gaibandha", nameBn: "গাইবান্ধা" },
      { name: "Kurigram", nameBn: "কুড়িগ্রাম" },
      { name: "Lalmonirhat", nameBn: "লালমনিরহাট" },
      { name: "Nilphamari", nameBn: "নীলফামারী" },
      { name: "Panchagarh", nameBn: "পঞ্চগড়" },
      { name: "Thakurgaon", nameBn: "ঠাকুরগাঁও" },
    ],
  },
  {
    name: "Sylhet",
    nameBn: "সিলেট",
    districts: [
      { name: "Sylhet", nameBn: "সিলেট" },
      { name: "Habiganj", nameBn: "হবিগঞ্জ" },
      { name: "Moulvibazar", nameBn: "মৌলভীবাজার" },
      { name: "Sunamganj", nameBn: "সুনামগঞ্জ" },
    ],
  },
];

/** Legacy/spelling variants normalized to their canonical names. */
const LOCATION_ALIASES: Record<string, string> = {
  chittagong: "Chattogram",
  "comilla": "Comilla",
  "jessore": "Jessore",
  "dhaka city": "Dhaka",
};

/**
 * Normalize a location name to its canonical form. Trims, fixes
 * case for known aliases, and treats "Chittagong" as "Chattogram".
 * Unknown names pass through trimmed & title-cased so callers can
 * still store free-form values.
 */
export function normalizeLocationName(input: string): string {
  const trimmed = input.trim();
  const key = trimmed.toLowerCase();
  if (LOCATION_ALIASES[key]) return LOCATION_ALIASES[key]!;
  // Title-case for consistent storage of free-form input.
  return trimmed.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Convert a name into a URL-safe slug. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
