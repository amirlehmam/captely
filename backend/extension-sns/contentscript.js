(() => {
  // More robust and accurate Sales Navigator scraping
  function scrapeVisible() {
    console.log("Starting scrapeVisible");
    
    // Check if we're on a search results page or a list view
    const isListView = document.querySelector('table') !== null;
    const isSearchView = document.querySelector('.artdeco-entity-lockup__content') !== null || 
                         document.querySelector('.search-results__result-item') !== null;
    
    console.log("Page detection - List view:", isListView, "Search view:", isSearchView);
    
    // Get page information for debugging
    console.log("Document height:", document.body.scrollHeight);
    console.log("Window height:", window.innerHeight);
    console.log("Current scroll position:", window.scrollY);
    
    const leads = [];
    
    if (isListView) {
      // List view scraping (existing code)
      console.log("Found table element for list view");
      
      const tableElement = document.querySelector('table');
      
      // Get all rows in the table body
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      console.log(`Found ${rows.length} rows in table`);
      
      // Debug table structure
      if (rows.length < 25) {
        console.log("Detected fewer than 25 rows, checking for hidden rows");
        
        // Try to find any hidden rows using alternative selectors
        const allPossibleRows = Array.from(document.querySelectorAll('tr[data-control-name]'));
        console.log(`Found ${allPossibleRows.length} possible rows with data-control-name`);
        
        // Add any rows we missed
        for (const row of allPossibleRows) {
          if (!rows.includes(row)) {
            console.log("Adding previously missed row");
            rows.push(row);
          }
        }
        
        console.log(`Total rows after checking for hidden: ${rows.length}`);
      }
      
      rows.forEach((row, index) => {
        try {
          // Log the row for debugging
          console.log(`Processing row ${index}:`, row);
          
          // First get the checkboxes to identify valid rows
          const checkbox = row.querySelector('input[type="checkbox"]');
          
          if (checkbox) {
            // Get cells from row
            const cells = Array.from(row.querySelectorAll('td'));
            console.log(`Row has ${cells.length} cells`);
            
            // Name is in the first column with a link
            const nameCell = cells.find(cell => cell.querySelector('a span'));
            console.log("Name cell found:", !!nameCell);
            
            if (nameCell) {
              // Direct selectors based on the screenshot structure
              const nameLink = nameCell.querySelector('a');
              const nameElement = nameLink?.querySelector('span');
              const fullName = nameElement ? nameElement.textContent.trim() : '';
              console.log("Found name:", fullName);
              
              // Profile link from the a tag
              let profileUrl = '';
              if (nameLink && nameLink.getAttribute('href')) {
                profileUrl = `https://www.linkedin.com${nameLink.getAttribute('href').split('?')[0]}`;
                console.log("Found URL:", profileUrl);
              }
              
              // Job title/position - found in data-anonymize="job-title" element
              const positionElement = nameCell.querySelector('div[data-anonymize="job-title"]');
              const position = positionElement ? positionElement.textContent.trim() : '';
              console.log("Found position:", position);
              
              // Company - from "Compte" column
              const companyCell = row.querySelector('td:nth-child(2)'); 
              const companyLink = companyCell?.querySelector('a');
              const company = companyLink ? companyLink.textContent.trim() : companyCell?.textContent.trim() || '';
              console.log("Found company:", company);
              
              // Location - from "Zone géographique" column
              const locationCell = row.querySelector('td:nth-child(3)');
              const location = locationCell ? locationCell.textContent.trim() : '';
              console.log("Found location:", location);
              
              // Parse name
              let firstName = '';
              let lastName = '';
              
              if (fullName) {
                // Names in French LinkedIn often have FirstName LastName structure
                const nameParts = fullName.split(' ');
                firstName = nameParts[0] || '';
                lastName = nameParts.slice(1).join(' ') || '';
              }
              
              // Add this lead to our results
              leads.push({
                firstName,
                lastName,
                fullName,
                position,
                company,
                profileUrl,
                location,
                industry: '',
                timestamp: new Date().toISOString()
              });
              
              console.log(`Successfully scraped lead: ${fullName}`);
            }
          }
        } catch (e) {
          console.error(`Error scraping row ${index}:`, e);
        }
      });
      
      console.log(`Completed scraping list view, found ${leads.length} leads`);
    } else if (isSearchView) {
      // Search results view scraping
      console.log("Detected search results view");
      
      // Look for search result items - trying multiple possible selectors
      const searchResults = document.querySelectorAll(
        '.search-results__result-item, .artdeco-list__item, .ember-view.artdeco-list__item--offset-2'
      );
      
      console.log(`Found ${searchResults.length} search result items`);
      
      // Additional debugging
      if (searchResults.length < 25) {
        console.log("Found fewer than 25 results, checking DOM structure");
        
        // Check for alternative containers
        const alternativeContainers = [
          '.search-results__container',
          '.artdeco-list',
          'ol.search-results__result-list'
        ];
        
        for (const selector of alternativeContainers) {
          const container = document.querySelector(selector);
          if (container) {
            console.log(`Found alternative container: ${selector} with ${container.children.length} children`);
          }
        }
      }
      
      searchResults.forEach((result, index) => {
        try {
          console.log(`Processing search result ${index}`);
          
          // Find the entity lockup container that has all the profile info
          const entityLockup = result.querySelector('.artdeco-entity-lockup__content') || result;
          
          // Extract name and profile URL
          const nameElement = entityLockup.querySelector('.artdeco-entity-lockup__title a, [data-anonymize="person-name"]');
          const fullName = nameElement ? nameElement.textContent.trim() : '';
          
          // Get profile URL - some URLs might be relative, so handle both formats
          let profileUrl = '';
          if (nameElement && nameElement.tagName === 'A') {
            const href = nameElement.getAttribute('href');
            profileUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
            profileUrl = profileUrl.split('?')[0]; // Remove parameters
          }
          
          // Extract job title
          const titleElement = entityLockup.querySelector(
            '.artdeco-entity-lockup__subtitle, [data-anonymize="job-title"], div.t-14.t-black.t-normal'
          );
          const position = titleElement ? titleElement.textContent.trim() : '';
          
          // Extract company - may be in different places in the DOM
          const companyElement = entityLockup.querySelector(
            '.artdeco-entity-lockup__subtitle a[data-anonymize="company-name"], .artdeco-entity-lockup__subtitle a'
          );
          const company = companyElement ? companyElement.textContent.trim() : '';
          
          // Extract location - could be in various places
          const locationElement = entityLockup.querySelector(
            '.artdeco-entity-lockup__caption, [data-anonymize="location"], .t-12.t-black--light.t-normal'
          );
          const location = locationElement ? locationElement.textContent.trim() : '';
          
          // Try to extract industry if available
          const industryElement = entityLockup.querySelector(
            '.industry-tag, [data-anonymize="industry"]'
          );
          const industry = industryElement ? industryElement.textContent.trim() : '';
          
          // Parse name into first/last
          let firstName = '';
          let lastName = '';
          
          if (fullName) {
            const nameParts = fullName.split(' ');
            firstName = nameParts[0] || '';
            lastName = nameParts.slice(1).join(' ') || '';
          }
          
          // Only add if we have at least a name
          if (fullName) {
            leads.push({
              firstName,
              lastName,
              fullName,
              position,
              company,
              profileUrl,
              location,
              industry,
              timestamp: new Date().toISOString()
            });
            
            console.log(`Successfully scraped search result: ${fullName}, ${position} at ${company}`);
          }
        } catch (e) {
          console.error(`Error scraping search result ${index}:`, e);
        }
      });
      
      console.log(`Completed scraping search view, found ${leads.length} leads`);
    } else {
      // Fallback for other pages - try generic selectors
      console.log("No specific view detected, trying generic selectors");
      
      const items = document.querySelectorAll('li.search-results__result-item, div.entity-result__item, .artdeco-list__item');
      console.log(`Found ${items.length} generic items`);
      
      items.forEach((item, index) => {
        try {
          console.log(`Processing generic item ${index}`);
          
          const linkEl = item.querySelector('a[data-control-name="view_profile"], a.app-aware-link[href*="/in/"], a[data-anonymize="person-name"]');
          const nameEl = item.querySelector('.result-lockup__name, .artdeco-entity-lockup__title span[aria-hidden="true"], [data-anonymize="person-name"]');
          const titleEl = item.querySelector('.result-lockup__highlight-keyword, .artdeco-entity-lockup__subtitle, [data-anonymize="job-title"]');
          const companyEl = item.querySelector('.result-lockup__position-company, .artdeco-entity-lockup__subtitle:nth-child(2), a[data-anonymize="company-name"]');
          const locationEl = item.querySelector('.result-lockup__misc-item, .artdeco-entity-lockup__caption, [data-anonymize="location"]');
          
          // Extract URL from profile link
          const profileUrl = linkEl?.href ? linkEl.href.split('?')[0] : '';
          
          // Extract full name and split into first/last
          const fullName = nameEl?.innerText.trim() || '';
          let firstName = '';
          let lastName = '';
          
          if (fullName) {
            const nameParts = fullName.split(' ');
            firstName = nameParts[0] || '';
            lastName = nameParts.slice(1).join(' ') || '';
          }
          
          // Only add if we have a name
          if (fullName) {
            leads.push({
              firstName,
              lastName,
              fullName,
              position: titleEl?.innerText.trim() || '',
              company: companyEl?.innerText.trim() || '',
              profileUrl,
              location: locationEl?.innerText.trim() || '',
              industry: '',
              timestamp: new Date().toISOString()
            });
            
            console.log(`Successfully scraped generic item: ${fullName}`);
          }
        } catch (e) {
          console.error(`Error scraping generic item ${index}:`, e);
        }
      });
    }
    
    // For debug: get all profile-like elements we might be missing
    const allProfileLinks = document.querySelectorAll('a[href*="/in/"], a[href*="/sales/lead/"]');
    console.log(`Found ${allProfileLinks.length} total profile links on page`);
    
    console.log(`Total leads found: ${leads.length}`);
    return leads;
  }

  // Function to scroll down the page smoothly
  function smoothScroll(distance) {
    console.log(`Scrolling by ${distance}px`);
    window.scrollBy({
      top: distance,
      behavior: 'smooth'
    });
    return true;
  }

  // Function to check if we've reached the bottom of the page
  function isAtBottom() {
    // Check with a margin to prevent false positives
    const scrollPosition = window.innerHeight + window.scrollY;
    const documentHeight = document.body.scrollHeight;
    const scrollThreshold = 200; // Pixels from bottom to consider "at bottom"
    const atBottom = scrollPosition >= documentHeight - scrollThreshold;
    
    console.log(`Scroll position: ${scrollPosition}, Document height: ${documentHeight}`);
    console.log(`Checking if at bottom: ${atBottom}`);
    
    // Also check if we see a "no more results" message or end of list indicator
    const endOfListIndicators = [
      '.artdeco-empty-state__message',
      '.search-results__no-results',
      '.artdeco-pagination__button--next[disabled]',
      '.scaffold-finite-scroll__load-button[disabled]'
    ];
    
    const foundEndIndicator = endOfListIndicators.some(selector => 
      document.querySelector(selector) !== null
    );
    
    if (foundEndIndicator) {
      console.log('Found end-of-list indicator');
      return true;
    }
    
    return atBottom;
  }

  // Helper function to get all text content from a node
  function extractTextContent(node) {
    // Specific function for debugging text content extraction
    if (!node) return '';
    return node.textContent.trim();
  }

  // Check for pagination and return info about it
  function getPaginationInfo() {
    // Look for pagination controls - trying multiple selectors to be thorough
    const paginationControls = document.querySelector(
      '.artdeco-pagination, .search-results__pagination, .scaffold-finite-scroll__load-button'
    );
    
    if (!paginationControls) {
      console.log('No pagination controls found');
      
      // Check for "load more" button which is used in some views
      const loadMoreButton = document.querySelector('button.scaffold-finite-scroll__load-button');
      if (loadMoreButton) {
        console.log('Found "Load more" button instead of pagination');
        return {
          hasPagination: true,
          currentPage: 1,
          totalPages: 2, // Assume at least one more page with load more button
          nextButton: loadMoreButton,
          isLoadMore: true
        };
      }
      
      return {
        hasPagination: false,
        currentPage: 1,
        totalPages: 1
      };
    }
    
    // Find current page
    const activePage = paginationControls.querySelector('li.active, li.selected, .artdeco-pagination__indicator--active');
    const currentPage = activePage ? parseInt(activePage.textContent.trim()) : 1;
    
    // Get total pages
    const pageButtons = Array.from(paginationControls.querySelectorAll('li.artdeco-pagination__indicator'));
    let totalPages = pageButtons.length > 0 ? pageButtons.length : 1;
    
    // If the last page button shows "..." it means there are more pages than shown
    const lastPageButton = pageButtons[pageButtons.length - 1];
    if (lastPageButton && lastPageButton.textContent.includes('…')) {
      // Try to find the last page number from the "next" button URL
      const nextButton = paginationControls.querySelector('button[aria-label="Next"], .artdeco-pagination__button--next');
      if (nextButton) {
        const nextUrl = nextButton.getAttribute('href');
        if (nextUrl) {
          const pageMatch = nextUrl.match(/page=(\d+)/);
          if (pageMatch && pageMatch[1]) {
            totalPages = parseInt(pageMatch[1]);
          }
        }
      }
    }
    
    // Find the next button
    const nextButton = paginationControls.querySelector(
      'button[aria-label="Next"], .artdeco-pagination__button--next, .search-results__pagination-next-button'
    );
    
    console.log(`Pagination detected: current page ${currentPage} of ${totalPages}`);
    
    return {
      hasPagination: true,
      currentPage,
      totalPages,
      nextButton
    };
  }

  // Navigate to the next page
  function goToNextPage() {
    const paginationInfo = getPaginationInfo();
    
    if (!paginationInfo.hasPagination || !paginationInfo.nextButton) {
      console.log('Cannot navigate to next page - no pagination or next button');
      return false;
    }
    
    console.log('Clicking next page button');
    
    // If this is a "load more" button, we just click it
    if (paginationInfo.isLoadMore) {
      paginationInfo.nextButton.click();
      return true;
    }
    
    // For regular pagination
    if (paginationInfo.nextButton.tagName === 'BUTTON' || paginationInfo.nextButton.tagName === 'A') {
      paginationInfo.nextButton.click();
      return true;
    } else {
      console.log('Next button found but cannot be clicked');
      return false;
    }
  }

  // Expose functions to be called from background script
  window.CaptelyScraper = {
    scrapeVisible,
    smoothScroll,
    isAtBottom,
    extractTextContent,
    getPaginationInfo,
    goToNextPage
  };
  
  console.log("Captely Sales Navigator Scraper initialized");
  
  // Debug DOM structure on initialization
  const tableExists = document.querySelector('table') !== null;
  const searchResultsExist = document.querySelector('.search-results__result-item, .artdeco-entity-lockup__content') !== null;
  
  console.log(`Page structure - Table: ${tableExists}, Search results: ${searchResultsExist}`);
  
  if (tableExists) {
    const rows = document.querySelectorAll('tbody tr');
    console.log(`Found ${rows.length} rows in table on init`);
    // Log header row cells if any
    const headerCells = document.querySelectorAll('thead th');
    console.log(`Table headers: ${Array.from(headerCells).map(cell => cell.textContent.trim()).join(', ')}`);
  } else if (searchResultsExist) {
    const results = document.querySelectorAll('.search-results__result-item, .artdeco-list__item');
    console.log(`Found ${results.length} search results on init`);
  }
})();
  