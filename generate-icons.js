const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

// Icon sizes to generate
const sizes = [16, 32, 64, 192, 512];

async function generateIcons() {
  console.log('🎨 Generating icons for Project Manager...\n');

  const svgPath = path.join(__dirname, 'public', 'icon.svg');
  const publicDir = path.join(__dirname, 'public');

  try {
    // Generate PNG files for each size
    console.log('📦 Generating PNG files...');
    const pngBuffers = {};

    for (const size of sizes) {
      const pngPath = path.join(publicDir, `logo${size}.png`);
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(pngPath);

      console.log(`  ✅ Created logo${size}.png`);

      // Store buffer for ICO creation
      pngBuffers[size] = await sharp(svgPath)
        .resize(size, size)
        .png()
        .toBuffer();
    }

    // Create favicon.ico (16x16, 32x32, 48x48)
    console.log('\n🔖 Generating favicon.ico...');
    const png48 = await sharp(svgPath).resize(48, 48).png().toBuffer();
    const faviconIco = await toIco([
      pngBuffers[16],
      pngBuffers[32],
      png48
    ]);
    fs.writeFileSync(path.join(publicDir, 'favicon.ico'), faviconIco);
    console.log('  ✅ Created favicon.ico');

    // Create app-icon.ico for desktop shortcut (256x256 for high quality)
    console.log('\n🖼️  Generating app-icon.ico for desktop shortcut...');
    const png256 = await sharp(svgPath).resize(256, 256).png().toBuffer();
    const appIconIco = await toIco([
      pngBuffers[16],
      pngBuffers[32],
      png48,
      pngBuffers[64],
      png256
    ]);
    fs.writeFileSync(path.join(__dirname, 'app-icon.ico'), appIconIco);
    console.log('  ✅ Created app-icon.ico');

    console.log('\n✨ All icons generated successfully!\n');
    console.log('Generated files:');
    console.log('  - public/logo16.png');
    console.log('  - public/logo32.png');
    console.log('  - public/logo64.png');
    console.log('  - public/logo192.png');
    console.log('  - public/logo512.png');
    console.log('  - public/favicon.ico');
    console.log('  - app-icon.ico (for desktop shortcut)\n');

  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
