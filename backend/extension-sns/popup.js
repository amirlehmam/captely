document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const tokenInput = document.getElementById('token');
  const maxLeadsInput = document.getElementById('maxLeads');
  const saveBtn = document.getElementById('save');
  const startBtn = document.getElementById('start');
  const downloadBtn = document.getElementById('download');
  const statusDiv = document.getElementById('status');
  const progressBar = document.getElementById('progressBar');
  const scrapedCountEl = document.getElementById('scrapedCount');
  const sentCountEl = document.getElementById('sentCount');
  const enrichedCountEl = document.getElementById('enrichedCount');
  
  // Status/UI Vars
  let isScrapingActive = false;
  let currentJobId = null;
  
  // Load saved settings
  chrome.storage.sync.get(['apiToken', 'maxLeads'], ({ apiToken, maxLeads }) => {
    if (apiToken) tokenInput.value = apiToken;
    if (maxLeads) maxLeadsInput.value = maxLeads;
  });
  
  // Save button
  saveBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    const maxLeads = parseInt(maxLeadsInput.value, 10) || 100;
    
    // Validate
    if (!token) {
      updateStatus('⚠️ Please enter a valid API token.', 'warning');
      return;
    }
    
    // Validate token with backend
    updateStatus('🔍 Validating API token...', 'info');
    
    try {
      const isValid = await validateApiToken(token);
      
      if (isValid) {
        // Save settings
        chrome.storage.sync.set({
          apiToken: token,
          maxLeads: maxLeads
        }, () => {
          updateStatus('✅ API token validated and settings saved!', 'success');
        });
      } else {
        updateStatus('❌ Invalid API token. Please check and try again.', 'error');
      }
    } catch (error) {
      updateStatus(`❌ Error validating token: ${error.message}`, 'error');
    }
  });
  
  // Validate API token with the backend
  async function validateApiToken(token) {
    try {
      const response = await fetch('http://localhost:8002/api/jobs', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.ok;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }
  
  // Start scraping button
  startBtn.addEventListener('click', () => {
    // Check if token is set
    if (!tokenInput.value.trim()) {
      updateStatus('⚠️ Please set your API token first.', 'warning');
      return;
    }
    
    // Disable buttons during scraping
    isScrapingActive = true;
    startBtn.disabled = true;
    downloadBtn.disabled = true;
    
    // Reset counts
    updateCounts(0, 0, 0);
    updateProgressBar(0);
    
    // Tell background script to start scraping
    chrome.runtime.sendMessage({ action: 'startScraping' });
    updateStatus('🚀 Starting scraping process...', 'info');
  });
  
  // Download CSV button
  downloadBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'downloadCSV' });
  });
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message) => {
    switch (message.action) {
      case 'updateStatus':
        updateStatus(message.message, message.type || 'info');
        break;
        
      case 'updateProgress':
        updateCounts(
          message.scraped || 0,
          message.sent || 0,
          message.enriched || 0
        );
        const total = message.total || 100;
        const progressPercent = Math.min(
          Math.round((message.scraped / total) * 100),
          100
        );
        updateProgressBar(progressPercent);
        break;
        
      case 'enableDownload':
        downloadBtn.disabled = false;
        break;
        
      case 'jobCreated':
        currentJobId = message.jobId;
        // Start polling for job status
        setTimeout(() => {
          checkJobStatus();
        }, 2000);
        break;
        
      case 'done':
        isScrapingActive = false;
        startBtn.disabled = false;
        updateStatus(`✅ Scraping complete! ${message.total} leads processed.`, 'success');
        break;
    }
  });
  
  // Function to check job status
  function checkJobStatus() {
    if (!currentJobId || !isScrapingActive) return;
    
    chrome.runtime.sendMessage({
      action: 'getJobStatus',
      jobId: currentJobId
    });
    
    // Continue polling if still active
    if (isScrapingActive) {
      setTimeout(checkJobStatus, 3000);
    }
  }
  
  // Helper to update status with styling
  function updateStatus(message, type = 'info') {
    statusDiv.textContent = message;
    
    // Reset classes
    statusDiv.classList.remove('status-info', 'status-success', 'status-warning', 'status-error');
    
    // Add appropriate class
    statusDiv.classList.add(`status-${type}`);
  }
  
  // Helper to update count elements
  function updateCounts(scraped, sent, enriched) {
    scrapedCountEl.textContent = scraped;
    sentCountEl.textContent = sent;
    enrichedCountEl.textContent = enriched;
  }
  
  // Helper to update progress bar
  function updateProgressBar(percent) {
    progressBar.style.width = `${percent}%`;
  }
});
