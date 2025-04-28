document.addEventListener('DOMContentLoaded', () => {
    const tokenInput   = document.getElementById('token');
    const maxLeadsInput= document.getElementById('maxLeads');
    const saveBtn      = document.getElementById('save');
    const startBtn     = document.getElementById('start');
    const statusDiv    = document.getElementById('status');
  
    // Load saved settings
    chrome.storage.sync.get(['apiToken', 'maxLeads'], ({ apiToken, maxLeads }) => {
      if (apiToken)   tokenInput.value = apiToken;
      if (maxLeads)   maxLeadsInput.value = maxLeads;
    });
  
    saveBtn.addEventListener('click', () => {
      chrome.storage.sync.set({
        apiToken: tokenInput.value.trim(),
        maxLeads: parseInt(maxLeadsInput.value, 10) || 100
      }, () => {
        statusDiv.textContent = '✔ Settings saved';
        setTimeout(()=> statusDiv.textContent = '', 2000);
      });
    });
  
    startBtn.addEventListener('click', () => {
      statusDiv.textContent = '🚀 Starting…';
      chrome.runtime.sendMessage({ action: 'startScraping' });
    });
  
    // Listen for status updates from background
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === 'updateStatus') {
        statusDiv.textContent = msg.message;
      } else if (msg.action === 'done') {
        statusDiv.textContent = `✅ Done: ${msg.total} leads`;
      }
    });
  });
  
  // popup.js (or content-script.js)
async function getApiKey() {
  return new Promise(resolve => {
    chrome.storage.sync.get("apiKey", ({ apiKey }) => {
      if (apiKey) return resolve(apiKey);
      const k = prompt("Enter your Captely API key");
      chrome.storage.sync.set({ apiKey: k }, () => resolve(k));
    });
  });
}

async function sendLeads(leadsBatch) {
  const apiKey = await getApiKey();
  await fetch("https://your-captely-domain.com/imports", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ leads: leadsBatch }),
  });
}

// After scraping a page of prospects:
sendLeads([{ firstName, lastName, profileUrl, ... }, /*…*/]);
