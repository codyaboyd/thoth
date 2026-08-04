const fs = require('fs');
const path = require('path');
const https = require('https');

function downloadFileHF() {
  return new Promise((resolve, reject) => {
    const modelUrl = 'https://huggingface.co/bitcloud/M7Q5/resolve/main/m7q5';
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

module.exports = { downloadFileHF };
