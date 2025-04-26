chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action !== 'startScraping') return;
  
    chrome.storage.sync.get(['apiToken','maxLeads'], async ({ apiToken, maxLeads }) => {
      const tabId = (await chrome.tabs.query({active:true,currentWindow:true}))[0].id;
      const allLeads = [];
      let keepGoing = true;
  
      while (keepGoing && allLeads.length < maxLeads) {
        // 1) scrape what's visible
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => window.CaptelyScraper.scrapeVisible()
        });
        // dedupe & append
        result.forEach(l => {
          if (allLeads.length < maxLeads) {
            const key = l.profileUrl;
            if (!allLeads.find(x=>x.profileUrl===key)) allLeads.push(l);
          }
        });
  
        // update status
        chrome.runtime.sendMessage({ action:'updateStatus', message:`🕵️‍♀️ Scraped ${allLeads.length}` });
  
        if (allLeads.length >= maxLeads) break;
  
        // 2) scroll a bit, wait random
        await chrome.scripting.executeScript({
          target: { tabId },
          func: () => window.scrollBy({ top: window.innerHeight/2, behavior:'smooth' })
        });
        await new Promise(r=>setTimeout(r, 1000 + Math.random()*2000));
        // stop if at bottom
        const atBottom = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => window.innerHeight + window.scrollY >= document.body.scrollHeight
        });
        if (atBottom[0].result) keepGoing = false;
      }
  
      // 3) batch‐send to backend
      const batchSize = 20;
      for (let i=0; i<allLeads.length; i+=batchSize) {
        const batch = allLeads.slice(i, i+batchSize);
        try {
          await fetch('https://your-backend/api/scraper/leads', {
            method:'POST',
            headers: {
              'Content-Type':'application/json',
              'Authorization': apiToken
            },
            body: JSON.stringify({ leads: batch })
          });
          chrome.runtime.sendMessage({
            action:'updateStatus',
            message:`📤 Sent ${Math.min(i+batchSize, allLeads.length)}/${allLeads.length}`
          });
        } catch(err) {
          chrome.runtime.sendMessage({
            action:'updateStatus',
            message:`❌ Error sending batch: ${err.message}`
          });
        }
      }
  
      // 4) done
      chrome.runtime.sendMessage({ action:'done', total: allLeads.length });
    });
  
    sendResponse({ status:'ok' });
    return true;
  });
  