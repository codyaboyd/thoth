const fs = require('fs');
const path = require('path');
const https = require('https');

function downloadFileHF() {
  return new Promise((resolve, reject) => {
    const modelUrl = 'https://huggingface.co/bitcloud/Mistral-7b-InstructV2-Q5K-API-Llamafile/resolve/main/m7q5';
    const outputPath = path.join(__dirname, './m7q5');

    const download = (url) => {
      https.get(url, (response) => {
        // Follow redirect
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          //console.log(`Redirected to ${response.headers.location}`);
          console.log(`Downloading m7q5 from HuggingFace LFS`);
          download(response.headers.location); // Follow the redirect
          return;
        }

        // Check for HTTP success status
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download the file. Status Code: ${response.statusCode}`));
          return;
        }

        const file = fs.createWriteStream(outputPath);
        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log('Download completed successfully.');
          resolve(outputPath);
        });

        file.on('error', (err) => {
          console.error('Error writing the file:', err.message);
          fs.unlink(outputPath, () => reject(err)); // Delete the file asynchronously on error
        });
      }).on('error', (err) => {
        console.error('Error downloading the file:', err.message);
        reject(err);
      });
    };
    download(modelUrl);
  });
}

// Hard-coded values
const MASTER_CID = 'bafybeiazj6ehzeo2zx5opx67kjm44rtz22hqze6ypboz7h7ivzivuorobm';
const OUTPUT_DIR = path.resolve('.'); // Current directory

/**
 * Downloads a file from IPFS.
 */
const downloadFile = (cid, outputFileName) => {
  return new Promise((resolve, reject) => {
    const url = `https://cloudflare-ipfs.com/ipfs/${cid}/${outputFileName}`;
    const filePath = path.join(OUTPUT_DIR, outputFileName);
    const file = fs.createWriteStream(filePath);
    console.log("Downloading Chunk: " + outputFileName);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filePath);
        console.log("Saved Chunk: " + outputFileName);
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => reject(err));
    });
  });
};

/**
 * Reassembles a file from parts defined in a master.json file.
 */
const reassembleModel = async () => {
  console.log("Large File (~6GB): This may take awhile.");
  const masterJsonPath = await downloadFile(MASTER_CID, 'master.json');
  const masterData = JSON.parse(fs.readFileSync(masterJsonPath, 'utf-8'));

  const outputFilePath = path.join(OUTPUT_DIR, masterData.originalFileName);

  await new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(outputFilePath);

    fileStream.on('finish', () => {
      console.log(`File reassembled: ${outputFilePath}`);
      resolve();
    });

    fileStream.on('error', reject);

    (async () => {
      for (const chunkInfo of masterData.parts) {
        const chunkFileName = `${chunkInfo.order}.json`;
        const chunkPath = await downloadFile(chunkInfo.cid, chunkFileName);

        const chunkJson = JSON.parse(fs.readFileSync(chunkPath, 'utf-8'));
        const chunkData = Buffer.from(chunkJson.data, 'base64');

        if (!fileStream.write(chunkData)) {
          await new Promise(resolve => fileStream.once('drain', resolve));
        }

        fs.unlinkSync(chunkPath);
      }

      fileStream.end();
    })().catch(error => {
      console.error("An error occurred:", error);
      fileStream.close();
      reject(error);
    });
  });

  // Clean up master.json
  fs.unlinkSync(masterJsonPath);
};

// Exporting the reassemble function to be called from another script
module.exports = { reassembleModel,downloadFileHF };
