(() => {
    function scrapeVisible() {
      const items = document.querySelectorAll('div.entity-result__item');
      const leads = [];
      items.forEach(item => {
        const nameEl      = item.querySelector('span.entity-result__title-text a span[aria-hidden]');
        const positionEl  = item.querySelector('div.entity-result__primary-subtitle');
        const companyEl   = item.querySelector('div.entity-result__secondary-subtitle');
        const linkEl      = item.querySelector('a[data-control-name="view_profile"]');
        const locationEl  = item.querySelector('div.entity-result__secondary-subtitle + div');
        const fullName    = nameEl?.innerText.trim() || '';
        const [firstName, ...rest] = fullName.split(' ');
        const lastName    = rest.join(' ');
        leads.push({
          firstName,
          lastName,
          position: positionEl?.innerText.trim() || '',
          company:  companyEl?.innerText.trim() || '',
          profileUrl: linkEl?.href || '',
          location: locationEl?.innerText.trim() || '',
          industry: ''  // Sales Navigator UI doesn’t always show industry here
        });
      });
      return leads;
    }
  
    // Expose to background script
    window.CaptelyScraper = { scrapeVisible };
  })();
  