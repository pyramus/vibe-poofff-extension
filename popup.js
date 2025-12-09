document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const mainView = document.getElementById('main-view');
    const listView = document.getElementById('list-view');
    const startBtn = document.getElementById('start-btn');
    const manageBtn = document.getElementById('manage-btn');
    const resetBtn = document.getElementById('reset-btn');
    const backBtn = document.getElementById('back-btn');
    const hiddenList = document.getElementById('hidden-list');

    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const hostname = new URL(tab.url).hostname;

    // --- VIEW NAVIGATION ---
    manageBtn.addEventListener('click', () => {
        mainView.classList.remove('show');
        listView.classList.add('show');
        renderHiddenList();
    });

    backBtn.addEventListener('click', () => {
        listView.classList.remove('show');
        mainView.classList.add('show');
    });

    // --- START BUTTON LOGIC ---

    // Check Status
    try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'GET_STATUS' });
        if (response && response.isActive) {
            updateStartBtn(true);
        } else {
            updateStartBtn(false);
        }
    } catch (e) {
        console.log('Poofff: Status check failed, assuming inactive.');
        updateStartBtn(false);
    }

    function updateStartBtn(isActive) {
        if (isActive) {
            startBtn.textContent = 'Stop Poofff';
            startBtn.style.background = '#2ed573';
            startBtn.dataset.active = 'true';
        } else {
            startBtn.textContent = 'Poofff…';
            startBtn.style.background = '#ff4757';
            startBtn.dataset.active = 'false';
        }
    }

    startBtn.addEventListener('click', async () => {
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
            alert('Poofff cannot run on system pages.');
            return;
        }

        const isCurrentlyActive = startBtn.dataset.active === 'true';
        const targetState = !isCurrentlyActive;

        // Optimistic UI update
        updateStartBtn(targetState);

        try {
            // Attempt standard toggle
            await chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_POOFFF', value: targetState });
            window.close();
        } catch (err) {
            // If failed and we wanted to STOP, there's nothing we can do (script missing)
            if (!targetState) {
                window.close();
                return;
            }

            // If failed and we wanted to START, we need to inject
            console.log('Poofff: Need injection', err);
            startBtn.textContent = 'Injecting...';

            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
                // CSS is injected by content.js now, but we can do it safely anyway or rely on JS
                // await chrome.scripting.insertCSS(...) // handled by Singleton now

                // Small delay for script to initialize
                await new Promise(r => setTimeout(r, 100));

                // Retry toggle
                await chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_POOFFF', value: true });
                window.close();
            } catch (injectErr) {
                console.error('Poofff: Injection failed', injectErr);
                alert('Connection failed. Please refresh the page.');
                updateStartBtn(false); // Revert UI
            }
        }
    });


    // --- LIST & RESET LOGIC ---

    async function renderHiddenList() {
        hiddenList.innerHTML = '<div class="empty-state">Loading...</div>';

        const data = await chrome.storage.local.get([hostname]);
        const selectors = data[hostname] || [];

        hiddenList.innerHTML = '';

        if (selectors.length === 0) {
            hiddenList.innerHTML = '<div class="empty-state">No hidden elements</div>';
            return;
        }

        selectors.forEach(sel => {
            const li = document.createElement('li');
            li.className = 'hidden-item';

            // Truncate if too long (simple approach)
            const displaySel = sel.length > 30 ? sel.substring(0, 30) + '...' : sel;
            li.textContent = displaySel;
            li.title = sel; // Full text on hover

            hiddenList.appendChild(li);
        });
    }

    resetBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to unhide all elements?')) {
            try {
                await chrome.tabs.sendMessage(tab.id, { action: 'RESET_POOFFF' });
                // Update local view
                await chrome.storage.local.remove(hostname); // Or Update via content script sync?
                // Content script updates storage, but we are viewing it now.
                // Ideally content script ack -> we refresh.
                renderHiddenList(); // Storage might not be updated yet by content script?
                // Let's manually clear storage to be immediate
                await chrome.storage.local.set({ [hostname]: [] });
                renderHiddenList();
            } catch (e) {
                // If content script is dead, we manually clear storage
                await chrome.storage.local.set({ [hostname]: [] });
                renderHiddenList();
            }
        }
    });

});
