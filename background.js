chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: "popup.html",
    type: "popup",
    width: 420,
    height: 720,
    focused: true
  });
});
