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
  const progressPercent = document.getElementById('progressPercent');
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
  
  // Define production API base - FIXED to always use production
  const API_BASE = 'https://captely.com/api';
  
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
      updateStatus('Please enter a valid API token.', 'warning', '⚠️');
      return;
    }
    
    // Show loading state
    saveBtn.disabled = true;
    updateStatus('Validating API token...', 'info', '🔍');
    
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
          updateStatus('API token validated and settings saved!', 'success', '✅');
          saveBtn.disabled = false;
        });
      } else {
        updateStatus('Invalid API token. Please check and try again.', 'error', '❌');
        saveBtn.disabled = false;
      }
    } catch (error) {
      updateStatus(`Error validating token: ${error.message}`, 'error', '❌');
      saveBtn.disabled = false;
    }
  });
  
  // Validate API token with the backend
  async function validateApiToken(token) {
    try {
      console.log('Validating token:', token);
      
      // First try to validate with auth service
      try {
        const authResponse = await fetch(`${API_BASE}/auth/validate-token`, {
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
        }
      } catch (authError) {
        console.error('Error validating with auth service:', authError);
      }
      
      // Fallback: Try with the import service to check if token works
      console.log('Trying fallback validation with import service');
      const response = await fetch(`${API_BASE}/imports/jobs`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Import service response status:', response.status);
      
      if (response.ok || response.status === 401) {
        // 401 means token format is recognized but may be invalid
        // 200 means token is valid
        console.log('Token validation completed');
        return response.ok;
      }
      
      return false;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }
  
  // Start scraping button
  startBtn.addEventListener('click', () => {
    // Check if token is set
    if (!tokenInput.value.trim()) {
      updateStatus('Please set your API token first.', 'warning', '⚠️');
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
    
    // Add loading spinner to start button
    startBtn.innerHTML = '<div class="loading-spinner"></div> Scraping...';
    
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
    
    updateStatus('Starting scraping process...', 'info', '🚀');
  });
  
  // Download CSV button
  downloadBtn.addEventListener('click', () => {
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '<div class="loading-spinner"></div> Downloading...';
    
    chrome.runtime.sendMessage({ action: 'downloadCSV' });
    
    // Re-enable button after a short delay
    setTimeout(() => {
      downloadBtn.disabled = false;
      downloadBtn.innerHTML = '<span>📥</span> Download CSV';
    }, 2000);
  });
  
  // Enrich button
  enrichBtn.addEventListener('click', () => {
    // Disable buttons during enrichment
    isEnrichingActive = true;
    enrichBtn.disabled = true;
    enrichBtn.innerHTML = '<div class="loading-spinner"></div> Processing...';
    
    // Reset enrichment counts
    sentCountEl.textContent = 0;
    enrichedCountEl.textContent = 0;
    
    // Tell background script to send leads for enrichment
    chrome.runtime.sendMessage({ action: 'sendToEnrichment' });
    updateStatus('Starting enrichment process...', 'info', '🔍');
  });
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message) => {
    switch (message.action) {
      case 'updateStatus':
        updateStatus(message.message, message.type || 'info', message.icon);
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
          downloadBtn.innerHTML = '<span>📥</span> Download CSV';
        }
        if (message.enrichEnabled) {
          enrichBtn.disabled = false;
          enrichBtn.innerHTML = '<span>✨</span> Send for Enrichment';
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
        startBtn.innerHTML = '<span>🚀</span> Start Scraping';
        
        // Only re-enable enrichment button if we're done with enrichment
        if (message.enrichmentComplete) {
          enrichBtn.disabled = false;
          enrichBtn.innerHTML = '<span>✨</span> Send for Enrichment';
        }
        
        updateStatus(`Process complete! ${message.total || 0} leads processed.`, 'success', '✅');
        break;

      case 'pauseScraping':
        // This is sent when auto-pagination is disabled and we need user input
        startBtn.innerHTML = '<span>▶️</span> Continue Scraping';
        startBtn.disabled = false;
        updateStatus(`Reached end of page ${message.currentPage} of ${message.totalPages}. Click 'Continue Scraping' to proceed to the next page.`, 'info', '✋');
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
  
  // Helper to update status with styling and icons
  function updateStatus(message, type = 'info', icon = null) {
    const statusIcon = statusDiv.querySelector('.status-icon');
    const statusText = statusDiv.querySelector('span:last-child') || statusDiv;
    
    // Update icon if provided
    if (icon && statusIcon) {
      statusIcon.textContent = icon;
    }
    
    // Update text - if there's an icon span, update the text span, otherwise the whole div
    if (statusIcon && statusDiv.children.length > 1) {
      statusText.textContent = message;
    } else {
      statusDiv.innerHTML = `<span class="status-icon">${icon || '🎯'}</span><span>${message}</span>`;
    }
    
    // Reset classes
    statusDiv.classList.remove('status-info', 'status-success', 'status-warning', 'status-error');
    
    // Add appropriate class
    statusDiv.classList.add(`status-${type}`);
  }
  
  // Helper to update count elements with animation
  function updateCounts(scraped, sent, enriched) {
    animateCounter(scrapedCountEl, scraped);
    animateCounter(sentCountEl, sent);
    animateCounter(enrichedCountEl, enriched);
  }
  
  // Helper to animate counter updates
  function animateCounter(element, newValue) {
    const currentValue = parseInt(element.textContent) || 0;
    if (currentValue !== newValue) {
      element.style.transform = 'scale(1.2)';
      element.style.color = '#667eea';
      
      setTimeout(() => {
        element.textContent = newValue;
        element.style.transform = 'scale(1)';
        setTimeout(() => {
          element.style.color = '';
        }, 150);
      }, 100);
    }
  }
  
  // Helper to update progress bar with percentage
  function updateProgressBar(percent) {
    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    
    // Add some visual feedback
    if (percent > 0) {
      progressBar.style.opacity = '1';
    }
    
    // Change color based on progress
    if (percent >= 100) {
      progressBar.style.background = 'linear-gradient(90deg, #34d399 0%, #10b981 100%)';
    } else {
      progressBar.style.background = 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)';
    }
  }
  
  // Check if we're on LinkedIn Sales Navigator on load
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab && !currentTab.url.includes('linkedin.com/sales')) {
      updateStatus('Please navigate to LinkedIn Sales Navigator to use this extension.', 'warning', '⚠️');
      startBtn.disabled = true;
    } else {
      updateStatus('Ready to scrape Sales Navigator leads...', 'info', '🎯');
    }
  });
  
  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 's':
          e.preventDefault();
          if (!saveBtn.disabled) saveBtn.click();
          break;
        case 'Enter':
          e.preventDefault();
          if (!startBtn.disabled) startBtn.click();
          break;
      }
    }
  });
});
