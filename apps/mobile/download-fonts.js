const https = require('https');
const fs = require('fs');
const path = require('path');

const fonts = [
  { name: 'Inter-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/static/Inter-Regular.ttf' },
  { name: 'Inter-Medium.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/static/Inter-Medium.ttf' },
  { name: 'Inter-SemiBold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/static/Inter-SemiBold.ttf' },
  { name: 'Inter-Bold.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/static/Inter-Bold.ttf' }
];

fonts.forEach(font => {
  const file = fs.createWriteStream(path.join(__dirname, 'assets', 'fonts', font.name));
  https.get(font.url, function(response) {
    if (response.statusCode === 200) {
        response.pipe(file);
        console.log(`Downloaded ${font.name}`);
    } else if (response.statusCode === 301 || response.statusCode === 302) {
        https.get(response.headers.location, function(redirectResponse) {
             redirectResponse.pipe(file);
             console.log(`Downloaded ${font.name} via redirect`);
        });
    } else {
        console.error(`Failed to download ${font.name}: ${response.statusCode}`);
    }
  }).on('error', err => {
      console.error(`Error downloading ${font.name}: ${err.message}`);
  });
});
