import Fuse from 'fuse.js'

const rawNames = [
  "Stamford",
  "Stamford Tire",
  "STAMFORD",
  "Stamford Tyres",
  "STAMFORD TYRE INDONESIA",
  "pt stamford tyres distributor indonesia"
]

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
