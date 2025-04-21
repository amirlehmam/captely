// Injecte un bouton dans la barre Sales Nav
(function () {
    const btn = document.createElement("button");
    btn.innerText = "Scraper Captely";
    btn.style = "position:fixed;top:10px;right:10px;z-index:9999;padding:6px 12px;background:#2563eb;color:#fff;border-radius:4px;";
    btn.onclick = scrape;
    document.body.appendChild(btn);
  
    async function scrape() {
      const rows = Array.from(document.querySelectorAll("[data-test-lead-row]"));
      const leads = rows.map(r => {
        const name = r.querySelector("[data-test-lead-name]").textContent.trim().split(" ");
        return {
          first_name: name[0],
          last_name: name.slice(1).join(" "),
          company: r.querySelector("[data-test-company-name]").textContent.trim(),
          linkedin_url: r.querySelector("a").href
        };
      });
      chrome.runtime.sendMessage({ leads });
    }
  })();
  