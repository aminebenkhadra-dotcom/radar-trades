// Radar Trades for Chrome: the toolbar button opens the app in a tab (or brings back the one already open).
const APP = chrome.runtime.getURL("app.html");
async function openApp(hash) {
  const tabs = await chrome.tabs.query({ url: APP + "*" });
  if (tabs.length) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
    if (hash) chrome.tabs.sendMessage(tabs[0].id, { openTab: hash }).catch(() => {});
  } else await chrome.tabs.create({ url: APP + (hash ? "#" + hash : "") });
}
chrome.action.onClicked.addListener(() => openApp(""));
/* a notification opens the setup or the trade it is about */
chrome.notifications.onClicked.addListener(async id => {
  const m = id.match(/\|([a-z0-9]{1,8}(~[A-Za-z0-9]{1,30})?)$/);
  chrome.notifications.clear(id);
  await openApp(m ? m[1] : "");
});
