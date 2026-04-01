const https = require('https');
https.get('https://www.via-id.com/', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const logos = data.match(/src="[^"]*logo[^"]*"/gi);
    const colors = data.match(/#[0-9a-fA-F]{6}/g);
    console.log('Logos:', [...new Set(logos)].slice(0, 5));
    
    const colorCounts = {};
    if (colors) {
      colors.forEach(c => colorCounts[c.toLowerCase()] = (colorCounts[c.toLowerCase()] || 0) + 1);
      const sortedColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
      console.log('Colors:', sortedColors);
    }
  });
});
