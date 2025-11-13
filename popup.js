function updateUI(data) {
	const { watchTime, currentChannel, isRunning } = data;
	document.getElementById("current").textContent = currentChannel || "None";

	const tbody = document.querySelector("#channelTable tbody");
	tbody.innerHTML = "";
	for (const [channel, time] of Object.entries(watchTime || {})) {
		const mins = Math.round(time / 60000);
		const row = document.createElement("tr");
		row.innerHTML = `
      <td>${channel}</td>
      <td>${mins} min</td>
    `;
		tbody.appendChild(row);
	}
}

async function getStatus() {
	chrome.runtime.sendMessage({ command: "getStatus" }, data => {
		if (data) updateUI(data);
	});
}

document.getElementById("start").addEventListener("click", () => {
	chrome.runtime.sendMessage({ command: "startRotation" }, getStatus);
});

document.getElementById("pause").addEventListener("click", () => {
	chrome.runtime.sendMessage({ command: "pauseRotation" }, getStatus);
});

document.getElementById("reset").addEventListener("click", () => {
	chrome.runtime.sendMessage({ command: "resetWatchTime" }, getStatus);
});

chrome.runtime.onMessage.addListener(msg => {
	if (msg.command === "updateStatus") getStatus();
});

getStatus();

function renderList(channels) {
	const ul = document.getElementById("channelList");
	ul.innerHTML = "";

	channels.forEach(ch => {
		const li = document.createElement("li");
		li.innerHTML = `
      <span>${ch}</span>
      <button class="remove-btn">Remove</button>
    `;
		li.querySelector(".remove-btn").addEventListener("click", () => removeChannel(ch));
		ul.appendChild(li);
	});
}

async function loadChannels() {
	chrome.storage.local.get(["channels"], data => {
		const channels = data.channels || [];
		renderList(channels);
	});
}

async function loadTimeLimit() {
	chrome.storage.local.get(["timeLimit"], data => {
		const timeLimit = data.timeLimit || 1;
		document.getElementById('timeLimit').value = timeLimit;
		;
	});
}

function saveChannels(channels) {
	chrome.storage.local.set({ channels });
	chrome.runtime.sendMessage({ command: "updateChannels", channels });
}

function saveTimeLimit(timeLimit) {
	chrome.storage.local.set({ timeLimit });
	chrome.runtime.sendMessage({ command: "saveTimeLimit", timeLimit });
}

function addChannel() {
	const input = document.getElementById("newChannel");
	const newName = input.value.trim().toLowerCase();
	if (!newName) return;

	chrome.storage.local.get(["channels"], data => {
		const channels = data.channels || [];
		if (!channels.includes(newName)) {
			channels.push(newName);
			saveChannels(channels);
			renderList(channels);
			input.value = "";
		}
	});
}

function removeChannel(name) {
	chrome.storage.local.get(["channels"], data => {
		const channels = (data.channels || []).filter(ch => ch !== name);
		saveChannels(channels);
		renderList(channels);
	});
}

function showChannels () {
	document.getElementById('channelspage').style.display = 'block';
	document.getElementById('statuspage').style.display = 'none';
}
function showStatus () {
	document.getElementById('channelspage').style.display = 'none';
	document.getElementById('statuspage').style.display = 'block';
}

document.getElementById("addChannel").addEventListener("click", addChannel);
document.getElementById("setup").addEventListener("click",showChannels );
document.getElementById("showstatus").addEventListener("click", showStatus);
document.getElementById("newChannel").addEventListener("keypress", e => {
	if (e.key === "Enter") addChannel();
});
function updateTimeLimit() {
	saveTimeLimit(document.getElementById('timeLimit').value);
}
document.getElementById("saveTimeLimit").addEventListener("click", updateTimeLimit);

loadChannels();
loadTimeLimit();