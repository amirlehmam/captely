// Injects a "Scraper" button into Sales Navigator
(function injectButton() {
  const toolPanel = document.querySelector('.search-results-container__controls');
  if (!toolPanel || document.getElementById('captely-scrape-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'captely-scrape-btn';
  btn.textContent = 'Scraper';
  btn.style = 'margin-left:8px;padding:4px 8px;background:#0073b1;color:#fff;border:none;border-radius:4px;cursor:pointer;';
  btn.onclick = () => chrome.runtime.sendMessage({ action: 'START_SCRAPE' });
  toolPanel.appendChild(btn);
})();
