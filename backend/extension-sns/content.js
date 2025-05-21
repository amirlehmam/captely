// Injects a "Scraper" button into Sales Navigator
(function injectButton() {
  // Add the button after a short delay to ensure the page has loaded
  setTimeout(() => {
    console.log("Trying to inject scrape button");
    
    // Check if we're on a search page or a list page
    const isSearchPage = window.location.href.includes('/sales/search/');
    const isListPage = window.location.href.includes('/sales/lists/');
    
    console.log(`Page type - Search: ${isSearchPage}, List: ${isListPage}`);
    
    // Target the specific element for button injection based on page type
    let toolPanel = null;
    
    if (isSearchPage) {
      // For search pages, look for search filters area or header
      toolPanel = document.querySelector(
        '.search-results__actions-bar, .search-results-container__header, .search-results__top-filters-row'
      );
    } else if (isListPage) {
      // For list pages, use list page header
      toolPanel = document.querySelector(
        '.lists-page-header__title-container, .artdeco-tab-primary-group'
      );
    } else {
      // For any other page, try some generic containers
      toolPanel = document.querySelector(
        '.search-results-container__controls, .container-header, .pv5.pt3'
      );
    }
    
    if (!toolPanel) {
      console.error("Could not find a suitable container for the button");
      // Try a more aggressive approach for finding a button container
      const anyHeader = document.querySelector('header') || 
                        document.querySelector('.search-nav') || 
                        document.querySelector('.nav-search-scope');
      
      if (anyHeader && !document.getElementById('captely-scrape-btn')) {
        console.log("Using fallback header for button placement");
        const btn = createScrapingButton();
        anyHeader.appendChild(btn);
      }
      return;
    }
    
    if (document.getElementById('captely-scrape-btn')) {
      console.log("Button already exists");
      return;
    }
    
    console.log("Found tool panel:", toolPanel);
    
    const btn = createScrapingButton();
    
    // Check if we're in a table view (list view)
    const isTableView = document.querySelector('table') !== null;
    console.log("Is table view:", isTableView);
    
    // Create container for button with appropriate styling based on page type
    const buttonContainer = document.createElement('div');
    buttonContainer.style = isSearchPage 
      ? 'display:inline-block;margin-left:10px;vertical-align:middle;margin-top:10px;'
      : 'display:inline-block;margin-left:10px;vertical-align:middle;';
    buttonContainer.appendChild(btn);
    
    // For search pages, try to insert it in a more visible location if possible
    if (isSearchPage) {
      const filterBar = document.querySelector('.search-results__filter-bar') || 
                        document.querySelector('.search-results__actions-bar');
      
      if (filterBar) {
        filterBar.appendChild(buttonContainer);
      } else {
        toolPanel.appendChild(buttonContainer);
      }
    } else {
      // For list views and other pages
      toolPanel.appendChild(buttonContainer);
    }
    
    console.log("Button injected successfully");
  }, 2000);
  
  // Create the scrape button with correct styling
  function createScrapingButton() {
  const btn = document.createElement('button');
  btn.id = 'captely-scrape-btn';
    btn.textContent = 'Scrape with Captely';
    btn.style = `
      margin-left: 8px;
      padding: 6px 12px;
      background: #0073b1;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      font-size: 14px;
    `;
    btn.onclick = () => {
      console.log("Scrape button clicked");
      chrome.runtime.sendMessage({ action: 'startScraping' });
    };
    return btn;
  }
  
  // Observe DOM changes to re-inject button if needed
  const observer = new MutationObserver((mutations) => {
    // If our button doesn't exist, try to inject it again
    if (!document.getElementById('captely-scrape-btn')) {
      setTimeout(() => injectButton(), 2000);
    }
  });
  
  // Start observing
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
  
  // Also set up a periodic check as a fallback
  setInterval(() => {
    if (!document.getElementById('captely-scrape-btn')) {
      injectButton();
    }
  }, 5000);
})();
