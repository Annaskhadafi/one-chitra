const fs = require("fs");
const file = "app/dashboard/marketing/instagram-generator/instagram-image-generator-client.tsx";
let c = fs.readFileSync(file, "utf8");

// Find the noPersonBase block and add headline stripping
const oldNoPersonBase = `    // Strip any existing wearpack/orang instruction from base template
    const noPersonBase = base
      .replace(/\\n?Variant note:[^\\n]*wearpack[^\\n]*/gi, "")
      .replace(/\\n?[^\\n]*WAJIB[^\\n]*wearpack[^\\n]*/gi, "")`;

const newNoPersonBase = `    // Strip any existing wearpack/orang instruction from base template
    // Also strip static headline so field controls it (empty = AI auto-generates)
    const noPersonBase = base
      .replace(/\\n?Variant note:[^\\n]*wearpack[^\\n]*/gi, "")
      .replace(/\\n?[^\\n]*WAJIB[^\\n]*wearpack[^\\n]*/gi, "")
      .replace(/\\nHeadline text: "[^"]*"\\n/g, "\\n")
      .replace(/^Headline text: "[^"]*"\\n/gm, "")`;

if (c.includes(oldNoPersonBase)) {
  c = c.replace(oldNoPersonBase, newNoPersonBase);
  console.log("noPersonBase updated OK");
} else {
  console.log("NOT FOUND - trying partial");
  const idx = c.indexOf("const noPersonBase = base");
  console.log("noPersonBase at:", idx);
  console.log(JSON.stringify(c.substring(idx, idx + 300)));
}

fs.writeFileSync(file, c, "utf8");
