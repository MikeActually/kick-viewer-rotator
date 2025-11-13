import { VIEW_TIME_MS, POLL_INTERVAL_MS } from "./config.js";

let channels = [];
let currentIndex = 0;
let currentChannel = null;
let activeTabId = null;
let isRunning = false;

let watchTime = {};
let channelStartTime = 0;
let pollIntervalHandle = null;

let timeLimit = null;

async function loadSettings() {
	return new Promise(resolve => {
		chrome.storage.local.get(["channels", "watchTime", "timeLimit"], data => {
			channels = data.channels || [];
			watchTime = data.watchTime || {};
			timeLimit = data.timeLimit || 1;
			channels.forEach(ch => {
				if (!(ch in watchTime)) watchTime[ch] = 0;
			});
			resolve();
		});
	});
}

async function saveChannels() {
	await chrome.storage.local.set({ channels });
}

async function saveWatchTime() {
	await chrome.storage.local.set({ watchTime });
}

async function saveTimeLimit() {
	await chrome.storage.local.set({ timeLimit });
}

async function isChannelOnline(username) {
	try {
		const res = await fetch(`https://kick.com/api/v2/channels/${username}`);
		if (!res.ok) throw new Error("API error");
		const data = await res.json();
		return data.livestream // 
			&& data.livestream.is_live //
			&& data.livestream.categories.filter(category => category.slug.toLowerCase() === 'rust').length > 0;
	} catch (err) {
		console.error(`Error checking ${username}:`, err);
		return false;
	}
}

async function openChannel(username) {
	console.log(`Switching to channel: ${username}`);

	const url = `https://kick.com/${username}`;
	if (activeTabId) {
		await chrome.tabs.update(activeTabId, { url });
	} else {
		const tab = await chrome.tabs.create({ url });
		activeTabId = tab.id;
	}

	currentChannel = username;
	channelStartTime = Date.now();

	doPolling();
}

function doPolling() {
	if (pollIntervalHandle) clearInterval(pollIntervalHandle);
	pollIntervalHandle = setInterval(checkChannelStatus, POLL_INTERVAL_MS);
}

async function checkChannelStatus() {
	if (!currentChannel || !isRunning) return;

	const elapsed = Date.now() - channelStartTime;
	watchTime[currentChannel] += elapsed;
	channelStartTime = Date.now();
	await saveWatchTime();

	console.log(`${currentChannel}: ${Math.round(watchTime[currentChannel] / 60000)} min watched`);

	if (watchTime[currentChannel] >= VIEW_TIME_MS(timeLimit)) {
		console.log(`${currentChannel} reached max watch time. Switching...`);
		nextChannel();
		return;
	}

	const online = await isChannelOnline(currentChannel);
	if (!online) {
		console.log(`${currentChannel} went offline. Switching...`);
		nextChannel();
	}

	chrome.runtime.sendMessage({ command: "updateStatus" }, messageHandler);
	doPolling();
}

async function nextChannel() {
	if (pollIntervalHandle) {
		clearInterval(pollIntervalHandle);
		pollIntervalHandle = null;
	}

	const total = channels.length;
	let tries = 0;

	while (tries < total) {
		currentIndex = (currentIndex + 1) % total;
		const next = channels[currentIndex];

		if (watchTime[next] >= VIEW_TIME_MS(timeLimit)) {
			tries++;
			continue;
		}

		const online = await isChannelOnline(next);
		if (online) {
			await openChannel(next);
			return;
		} else {
			tries++;
		}
	}

	console.log("No channels online. Retrying later.");
	setTimeout(rotateChannels, POLL_INTERVAL_MS);
}

async function rotateChannels() {
	await loadSettings();
	if (!isRunning) return;
	await nextChannel();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	if (msg.command === "resetWatchTime") {
		Object.keys(watchTime).forEach(ch => (watchTime[ch] = 0));
		saveWatchTime();
		sendResponse({ success: true });
	} else if (msg.command === "getStatus") {
		sendResponse({
			watchTime,
			currentChannel,
			isRunning,
			channels,

		});
	} else if (msg.command === "startRotation") {
		isRunning = true;
		rotateChannels();
		sendResponse({ success: true });
	} else if (msg.command === "pauseRotation") {
		isRunning = false;
		clearInterval(pollIntervalHandle);
		pollIntervalHandle = null;
		sendResponse({ success: true });
	} else if (msg.command === "updateChannels") {
		channels = msg.channels;
		saveChannels();
		sendResponse({ success: true });
	} else if (msg.command === "saveTimeLimit") {
		timeLimit = msg.timeLimit;
		saveTimeLimit();
		sendResponse({ success: true });
	}
});

chrome.runtime.onStartup.addListener(loadSettings);
chrome.runtime.onInstalled.addListener(loadSettings);

// Listen for when the active Kick tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
	if (tabId === activeTabId) {
		console.log("Active Kick tab was closed — stopping rotation.");

		// Stop all timers and reset state
		clearInterval(pollIntervalHandle);
		isRunning = false;
		currentChannel = null;
		channelStartTime = null;
		activeTabId = null;
	}
});

async function keepAlive() {
	setInterval(() => {
		// Perform a no-op operation or send a message to keep the service worker active
		chrome.runtime.sendMessage({ type: "keepAlive" }, messageHandler);
	}, 20000); // Send a message every 20 seconds
}

function messageHandler(response) {
	if (chrome.runtime.lastError) {
		console.warn("Could not establish connection. Receiving end does not exist. This is likely due to the extension not being active or the listener not being registered yet.", chrome.runtime.lastError.message);
		// Handle the error, e.g., retry after a delay, or notify the user.
		return;
	}
	console.log(response.farewell);
}

chrome.runtime.onStartup.addListener(keepAlive);
