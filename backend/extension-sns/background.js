// Storage for leads data for CSV download
let scrapedLeads = [];
let jobId = null;

// Define production API base - FIXED to always use production
const API_BASE = 'https://captely.com/api';

// Listen for popup messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("Background script received message:", msg);
  
  if (msg.action === 'startScraping') {
    startScraping(msg.settings)
      .then(() => sendResponse({ status: 'ok' }))
      .catch(error => {
        console.error('Error in startScraping:', error);
        updateStatus(`Scraping error: ${error.message}`, 'error', '❌');
        sendResponse({ status: 'error', message: error.message });
      });
    return true; // Keep the message channel open for async response
  } else if (msg.action === 'downloadCSV') {
    downloadCSV()
      .then(() => sendResponse({ status: 'ok' }))
      .catch(error => {
        console.error('Error in downloadCSV:', error);
        updateStatus(`Download error: ${error.message}`, 'error', '❌');
        sendResponse({ status: 'error', message: error.message });
      });
    return true;
  } else if (msg.action === 'sendToEnrichment') {
    sendToEnrichment()
      .then(() => sendResponse({ status: 'ok' }))
      .catch(error => {
        console.error('Error in sendToEnrichment:', error);
        updateStatus(`Enrichment error: ${error.message}`, 'error', '❌');
        sendResponse({ status: 'error', message: error.message });
      });
    return true;
  } else if (msg.action === 'getJobStatus') {
    checkJobStatus(msg.jobId);
    sendResponse({ status: 'checking' });
    return true;
  }
});

// Main scraping function
async function startScraping(settings = {}) {
  try {
    // Reset data
    scrapedLeads = [];
    jobId = null;
    
    // Get settings from storage and combine with passed settings
    const storageSettings = await chrome.storage.sync.get(['apiToken', 'maxLeads']);
    
    // Use settings from passed parameters, falling back to storage settings
    const maxLeads = settings.maxLeads || storageSettings.maxLeads || 100;
    const autoPagination = settings.autoPagination !== undefined ? settings.autoPagination : true;
    const thoroughScraping = settings.thoroughScraping !== undefined ? settings.thoroughScraping : true;
    const pageDelay = settings.pageDelay || 3;
    
    const apiToken = storageSettings.apiToken;
    
    console.log("Using scraping settings:", { 
      maxLeads, 
      autoPagination, 
      thoroughScraping,
      pageDelay 
    });
  
    // Validate settings
    if (!apiToken) {
      updateStatus('API token not set. Please set your API token first.', 'error', '⚠️');
      return;
    }

    // Get the active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      updateStatus('No active tab found.', 'error', '⚠️');
      return;
    }

    console.log("Active tab URL:", activeTab.url);

    // Check if we're on LinkedIn Sales Navigator
    if (!activeTab.url.includes('linkedin.com/sales')) {
      updateStatus('Please navigate to LinkedIn Sales Navigator to use this extension.', 'error', '⚠️');
      return;
    }

    let totalScraped = 0;
    let currentPage = 1;
    let totalPages = 1;
    let hasMorePages = true;
    
    updateStatus('Starting scraping process...', 'info', '🚀');
    updateProgress(0, 0, 0, maxLeads);

    // First, inject our content script programmatically to be sure it's there
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ['contentscript.js']
    });
    
    console.log("Injected contentscript.js");
    
    // Check if the scraper object is available
    const checkResult = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => {
        return {
          scraperExists: typeof window.CaptelyScraper !== 'undefined',
          isTable: document.querySelector('table') !== null,
          rowCount: document.querySelector('table')?.querySelectorAll('tbody tr')?.length || 0
        };
      }
    });
    
    console.log("Scraper check:", checkResult[0]?.result);
    
    // Main scraping loop - now with pagination support
    while (hasMorePages && totalScraped < maxLeads) {
      // Start by checking pagination info
      const paginationResult = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => {
          // Check if CaptelyScraper exists
          if (!window.CaptelyScraper) {
            return { error: "CaptelyScraper not initialized" };
          }
          return window.CaptelyScraper.getPaginationInfo();
        }
      });
      
      console.log("Pagination info:", paginationResult[0]?.result);
      
      if (paginationResult && paginationResult[0] && !paginationResult[0].result.error) {
        const paginationInfo = paginationResult[0].result;
        currentPage = paginationInfo.currentPage || currentPage;
        totalPages = paginationInfo.totalPages || totalPages;
        hasMorePages = paginationInfo.hasPagination && currentPage < totalPages;
      }
      
      updateStatus(`Scraping page ${currentPage} of ${totalPages}...`, 'info', '🔍');
      
      // Wait a moment for the page to stabilize
      await new Promise(r => setTimeout(r, pageDelay * 1000));
      
      // If thorough scraping is enabled, scroll down to load all leads
      if (thoroughScraping) {
        // Scroll down multiple times to ensure all content is loaded
        let scrollCount = 0;
        let isBottom = false;
        const maxScrollAttempts = 10; // Increased from 5 to 10
        
        updateStatus(`Scrolling page to load all leads...`, 'info', '📜');
        
        // First, scroll to top to start from the beginning
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            window.scrollTo({ top: 0, behavior: 'auto' });
          }
        });
        
        // Wait a moment for the page to stabilize
        await new Promise(r => setTimeout(r, 1000));
        
        // Get page height to determine scroll distance
        const pageHeightResult = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            return document.body.scrollHeight;
          }
        });
        
        const pageHeight = pageHeightResult[0]?.result || 5000;
        const scrollDistance = Math.max(800, Math.floor(pageHeight / 8)); // Larger scroll distance
        
        while (!isBottom && scrollCount < maxScrollAttempts) {
          // Scroll down with larger distance
          await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: (distance) => {
              window.scrollBy({
                top: distance,
                behavior: 'smooth'
              });
            },
            args: [scrollDistance]
          });
          
          // Wait longer for content to load (2 seconds instead of 1)
          await new Promise(r => setTimeout(r, 2000));
          
          // Check if we've reached the bottom
          const bottomCheckResult = await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: () => {
              if (!window.CaptelyScraper) return true;
              return window.CaptelyScraper.isAtBottom();
            }
          });
          
          isBottom = bottomCheckResult[0]?.result === true;
          scrollCount++;
          
          // Log the scrolling progress
          console.log(`Scroll attempt ${scrollCount}/${maxScrollAttempts}, reached bottom: ${isBottom}`);
        }
        
        // Extra scroll to very bottom to ensure everything is loaded
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            window.scrollTo({ 
              top: document.body.scrollHeight, 
              behavior: 'smooth' 
            });
          }
        });
        
        // Wait extra time at the bottom
        await new Promise(r => setTimeout(r, 3000));
        
        // Scroll back to top
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        });
        
        // Wait a moment for the UI to stabilize
        await new Promise(r => setTimeout(r, 1500));
        
        updateStatus(`Finished scrolling, now scraping leads...`, 'info', '✅');
      }
      
      // Scrape visible leads on this page
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => {
          console.log("Executing scrapeVisible in page context");
          // Check if CaptelyScraper exists
          if (!window.CaptelyScraper) {
            console.error("CaptelyScraper not initialized in page");
            return { error: "CaptelyScraper not initialized" };
          }
          
          // Debug table presence
          const table = document.querySelector('table');
          console.log("Table found:", !!table);
          if (table) {
            console.log("Rows in table:", table.querySelectorAll('tbody tr').length);
          }
          
          const results = window.CaptelyScraper.scrapeVisible();
          console.log("scrapeVisible returned:", results.length, "leads");
          return { data: results };
        }
      });
      
      console.log("Scraping results:", results);
      
      // Handle potential errors
      if (!results || !results[0] || results[0].result.error) {
        const errorMsg = results?.[0]?.result?.error || 'Unknown error during scraping';
        console.error("Scraping error:", errorMsg);
        updateStatus(`Error: ${errorMsg}`, 'error', '⚠️');
        break;
      }
      
      const newLeads = results[0].result.data;
      console.log(`Got ${newLeads.length} new leads from page ${currentPage}`);
      
      // If no leads were found, try scrolling down to reveal more
      if (newLeads.length === 0) {
        console.log("No leads found, trying to scroll down");
        
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: (distance) => {
            window.scrollBy({
              top: distance,
              behavior: 'smooth'
            });
          },
          args: [500]
        });
        
        // Wait for content to load after scrolling
        await new Promise(r => setTimeout(r, 2000));
        
        // Try again one more time
        const retryResults = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            if (!window.CaptelyScraper) {
              return { error: "CaptelyScraper not initialized" };
            }
            const results = window.CaptelyScraper.scrapeVisible();
            console.log("Retry scrapeVisible returned:", results.length, "leads");
            return { data: results };
          }
        });
        
        if (retryResults && retryResults[0] && !retryResults[0].result.error) {
          const retryLeads = retryResults[0].result.data;
          console.log(`Got ${retryLeads.length} leads on retry`);
          
          if (retryLeads.length === 0) {
            // If still no leads after retry, try next page or stop
            if (hasMorePages) {
              if (autoPagination) {
                const navigateResult = await navigateToNextPage(activeTab.id);
                if (!navigateResult) {
                  hasMorePages = false;
                  updateStatus(`Failed to navigate to next page.`, 'warning', '⚠️');
                  break;
                }
                currentPage++;
                continue;
              } else {
                // Pause and wait for user action if auto-pagination is disabled
                chrome.runtime.sendMessage({ 
                  action: 'pauseScraping',
                  currentPage,
                  totalPages
                });
                return; // Exit the scraping function, await user restart
              }
            } else {
              // No more pages, stop scraping
              hasMorePages = false;
              updateStatus('No more leads found to scrape.', 'warning', '⚠️');
              break;
            }
          } else {
            // Process the retry leads
            newLeads.push(...retryLeads);
          }
        }
      }

      // Process new leads (deduplicate based on profile URL)
      const uniqueNewLeads = newLeads.filter(newLead => 
        !scrapedLeads.some(existingLead => existingLead.profileUrl === newLead.profileUrl)
      );
      
      console.log(`Found ${uniqueNewLeads.length} unique new leads on page ${currentPage}`);
      
      // Add unique leads to our collection
      scrapedLeads.push(...uniqueNewLeads);
      
      // Update counts and progress
      totalScraped = scrapedLeads.length;
      
      // Update UI with progress
      updateStatus(`Scraped ${totalScraped} leads from ${currentPage} of ${totalPages} pages...`, 'info', '🕵️‍♀️');
      updateProgress(totalScraped, 0, 0, maxLeads);
      
      // Check if we've reached the maximum
      if (totalScraped >= maxLeads) {
        hasMorePages = false;
        updateStatus(`Reached the maximum of ${maxLeads} leads.`, 'success', '✅');
        break;
      }
      
      // If there are more pages, navigate to the next page
      if (hasMorePages) {
        // If auto-pagination is disabled, pause and notify user
        if (!autoPagination) {
          chrome.runtime.sendMessage({ 
            action: 'pauseScraping',
            currentPage,
            totalPages
          });
          return; // Exit the scraping function, await user restart
        }
        
        updateStatus(`Navigating to page ${currentPage + 1}...`, 'info', '📄');
        const navigateResult = await navigateToNextPage(activeTab.id);
        if (!navigateResult) {
          hasMorePages = false;
          updateStatus(`Failed to navigate to next page.`, 'warning', '⚠️');
          break;
        }
        
        // Increment page counter
        currentPage++;
        
        // Wait for the next page to load (LinkedIn can be slow)
        await new Promise(r => setTimeout(r, pageDelay * 1000));
      } else {
        updateStatus(`Reached the last page with ${totalScraped} leads.`, 'info', '🛑');
        break;
      }
    }
    
    if (totalScraped > 0) {
      // Enable both buttons after scraping is done
      chrome.runtime.sendMessage({ 
        action: 'enableButtons', 
        downloadEnabled: true,
        enrichEnabled: true,
        leadCount: totalScraped
      });
      
      updateStatus(`Scraping complete! Found ${totalScraped} leads from ${currentPage} pages. You can now download CSV or send for enrichment.`, 'success', '✅');
    } else {
      updateStatus('No leads found to scrape. Make sure you are on a Sales Navigator list with visible results.', 'warning', '⚠️');
    }
  } catch (error) {
    updateStatus(`Scraping error: ${error.message}`, 'error', '❌');
    console.error('Scraping error:', error);
    throw error;
  }
}

// Helper function to navigate to the next page
async function navigateToNextPage(tabId) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (!window.CaptelyScraper || !window.CaptelyScraper.goToNextPage) {
          console.error("Navigation function not available");
          return false;
        }
        return window.CaptelyScraper.goToNextPage();
      }
    });
    
    return result[0]?.result === true;
  } catch (error) {
    console.error("Error navigating to next page:", error);
    return false;
  }
}

// Send leads for enrichment
async function sendToEnrichment() {
  // Get settings
  const { apiToken } = await chrome.storage.sync.get(['apiToken']);
  
  if (!apiToken) {
    updateStatus('API token not set. Please set your API token first.', 'error', '⚠️');
    return;
  }
  
  if (scrapedLeads.length === 0) {
    updateStatus('No leads to enrich. Please scrape leads first.', 'warning', '⚠️');
    return;
  }
  
  try {
    // Send to backend for enrichment in batches
    const batchSize = 20;
    let sentCount = 0;
    const totalCount = scrapedLeads.length;
      
    updateStatus('Sending leads to Captely for enrichment...', 'info', '📤');
      
    for (let i = 0; i < scrapedLeads.length; i += batchSize) {
      const batch = scrapedLeads.slice(i, i + batchSize);
      try {
        const response = await sendToBackend(batch, apiToken);
        sentCount += batch.length;
        
        if (response.job_id && !jobId) {
          jobId = response.job_id;
          // Open dashboard page for progress
          chrome.tabs.create({ url: `https://captely.com/dashboard?job=${jobId}` });
          // Start checking job status
          checkJobStatus(jobId);
        }
        
        updateStatus(`Sent ${sentCount}/${totalCount} leads to Captely`, 'info', '📤');
        updateProgress(totalCount, sentCount, 0, totalCount);
          
        // Small delay between batches
        await new Promise(r => setTimeout(r, 500));
      } catch (error) {
        updateStatus(`Error sending batch: ${error.message}`, 'error', '❌');
        console.error('Error sending batch:', error);
        throw error; // Re-throw to handle in the caller
      }
    }
    
    updateStatus(`All ${totalCount} leads sent for enrichment.`, 'success', '✅');
  } catch (error) {
    updateStatus(`Error sending leads for enrichment: ${error.message}`, 'error', '❌');
    console.error('Error in sendToEnrichment:', error);
    throw error;
  }
}

// Send leads to the backend
async function sendToBackend(leads, apiToken) {
  const response = await fetch(`${API_BASE}/imports/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify({
      leads: leads,
      source: 'sales_navigator_extension',
      auto_enrich: true
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return await response.json();
}

// Check the status of an enrichment job
async function checkJobStatus(jobId) {
  if (!jobId) return;
  
  const { apiToken } = await chrome.storage.sync.get(['apiToken']);
  if (!apiToken) return;
  
  try {
    const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Job status error: ${response.statusText}`);
    }
    
    const jobData = await response.json();
    updateProgress(jobData.total, jobData.completed, 0, jobData.total);
    
    // If job completed, open dashboard in new tab
    if (jobData.status === 'completed') {
      chrome.tabs.create({ url: `https://captely.com/dashboard?job=${jobId}` });
      chrome.runtime.sendMessage({ action: 'done', enrichmentComplete: true, total: jobData.total });
    } else {
      // Poll again after 5 seconds
      setTimeout(() => checkJobStatus(jobId), 5000);
    }
  } catch (error) {
    console.error('Job status check error:', error);
  }
}

// Download leads as CSV
async function downloadCSV() {
  try {
    if (scrapedLeads.length === 0) {
      updateStatus('No leads to download.', 'warning', '⚠️');
      return;
    }
    
    // Create CSV content
    const headers = ['First Name', 'Last Name', 'Full Name', 'Position', 'Company', 'LinkedIn URL', 'Location', 'Industry'];
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
        formatCSVField(lead.industry || '')
      ];
      csvContent += row.join(',') + '\n';
    });
    
    // Instead of using Blob and URL.createObjectURL, use a data URL
    // Add BOM for UTF-8 to ensure Excel opens it correctly
    const BOM = "\uFEFF";
    const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(BOM + csvContent);
    
    // Create and trigger download
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    await chrome.downloads.download({
      url: dataUrl,
      filename: `linkedin_leads_${timestamp}.csv`,
      saveAs: true
    });
    
    updateStatus(`Downloaded ${scrapedLeads.length} leads as CSV.`, 'success', '📥');
  } catch (error) {
    console.error("Error downloading CSV:", error);
    updateStatus(`Download error: ${error.message}`, 'error', '❌');
    throw error;
  }
}

// Helper function to format CSV fields
function formatCSVField(value) {
  if (value === null || value === undefined) {
    return '';
  }
  
  // Convert to string and clean up whitespace
  const stringValue = String(value)
    .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
    .trim();               // Remove leading/trailing whitespace
  
  // If the field contains commas, quotes, or newlines, wrap it in quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    // Replace any existing quotes with double quotes
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

// Update status message in popup
function updateStatus(message, type = 'info', icon = '') {
  chrome.runtime.sendMessage({ 
    action: 'updateStatus', 
    message,
    type,
    icon
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
  