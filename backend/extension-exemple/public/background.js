chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const allowedUrl = "https://www.linkedin.com/sales";

  // Check if the current tab's URL matches the allowed URL
  if (tab.url && tab.url.startsWith(allowedUrl)) {
    // Change the icon to the enabled state
    chrome.action.setIcon({ path: "./images/linkedin_scrapper_128.png", tabId });
    chrome.action.enable(tabId); // Enable the action
  } else {
    // Change the icon to the disabled state
    chrome.action.setIcon({ path: "./images/linkedin_scrapper_16.png", tabId });
    chrome.action.disable(tabId); // Disable the action
  }
});
