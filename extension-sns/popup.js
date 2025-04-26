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
  