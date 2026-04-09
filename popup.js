// const YT_API_KEY = "AIzaSyCzayFKlDze0u-3sLNdNSsoTVb-PR0ZpWg";

const chatBox = document.getElementById("chatBox");

/* ============================
   PUT YOUR YOUTUBE API KEY HERE
============================ */

const YT_API_KEY = "AIzaSyCzayFKlDze0u-3sLNdNSsoTVb-PR0ZpWg";


/* ============================
   VARIABLES
============================ */

let seenYTMessages = new Set();

let twitchSocket = null;
let twitchChannel = "";

let ytChatId = "";
let ytInterval = null;

/* ============================
   LOAD SAVED LINKS ON START
============================ */

window.onload = () => {
  chrome.storage.local.get(["lastTwitch", "lastYT"], (data) => {
    if (data.lastTwitch) {
      document.getElementById("twitchLink").value = data.lastTwitch;
    }

    if (data.lastYT) {
      document.getElementById("ytLink").value = data.lastYT;
    }
  });
};

/* ============================
   SAVE LINKS
============================ */

function saveLinks() {
  chrome.storage.local.set({
    lastTwitch: document.getElementById("twitchLink").value,
    lastYT: document.getElementById("ytLink").value
  });
}

/* ============================
   ADD MESSAGE TO UI
============================ */

function addMessage(platform, user, text) {
  let div = document.createElement("div");

  div.className =
    platform === "twitch"
      ? "chatMessage twitchMsg"
      : "chatMessage youtubeMsg";

  div.innerHTML = `
    <span class="username">${user}:</span>
    <span>${text}</span>
  `;

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

/* ============================
   TWITCH CHAT (FIXED)
============================ */

document.getElementById("addTwitch").onclick = () => {
  let link = document.getElementById("twitchLink").value;

  if (!link.includes("twitch.tv")) {
    alert("Paste a valid Twitch link!");
    return;
  }

  saveLinks();

  twitchChannel = link.split("twitch.tv/")[1];
  startTwitchChat();
};

/* Refresh Twitch Button */
document.getElementById("refreshTwitch").onclick = () => {
  if (!twitchChannel) return alert("Add Twitch channel first!");

  addMessage("twitch", "System", "Refreshing Twitch chat...");
  startTwitchChat(true);
};

function startTwitchChat(refresh = false) {
  if (twitchSocket) twitchSocket.close();

  twitchSocket = new WebSocket("wss://irc-ws.chat.twitch.tv:443");

  twitchSocket.onopen = () => {
    twitchSocket.send("PASS SCHMOOPIIE");
    twitchSocket.send("NICK justinfan12345");
    twitchSocket.send(`JOIN #${twitchChannel}`);

    if (refresh) {
      addMessage("twitch", "System", "Twitch chat reconnected!");
    }
  };

  twitchSocket.onmessage = (event) => {
    let msg = event.data;

    /* ✅ Twitch Keepalive Fix */
    if (msg.startsWith("PING")) {
      twitchSocket.send("PONG :tmi.twitch.tv");
      return;
    }

    /* Chat Messages */
    if (msg.includes("PRIVMSG")) {
      let username = msg.split("!")[0].replace(":", "");
      let messageText = msg.split(" :")[1];

      addMessage("twitch", username, messageText);
    }
  };

  /* Auto reconnect */
  twitchSocket.onclose = () => {
    addMessage("twitch", "System", "Twitch disconnected. Reconnecting...");
    setTimeout(() => startTwitchChat(), 3000);
  };

  twitchSocket.onerror = () => {
    addMessage("twitch", "System", "Twitch connection error!");
  };
}

/* ============================
   YOUTUBE CHAT
============================ */

document.getElementById("addYT").onclick = async () => {
  let link = document.getElementById("ytLink").value;

  let videoId = extractVideoId(link);

  if (!videoId) {
    alert("Paste a valid YouTube LIVE link!");
    return;
  }

  saveLinks();

  ytChatId = await getLiveChatId(videoId);
  if (!ytChatId) return;

  alert("YouTube Chat Connected!");
  startYouTubeChat();
};

/* Refresh YouTube Button */
document.getElementById("refreshYT").onclick = () => {
  if (!ytChatId) return alert("Add YouTube link first!");

  addMessage("youtube", "System", "Refreshing YouTube chat...");

  clearInterval(ytInterval);
  seenYTMessages.clear();

  startYouTubeChat();
};

/* Extract Video ID */
function extractVideoId(url) {
  try {
    if (url.includes("youtu.be/")) {
      return url.split("youtu.be/")[1].split("?")[0];
    }

    if (url.includes("/live/")) {
      return url.split("/live/")[1].split("?")[0];
    }

    return new URL(url).searchParams.get("v");
  } catch {
    return null;
  }
}

/* Get Live Chat ID */
async function getLiveChatId(videoId) {
  let url =
    `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${YT_API_KEY}`;

  let res = await fetch(url);
  let data = await res.json();

  if (!data.items || data.items.length === 0) {
    alert("This video is not LIVE or chat unavailable.");
    return null;
  }

  return data.items[0].liveStreamingDetails?.activeLiveChatId;
}

/* Start YouTube Polling */
function startYouTubeChat() {
  ytInterval = setInterval(async () => {
    let url =
      `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${ytChatId}&part=snippet,authorDetails&key=${YT_API_KEY}`;

    let res = await fetch(url);
    let data = await res.json();

    if (!data.items) return;

    data.items.forEach((msg) => {
      if (seenYTMessages.has(msg.id)) return;

      seenYTMessages.add(msg.id);

      addMessage(
        "youtube",
        msg.authorDetails.displayName,
        msg.snippet.displayMessage
      );
    });
  }, 4000);
}
