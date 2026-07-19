const fs = require('fs');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Only replace if not already replaced
  if (!content.includes('id="backBtn"')) {
    content = content.replace(
      /<a href="app\.html#set"[^>]*>Back to Settings<\/a>/g,
      `<a href="app.html#set" id="backBtn" class="btn-hero btn-hero-primary" style="display: inline-block; margin-top: 32px; text-decoration: none;">Back to Settings</a>
    <script>
      const btn = document.getElementById('backBtn');
      if (!document.referrer || !document.referrer.includes('app.html')) {
        btn.href = 'index.html';
        btn.textContent = 'Back to Home';
      }
    </script>`
    );
  }

  // Restore circle if missing
  if (file === 'privacy.html' && !content.includes('<circle cx="12"')) {
    content = content.replace(
      /<svg class="theme-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">/,
      `<svg class="theme-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">\n      <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2" />`
    );
  }
  
  fs.writeFileSync(file, content);
}

fixFile('privacy.html');
fixFile('terms.html');
console.log('Fixed files');
