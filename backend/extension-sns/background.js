// Storage for leads data for CSV download
let scrapedLeads = [];
let jobId = null;

// Listen for popup messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startScraping') {
    startScraping();
    sendResponse({ status: 'ok' });
    return true;
  } else if (msg.action === 'downloadCSV') {
    downloadCSV();
    sendResponse({ status: 'ok' });
    return true;
  } else if (msg.action === 'getJobStatus') {
    checkJobStatus(msg.jobId);
    sendResponse({ status: 'checking' });
    return true;
  }
});

// Main scraping function
async function startScraping() {
  // Reset data
  scrapedLeads = [];
  jobId = null;
  
  // Get settings
  const { apiToken, maxLeads } = await chrome.storage.sync.get(['apiToken', 'maxLeads']);
  
  // Validate settings
  if (!apiToken) {
    updateStatus('⚠️ API token not set. Please set your API token first.', 'error');
    return;
  }

  try {
    // Get the active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      updateStatus('⚠️ No active tab found.', 'error');
      return;
    }

    // Check if we're on LinkedIn Sales Navigator
    if (!activeTab.url.includes('linkedin.com/sales')) {
      updateStatus('⚠️ Please navigate to LinkedIn Sales Navigator to use this extension.', 'error');
      return;
    }

    let totalScraped = 0;
    let keepScrolling = true;
    
    updateStatus('🚀 Starting scraping process...', 'info');
    updateProgress(0, 0, 0, maxLeads);

    // Main scraping loop
    while (keepScrolling && totalScraped < maxLeads) {
      // Scrape visible leads
      const [{ result: newLeads }] = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => window.CaptelyScraper.scrapeVisible()
      });

      // Process new leads (deduplicate based on profile URL)
      const uniqueNewLeads = newLeads.filter(newLead => 
        !scrapedLeads.some(existingLead => existingLead.profileUrl === newLead.profileUrl)
      );
      
      // Add unique leads to our collection
      scrapedLeads.push(...uniqueNewLeads);
      
      // Limit to maxLeads
      if (scrapedLeads.length > maxLeads) {
        scrapedLeads = scrapedLeads.slice(0, maxLeads);
      }
      
      totalScraped = scrapedLeads.length;
      
      // Update UI with progress
      updateStatus(`🕵️‍♀️ Scraped ${totalScraped} leads...`, 'info');
      updateProgress(totalScraped, 0, 0, maxLeads);
      
      // Check if we've reached the maximum
      if (totalScraped >= maxLeads) {
        keepScrolling = false;
        break;
      }
      
      // Scroll down to reveal more leads
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: (distance) => window.CaptelyScraper.smoothScroll(distance),
        args: [window.innerHeight / 2]
      });
      
      // Short pause for LinkedIn to load more results
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
      
      // Check if we've reached the bottom of the page
      const [{ result: atBottom }] = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => window.CaptelyScraper.isAtBottom()
      });
      
      if (atBottom) {
        keepScrolling = false;
        updateStatus(`🛑 Reached the end of the page with ${totalScraped} leads.`, 'info');
      }
    }
    
    // Enable CSV download button
    chrome.runtime.sendMessage({ action: 'enableDownload' });
    
    if (totalScraped > 0) {
      // Send to backend for enrichment in batches
      const batchSize = 20;
      let sentCount = 0;
      
      updateStatus('📤 Sending leads to Captely for enrichment...', 'info');
      
      for (let i = 0; i < scrapedLeads.length; i += batchSize) {
        const batch = scrapedLeads.slice(i, i + batchSize);
        try {
          const response = await sendToBackend(batch, apiToken);
          sentCount += batch.length;
          
          if (response.job_id && !jobId) {
            jobId = response.job_id;
            // Start checking job status
            checkJobStatus(jobId);
          }
          
          updateStatus(`📤 Sent ${sentCount}/${totalScraped} leads to Captely`, 'info');
          updateProgress(totalScraped, sentCount, 0, maxLeads);
          
          // Small delay between batches
          await new Promise(r => setTimeout(r, 500));
        } catch (error) {
          updateStatus(`❌ Error sending batch: ${error.message}`, 'error');
          console.error('Error sending batch:', error);
        }
      }
      
      updateStatus(`✅ Scraping complete! ${totalScraped} leads sent for enrichment.`, 'success');
    } else {
      updateStatus('⚠️ No leads found to scrape.', 'warning');
    }
  } catch (error) {
    updateStatus(`❌ Scraping error: ${error.message}`, 'error');
    console.error('Scraping error:', error);
  }
}

// Send leads to the backend
async function sendToBackend(leads, apiToken) {
  const response = await fetch('http://localhost:8002/api/scraper/leads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify({ leads })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Backend error (${response.status}): ${errorText}`);
  }
  
  return await response.json();
}

// Check the status of an enrichment job
async function checkJobStatus(jobId) {
  if (!jobId) return;
  
  const { apiToken } = await chrome.storage.sync.get(['apiToken']);
  if (!apiToken) return;
  
  try {
    const response = await fetch(`http://localhost:8002/api/jobs/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`
      }
    });
    
    if (!response.ok) {
      console.error(`Error checking job status: ${response.status}`);
      return;
    }
    
    const jobData = await response.json();
    const enrichedCount = jobData.completed || 0;
    const totalCount = jobData.total || scrapedLeads.length;
    
    // Update UI with enrichment progress
    updateProgress(totalCount, totalCount, enrichedCount, totalCount);
    
    if (jobData.status === 'completed' || enrichedCount >= totalCount) {
      updateStatus(`✨ Enrichment complete! ${enrichedCount}/${totalCount} leads enriched.`, 'success');
    } else {
      updateStatus(`🔍 Enriching leads... ${enrichedCount}/${totalCount} completed.`, 'info');
      // Check again in 2 seconds
      setTimeout(() => checkJobStatus(jobId), 2000);
    }
  } catch (error) {
    console.error('Error checking job status:', error);
  }
}

// Download leads as CSV
function downloadCSV() {
  if (scrapedLeads.length === 0) {
    updateStatus('⚠️ No leads to download.', 'warning');
    return;
  }
  
  // Create CSV content
  const headers = ['First Name', 'Last Name', 'Full Name', 'Position', 'Company', 'LinkedIn URL', 'Location', 'Industry', 'Email', 'Phone'];
  let csvContent = headers.join(',') + '\n';
  
  // Add rows
  scrapedLeads.forEach(lead => {
    // Format fields properly for CSV (handle commas, quotes, etc.)
    const row = [
      formatCSVField(lead.firstName),
      formatCSVField(lead.lastName),
      formatCSVField(lead.fullName),
      formatCSVField(lead.position),
      formatCSVField(lead.company),
      formatCSVField(lead.profileUrl),
      formatCSVField(lead.location),
      formatCSVField(lead.industry),
      formatCSVField(lead.email || ''),
      formatCSVField(lead.phone || '')
    ];
    csvContent += row.join(',') + '\n';
  });
  
  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  // Create and trigger download
  chrome.downloads.download({
    url: url,
    filename: `captely_leads_${new Date().toISOString().slice(0, 10)}.csv`,
    saveAs: true
  });
  
  updateStatus(`📥 Downloaded ${scrapedLeads.length} leads as CSV.`, 'success');
}

// Helper function to format CSV fields
function formatCSVField(value) {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  // If the field contains commas, quotes, or newlines, wrap it in quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    // Replace any existing quotes with double quotes
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

// Update status message in popup
function updateStatus(message, type = 'info') {
  chrome.runtime.sendMessage({ 
    action: 'updateStatus', 
    message,
    type
  });
}

// Update progress indicators
function updateProgress(scraped, sent, enriched, total) {
  chrome.runtime.sendMessage({ 
    action: 'updateProgress', 
    scraped,
    sent,
    enriched,
    total
  });
}
  