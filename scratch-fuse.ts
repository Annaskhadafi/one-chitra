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
  "PT Pamapersada Nusantara"
]

// Sort by length descending, so we prefer longer, more formal names as the 'master'
// Wait, is it better to use "PAMA" or "PT Pamapersada Nusantara"? 
// Usually the more formal one.
const sortedNames = [...rawNames].sort((a, b) => b.length - a.length);

const masterList: string[] = [];
const mapping: Record<string, string> = {};

for (const name of sortedNames) {
  if (masterList.length === 0) {
    masterList.push(name);
    mapping[name] = name;
    continue;
  }

  const fuse = new Fuse(masterList, {
    includeScore: true,
    threshold: 0.4, // lower threshold = stricter
  });

  const results = fuse.search(name);
  if (results.length > 0 && results[0].score !== undefined && results[0].score < 0.4) {
    mapping[name] = results[0].item;
  } else {
    masterList.push(name);
    mapping[name] = name;
  }
}

console.log("Mapping:", mapping);
