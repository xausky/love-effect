const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuration
const TARGET_WIDTH = 512; // Or higher if needed for high DPR, but 512 is good for performance
const TARGET_ASPECT_RATIO = 4 / 3; // From PhotoGeometry(3, 2.25) -> 3 / 2.25 = 1.333
const TARGET_HEIGHT = Math.round(TARGET_WIDTH / TARGET_ASPECT_RATIO); // 384

// Arguments
const sourceDir = process.argv[2];
const outputDir = path.join(__dirname, '../public/photos');

if (!sourceDir) {
    console.error('Please provide a source directory path.');
    console.error('Usage: node scripts/process-photos.js <source_directory>');
    process.exit(1);
}

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

function getImagesRecursively(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(getImagesRecursively(file));
        } else {
            const ext = path.extname(file).toLowerCase();
            if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
                results.push(file);
            }
        }
    });
    return results;
}

async function processPhotos() {
    try {
        // Recursively find images
        const imageFiles = getImagesRecursively(sourceDir);

        // Sort naturally
        // Since these are full paths now, we might want to sort by filename or just full path
        imageFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        console.log(`Found ${imageFiles.length} images. Processing...`);

        let count = 0;
        const processedFiles = [];

        for (let i = 0; i < imageFiles.length; i++) {
            const sourcePath = imageFiles[i]; // This is already the full path
            const targetFilename = `${i + 1}.webp`;
            const targetPath = path.join(outputDir, targetFilename);

            await sharp(sourcePath)
                .resize({
                    width: TARGET_WIDTH,
                    height: TARGET_HEIGHT,
                    fit: 'cover', // Crop to center
                    position: 'center'
                })
                .webp({ quality: 80 })
                .toFile(targetPath);

            processedFiles.push(targetFilename);
            process.stdout.write(`\rProcessed ${i + 1}/${imageFiles.length}: ${targetFilename}`);
            count++;
        }

        // Write index.json
        const indexJsonPath = path.join(outputDir, 'index.json');
        fs.writeFileSync(indexJsonPath, JSON.stringify(processedFiles, null, 2));
        console.log('\nGenerated index.json');

        console.log('\nDone! Processed ' + count + ' photos.');
        console.log(`Output directory: ${outputDir}`);

    } catch (err) {
        console.error('Error processing photos:', err);
    }
}

processPhotos();
