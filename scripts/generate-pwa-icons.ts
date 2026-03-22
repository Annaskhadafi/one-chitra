import sharp from "sharp";
import fs from "fs";
import path from "path";

const sourceImage = "public/logo.png";
const outputDir = "public/icons";

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateIcons() {
  try {
    // 192x192
    await sharp(sourceImage)
      .resize(192, 192)
      .toFile(path.join(outputDir, "icon-192x192.png"));
    
    // 512x512
    await sharp(sourceImage)
      .resize(512, 512)
      .toFile(path.join(outputDir, "icon-512x512.png"));

    // Apple Touch Icon 180x180
    await sharp(sourceImage)
      .resize(180, 180)
      .toFile(path.join(outputDir, "apple-touch-icon.png"));

    console.log("Icons generated successfully!");
  } catch (error) {
    console.error("Error generating icons:", error);
  }
}

generateIcons();
