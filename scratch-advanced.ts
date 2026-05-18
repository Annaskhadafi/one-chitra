import Fuse from 'fuse.js'

const rawNames = [
  "Star Wagen Ind.",
  "Star Wagen Indonesia",
  "PT. Star Wagen Indonesia",
  "Kideco",
  "PT Kideco Jaya Agung",
  "BUMA",
  "PT Bukit Makmur Mandiri Utama",
  "Bukit Makmur",
  "PAMA",
  "PT Pamapersada Nusantara",
  "Stamford",
  "Stamford Tire",
  "STAMFORD",
  "Stamford Tyres",
  "STAMFORD TYRE INDONESIA",
  "pt stamford tyres distributor indonesia",
  "Intraco Penta Wahana",
  "Intracopenta Wahana",
  "Intraco Penta",
  "PT Intraco Penta"
]

function cleanCompanyName(name: string) {
    return name.toUpperCase()
        .replace(/^PT\.?\s*/i, '')
        .replace(/^CV\.?\s*/i, '')
        .replace(/IND\.$/i, 'INDONESIA')
        .replace(/TYRES?/i, 'TIRE')
        .replace(/\s+/g, '') // remove spaces to match "Intracopenta" vs "Intraco Penta"
        .trim();
}

const uniqueNames = Array.from(new Set(rawNames));

// We want to map each rawName to a 'Master Name'.
// Let's sort rawNames by length descending, so the longest/most formal name becomes the master.
const sortedNames = [...uniqueNames].sort((a, b) => b.length - a.length);

const masterList: { raw: string, clean: string }[] = [];
const mapping: Record<string, string> = {};

for (const raw of sortedNames) {
  const clean = cleanCompanyName(raw);
  
  if (masterList.length === 0) {
    masterList.push({ raw, clean });
    mapping[raw] = raw;
    continue;
  }

  // Exact match on clean string
  const exactMatch = masterList.find(m => m.clean === clean || m.clean.includes(clean) || clean.includes(m.clean));
  if (exactMatch) {
      mapping[raw] = exactMatch.raw;
      continue;
  }

  const fuse = new Fuse(masterList, {
    keys: ['clean'],
    includeScore: true,
    threshold: 0.3,
    ignoreLocation: true,
  });

  const results = fuse.search(clean);
  if (results.length > 0 && results[0].score !== undefined && results[0].score < 0.3) {
    mapping[raw] = results[0].item.raw;
  } else {
    masterList.push({ raw, clean });
    mapping[raw] = raw;
  }
}

console.log("Mapping:");
for (const [key, value] of Object.entries(mapping)) {
    console.log(`"${key}" -> "${value}"`);
}
