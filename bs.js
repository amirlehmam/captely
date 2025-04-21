chrome.runtime.onMessage.addListener(async (msg, sender, send) => {
    const { leads } = msg;
    const { token } = await chrome.storage.local.get("token");
    const res = await fetch("https://api.captely.local/api/imports/salesnav", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify(leads)
    });
    if (res.ok) alert("Import lancé !");
    else alert("Erreur " + res.status);
  });
  