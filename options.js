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
		const channels = data.channels || ["trainwreckstv", "adinross", "amouranth"];
		renderList(channels);
	});
}

function saveChannels(channels) {
	chrome.storage.local.set({ channels });
	chrome.runtime.sendMessage({ command: "updateChannels", channels });
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

document.getElementById("addChannel").addEventListener("click", addChannel);
document.getElementById("newChannel").addEventListener("keypress", e => {
	if (e.key === "Enter") addChannel();
});

loadChannels();
