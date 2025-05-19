document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const tokenInput = document.getElementById('token');
  const maxLeadsInput = document.getElementById('maxLeads');
  const autoPaginationCheckbox = document.getElementById('autoPagination');
  const thoroughScrapingCheckbox = document.getElementById('thoroughScraping');
  const pageDelayInput = document.getElementById('pageDelay');
  const saveBtn = document.getElementById('save');
  const startBtn = document.getElementById('start');
  const downloadBtn = document.getElementById('download');
  const enrichBtn = document.getElementById('enrich');
  const statusDiv = document.getElementById('status');
  const progressBar = document.getElementById('progressBar');
  const scrapedCountEl = document.getElementById('scrapedCount');
  const sentCountEl = document.getElementById('sentCount');
  const enrichedCountEl = document.getElementById('enrichedCount');
  const settingsToggle = document.getElementById('settingsToggle');
  const settingsSection = document.getElementById('settingsSection');
  const toggleIcon = settingsToggle.querySelector('.toggle-icon');
  
  // Status/UI Vars
  let isScrapingActive = false;
  let isEnrichingActive = false;
  let currentJobId = null;
  
  // Toggle settings section
  settingsToggle.addEventListener('click', () => {
    const isHidden = settingsSection.style.display === 'none' || !settingsSection.style.display;
    settingsSection.style.display = isHidden ? 'block' : 'none';
    toggleIcon.classList.toggle('open', isHidden);
  });
  
  // Load saved settings
  chrome.storage.sync.get(
    [
      'apiToken', 
      'maxLeads', 
      'autoPagination', 
      'thoroughScraping', 
      'pageDelay',
      'settingsExpanded'
    ], 
    (settings) => {
      if (settings.apiToken) tokenInput.value = settings.apiToken;
      if (settings.maxLeads) maxLeadsInput.value = settings.maxLeads;
      
      // Load checkbox settings with default values if not set
      autoPaginationCheckbox.checked = settings.autoPagination !== undefined ? 
        settings.autoPagination : true;
      thoroughScrapingCheckbox.checked = settings.thoroughScraping !== undefined ? 
        settings.thoroughScraping : true;
      
      // Load page delay with default if not set
      if (settings.pageDelay) pageDelayInput.value = settings.pageDelay;
      
      // Expand settings section if it was previously expanded
      if (settings.settingsExpanded) {
        settingsSection.style.display = 'block';
        toggleIcon.classList.add('open');
      }
    }
  );
  
  // Save button
  saveBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    const maxLeads = parseInt(maxLeadsInput.value, 10) || 100;
    const autoPagination = autoPaginationCheckbox.checked;
    const thoroughScraping = thoroughScrapingCheckbox.checked;
    const pageDelay = parseInt(pageDelayInput.value, 10) || 3;
    const settingsExpanded = settingsSection.style.display === 'block';
    
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
          maxLeads: maxLeads,
          autoPagination: autoPagination,
          thoroughScraping: thoroughScraping,
          pageDelay: pageDelay,
          settingsExpanded: settingsExpanded
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
      // Log the token for debugging
      console.log('Validating token:', token);
      
      // Try direct validation with the auth service - ensuring correct JSON format
      try {
        const authResponse = await fetch('http://localhost:8001/auth/validate-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ token: token })
        });
        
        console.log('Auth service response status:', authResponse.status);
        
        if (authResponse.ok) {
          console.log('Token validated successfully by auth service');
          return true;
        } else {
          console.log('Auth service validation failed');
          // Try to get the error message
          const errorData = await authResponse.text();
          console.log('Auth service error:', errorData);
          
          // If token validation failed, try to create a new token
          const newToken = await createNewApiToken();
          if (newToken) {
            console.log('Created new API token:', newToken);
            // Update the token input field with the new token
            tokenInput.value = newToken;
            return true;
          }
        }
      } catch (authError) {
        console.error('Error validating with auth service:', authError);
      }
      
      // Fallback: Try with the import service
      console.log('Trying fallback validation with import service');
      const response = await fetch('http://localhost:8002/api/jobs', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Import service response status:', response.status);
      
      if (response.ok) {
        console.log('Token validated successfully by import service');
        return true;
      } else {
        console.log('Import service validation failed');
      }
      
      return false;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }
  
  // Function to create a new API token
  async function createNewApiToken() {
    try {
      // Use the direct endpoint for extension tokens
      const response = await fetch('http://localhost:8001/extension/get-token');
      
      if (!response.ok) {
        console.error('Failed to generate extension token:', await response.text());
        return null;
      }
      
      const tokenData = await response.json();
      return tokenData.key;
    } catch (error) {
      console.error('Error creating new API token:', error);
      return null;
    }
  }
  
  // Start scraping button
  startBtn.addEventListener('click', () => {
    // Check if token is set
    if (!tokenInput.value.trim()) {
      updateStatus('⚠️ Please set your API token first.', 'warning');
      return;
    }
    
    // Get current settings for scraping
    const maxLeads = parseInt(maxLeadsInput.value, 10) || 100;
    const autoPagination = autoPaginationCheckbox.checked;
    const thoroughScraping = thoroughScrapingCheckbox.checked;
    const pageDelay = parseInt(pageDelayInput.value, 10) || 3;
    
    // Disable buttons during scraping
    isScrapingActive = true;
    startBtn.disabled = true;
    downloadBtn.disabled = true;
    enrichBtn.disabled = true;
    
    // Reset counts
    updateCounts(0, 0, 0);
    updateProgressBar(0);
    
    // Tell background script to start scraping with current settings
    chrome.runtime.sendMessage({ 
      action: 'startScraping',
      settings: {
        maxLeads,
        autoPagination,
        thoroughScraping,
        pageDelay
      }
    });
    
    updateStatus('🚀 Starting scraping process...', 'info');
  });
  
  // Download CSV button
  downloadBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'downloadCSV' });
  });
  
  // Enrich button
  enrichBtn.addEventListener('click', () => {
    // Disable buttons during enrichment
    isEnrichingActive = true;
    enrichBtn.disabled = true;
    
    // Reset enrichment counts
    sentCountEl.textContent = 0;
    enrichedCountEl.textContent = 0;
    
    // Tell background script to send leads for enrichment
    chrome.runtime.sendMessage({ action: 'sendToEnrichment' });
    updateStatus('🔍 Starting enrichment process...', 'info');
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
        
      case 'enableButtons':
        // Enable appropriate buttons based on the message
        if (message.downloadEnabled) {
          downloadBtn.disabled = false;
        }
        if (message.enrichEnabled) {
          enrichBtn.disabled = false;
        }
        // Update lead count if provided
        if (message.leadCount) {
          scrapedCountEl.textContent = message.leadCount;
        }
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
        isEnrichingActive = false;
        startBtn.disabled = false;
        
        // Only re-enable enrichment button if we're done with enrichment
        if (message.enrichmentComplete) {
          enrichBtn.disabled = false;
        }
        
        updateStatus(`✅ Process complete! ${message.total || 0} leads processed.`, 'success');
        break;

      case 'pauseScraping':
        // This is sent when auto-pagination is disabled and we need user input
        startBtn.textContent = 'Continue Scraping';
        startBtn.disabled = false;
        updateStatus(`✋ Reached end of page ${message.currentPage} of ${message.totalPages}. Click 'Continue Scraping' to proceed to the next page.`, 'info');
        isScrapingActive = false;
        break;
    }
  });
  
  // Function to check job status
  function checkJobStatus() {
    if (!currentJobId || (!isScrapingActive && !isEnrichingActive)) return;
    
    chrome.runtime.sendMessage({
      action: 'getJobStatus',
      jobId: currentJobId
    });
    
    // Continue polling if still active
    if (isScrapingActive || isEnrichingActive) {
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
