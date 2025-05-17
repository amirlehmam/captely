(() => {
  // More robust and accurate Sales Navigator scraping
  function scrapeVisible() {
    // This targets both list views and search results
    const items = document.querySelectorAll('li.search-results__result-item, div.entity-result__item');
    const leads = [];
    
    items.forEach(item => {
      try {
        // Extract name and link (these selectors work for both list and search views)
        const linkEl = item.querySelector('a[data-control-name="view_profile"], a.app-aware-link[href*="/in/"]');
        const nameEl = item.querySelector('.result-lockup__name, .artdeco-entity-lockup__title span[aria-hidden="true"]');
        const titleEl = item.querySelector('.result-lockup__highlight-keyword, .artdeco-entity-lockup__subtitle');
        const companyEl = item.querySelector('.result-lockup__position-company, .artdeco-entity-lockup__subtitle:nth-child(2)');
        const locationEl = item.querySelector('.result-lockup__misc-item, .artdeco-entity-lockup__caption');
        
        // Industry isn't directly available in Sales Navigator list views, but sometimes in the full profile
        const industryEl = item.querySelector('.industry-tag, [data-control-name="industry"]');
        
        // Extract URL from profile link
        const profileUrl = linkEl?.href || '';
        
        // Clean the LinkedIn URL to remove tracking parameters
        const cleanUrl = profileUrl.split('?')[0];
        
        // Extract full name and split into first/last
        const fullName = nameEl?.innerText.trim() || '';
        let firstName = '';
        let lastName = '';
        
        if (fullName) {
          const nameParts = fullName.split(' ');
          firstName = nameParts[0] || '';
          lastName = nameParts.slice(1).join(' ') || '';
        }

        leads.push({
          firstName,
          lastName,
          fullName,
          position: titleEl?.innerText.trim() || '',
          company: companyEl?.innerText.trim() || '',
          profileUrl: cleanUrl,
          location: locationEl?.innerText.trim() || '',
          industry: industryEl?.innerText.trim() || '',
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        console.error('Error scraping item:', e);
      }
    });
    
    return leads;
  }

  // Function to scroll and wait
  function smoothScroll(distance) {
    return new Promise(resolve => {
      window.scrollBy({
        top: distance,
        behavior: 'smooth'
      });
      
      // Add a random delay between 1-3 seconds to mimic human behavior
      setTimeout(resolve, 1000 + Math.random() * 2000);
    });
  }

  // Function to check if we've reached the bottom of the page
  function isAtBottom() {
    return window.innerHeight + window.scrollY >= document.body.scrollHeight - 200;
  }

  // Expose functions to be called from background script
  window.CaptelyScraper = {
    scrapeVisible,
    smoothScroll,
    isAtBottom
  };
})();
  