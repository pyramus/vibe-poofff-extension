console.log('Poofff: Script loaded');

(function () {
    // Singleton Pattern: If instance exists, we clean it up and re-initialize.
    // This handles the case where the extension was reloaded (invalidating the old context's listeners)
    // but the 'window' variable persists in the isolated world.
    if (window.PoofffInstance) {
        console.log('Poofff: Cleaning up old instance...');
        try {
            window.PoofffInstance.removeInteractionListeners();
        } catch (e) { console.warn('Cleanup failed', e); }
        window.PoofffInstance = null;
    }

    class Poofff {
        constructor() {
            console.log('Poofff: Initializing...');
            this.isPoofffMode = false;
            this.hoveredElement = null;
            this.hiddenSelectors = [];
            this.undoStack = [];

            // DOM ELEMENTS (Member variables)
            this.styleId = 'poofff-global-styles';
            this.uiStyleId = 'poofff-ui-styles';
            this.toastId = 'poofff-toast';
            this.hostname = window.location.hostname;

            this.uiCss = `
      .poofff-target {
        outline: 4px solid #ff4757 !important;
        outline-offset: -2px !important;
        cursor: crosshair !important;
        background-color: rgba(255, 71, 87, 0.1) !important;
        z-index: 2147483646 !important;
      }
      .poofff-active-body {
        cursor: crosshair !important;
        box-shadow: inset 0 0 0 4px #ff4757 !important; 
      }
      .poofff-active-body * {
        cursor: crosshair !important;
        user-select: none !important;
      }
      #poofff-toast {
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: #2f3542;
        color: #fff;
        padding: 12px 24px;
        border-radius: 50px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        font-weight: 500;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 12px;
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        pointer-events: auto;
      }
      #poofff-toast.show {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }
      #poofff-undo-btn {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: #fff;
        padding: 4px 12px;
        border-radius: 20px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.2s ease;
      }
      #poofff-undo-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: #fff;
      }
            `;

            this.bindMethods();
            this.injectBaseStyles();
            this.initStorage();
            this.injectToast();
            this.attachMessageListener();

            // Expose for debugging
            window.PoofffInstance = this;
        }

        bindMethods() {
            this.handleMouseOver = this.handleMouseOver.bind(this);
            this.handleMouseOut = this.handleMouseOut.bind(this);
            this.handleClick = this.handleClick.bind(this);
            this.performUndo = this.performUndo.bind(this);
            this.handleKeyDown = this.handleKeyDown.bind(this);
        }

        injectBaseStyles() {
            if (document.getElementById(this.uiStyleId)) return;
            const style = document.createElement('style');
            style.id = this.uiStyleId;
            style.textContent = this.uiCss;
            document.head.appendChild(style);
        }

        initStorage() {
            chrome.storage.local.get([this.hostname], (result) => {
                if (result[this.hostname]) {
                    this.hiddenSelectors = result[this.hostname];
                    this.updateGlobalStyles();
                }
            });
        }

        attachMessageListener() {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                console.log('Poofff: Message received', request);

                if (request.action === 'TOGGLE_POOFFF') {
                    // If value provided, use it. Otherwise toggle.
                    const newState = (typeof request.value !== 'undefined') ? request.value : !this.isPoofffMode;
                    this.toggleMode(newState);
                    sendResponse({ status: newState ? 'active' : 'inactive', isActive: newState });
                }
                else if (request.action === 'RESET_POOFFF') {
                    this.resetAll();
                    sendResponse({ status: 'reset' });
                }
                else if (request.action === 'REMOVE_SELECTOR') {
                    this.removeSelector(request.selector);
                    sendResponse({ status: 'removed' });
                }
                else if (request.action === 'GET_STATUS') {
                    sendResponse({ isActive: this.isPoofffMode });
                }
                else if (request.action === 'PING') {
                    sendResponse({ status: 'pong' });
                }
                else if (request.action === 'HIGHLIGHT_SELECTOR') {
                    this.highlightSelector(request.selector);
                    sendResponse({ status: 'done' });
                }
                else if (request.action === 'UNHIGHLIGHT_SELECTOR') {
                    this.unhighlightSelector();
                    sendResponse({ status: 'done' });
                }
            });
        }

        highlightSelector(selector) {
            let styleEl = document.getElementById('poofff-highlight-styles');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'poofff-highlight-styles';
                document.head.appendChild(styleEl);
            }
            // Use revert to let the original display apply, but outline it
            styleEl.textContent = `
                ${selector} {
                    display: revert !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    outline: 4px solid #3742fa !important;
                    outline-offset: -2px !important;
                    background-color: rgba(55, 66, 250, 0.2) !important;
                    z-index: 2147483645 !important;
                    pointer-events: none !important;
                }
            `;
        }

        unhighlightSelector() {
            let styleEl = document.getElementById('poofff-highlight-styles');
            if (styleEl) {
                styleEl.textContent = '';
            }
        }

        handleKeyDown(e) {
            if (e.key === 'Escape' && this.isPoofffMode) {
                e.preventDefault();
                e.stopPropagation();
                this.toggleMode(false);
                this.showModeToast("Poofff Mode Exited");
            }
        }

        toggleMode(active) {
            console.log('Poofff: Setting mode to', active);
            this.isPoofffMode = active;

            this.updateGlobalStyles();

            if (this.isPoofffMode) {
                document.body.classList.add('poofff-active-body');
                this.addInteractionListeners();
                this.showModeToast("Poofff Mode Active (Press Esc to exit)");
                // Force focus back to the window if toggled from popup
                window.focus();
            } else {
                document.body.classList.remove('poofff-active-body');
                this.removeInteractionListeners();
                if (this.hoveredElement) {
                    this.hoveredElement.classList.remove('poofff-target');
                    this.hoveredElement = null;
                }
                this.hideToast();
            }
        }

        addInteractionListeners() {
            document.addEventListener('mouseover', this.handleMouseOver, true);
            document.addEventListener('mouseout', this.handleMouseOut, true);
            document.addEventListener('click', this.handleClick, true);
            document.addEventListener('keydown', this.handleKeyDown, true);
        }

        removeInteractionListeners() {
            document.removeEventListener('mouseover', this.handleMouseOver, true);
            document.removeEventListener('mouseout', this.handleMouseOut, true);
            document.removeEventListener('click', this.handleClick, true);
            document.removeEventListener('keydown', this.handleKeyDown, true);
        }

        getDeepestVisibleElement(x, y) {
            const elementsUnderCursor = document.elementsFromPoint(x, y);
            
            for (let i = 0; i < elementsUnderCursor.length; i++) {
                const el = elementsUnderCursor[i];
                if (el.id === this.toastId || el.closest(`#${this.toastId}`)) continue;
                if (el.tagName.toLowerCase() === 'html' || el.tagName.toLowerCase() === 'body') continue;
                
                // If it's a structural div carrying no background, borders, or text, and it has children beneath the cursor, skip it to grab what's actually visible underneath
                const style = window.getComputedStyle(el);
                const isVisuallyEmptyContainer = 
                    el.tagName.toLowerCase() === 'div' &&
                    style.backgroundColor === 'rgba(0, 0, 0, 0)' &&
                    style.backgroundImage === 'none' &&
                    style.borderWidth === '0px' &&
                    style.boxShadow === 'none' &&
                    el.children.length > 0;

                // For very specific cases like Perplexity, wrapping layers block the children below. 
                // We'll skip visually empty containers that just exist for flex/grid layouts.
                if (isVisuallyEmptyContainer) {
                    continue; 
                }
                
                return el;
            }
            return elementsUnderCursor[0] || document.body;
        }

        handleMouseOver(e) {
            if (!this.isPoofffMode) return;
            e.preventDefault();
            e.stopPropagation();

            // If Arc or Chrome stole keyboard focus to the URL bar/popup when the popup was opened,
            // we will opportunistically steal it back if the user moves their mouse over the page.
            if (!document.hasFocus()) {
                window.focus();
            }

            if (this.hoveredElement) {
                this.hoveredElement.classList.remove('poofff-target');
            }

            if (e.target.id === this.toastId || e.target.closest(`#${this.toastId}`)) return;

            // Instead of just e.target, drill down to the visually relevant element
            this.hoveredElement = this.getDeepestVisibleElement(e.clientX, e.clientY);
            if (this.hoveredElement) {
                this.hoveredElement.classList.add('poofff-target');
            }
        }

        handleMouseOut(e) {
            if (!this.isPoofffMode) return;
            if (this.hoveredElement) {
                this.hoveredElement.classList.remove('poofff-target');
            }
        }

        handleClick(e) {
            if (!this.isPoofffMode) return;
            if (e.target.id === this.toastId || e.target.closest(`#${this.toastId}`)) return;

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            // Match hover logic: capture what's visually under the cursor, not just the DOM interceptor Layer
            const target = this.getDeepestVisibleElement(e.clientX, e.clientY);

            // Check if we are clicking an already-hidden element to unhide it
            const matchedSelectorIndex = this.hiddenSelectors.findIndex(sel => {
                try { return target.matches(sel); } catch(ex) { return false; }
            });

            if (matchedSelectorIndex !== -1) {
                const sel = this.hiddenSelectors[matchedSelectorIndex];
                this.hiddenSelectors.splice(matchedSelectorIndex, 1);
                this.undoStack = this.undoStack.filter(s => s !== sel);
                this.saveSelectors();
                this.updateGlobalStyles();
                target.classList.remove('poofff-target');
                this.showModeToast("Element unhidden");
                return;
            }

            const selector = this.generateSelector(target);

            if (!selector) {
                console.warn('Poofff: Could not generate selector');
                return;
            }

            if (!this.hiddenSelectors.includes(selector)) {
                this.hiddenSelectors.push(selector);
                this.saveSelectors();
            }

            this.undoStack.push(selector);
            this.updateGlobalStyles();
            target.classList.remove('poofff-target');
            this.showToast();
        }

        generateSelector(el) {
            if (!el) return null;

            // Helper: Get unique classes (not common utility classes)
            const getUniqueClasses = (element) => {
                if (!element.classList || element.classList.length === 0) return '';
                const commonClasses = ['container', 'row', 'col', 'wrapper', 'content', 'active', 'hidden', 'visible'];
                const uniqueClasses = Array.from(element.classList)
                    .filter(cls => !commonClasses.includes(cls) && !/^(is|has)-/.test(cls))
                    .map(cls => CSS.escape(cls))
                    .slice(0, 2); // Limit to 2 classes
                return uniqueClasses.length > 0 ? '.' + uniqueClasses.join('.') : '';
            };

            // Helper: Check if selector is unique
            const isUnique = (sel) => {
                try {
                    return document.querySelectorAll(sel).length === 1;
                } catch (e) {
                    return false;
                }
            };

            const path = [];
            let current = el;

            while (current && current.nodeType === Node.ELEMENT_NODE) {
                let selector = current.nodeName.toLowerCase();

                // Priority 1: Use ID if it exists and isn't auto-generated
                if (current.id && !/^\d+$|^[a-z0-9]{8,}$/i.test(current.id)) {
                    selector = '#' + CSS.escape(current.id);
                    path.unshift(selector);

                    // Check if this ID alone is unique enough
                    const fullPath = path.join(' > ');
                    if (isUnique(fullPath)) {
                        return fullPath;
                    }
                    break;
                }

                // Priority 2: Add unique classes
                const classes = getUniqueClasses(current);
                if (classes) {
                    selector += classes;
                }

                // Priority 3: Add data attributes for extra specificity
                if (current.hasAttribute('data-testid')) {
                    selector += `[data-testid="${CSS.escape(current.getAttribute('data-testid'))}"]`;
                } else if (current.hasAttribute('data-id')) {
                    selector += `[data-id="${CSS.escape(current.getAttribute('data-id'))}"]`;
                }

                // Priority 4: Use nth-child only if needed (more specific than nth-of-type)
                if (current.parentNode) {
                    const siblings = Array.from(current.parentNode.children);
                    if (siblings.length > 1) {
                        const index = siblings.indexOf(current) + 1;
                        // Only add nth-child if there are multiple siblings of same type
                        const sameTypeCount = siblings.filter(s => s.nodeName === current.nodeName).length;
                        if (sameTypeCount > 1) {
                            selector += `:nth-child(${index})`;
                        }
                    }
                }

                path.unshift(selector);

                // Check if current path is unique
                const currentPath = path.join(' > ');
                if (isUnique(currentPath)) {
                    return currentPath;
                }

                // Stop if we've built a reasonably long path
                if (path.length >= 5) {
                    break;
                }

                current = current.parentNode;
            }
            return path.join(' > ');
        }

        saveSelectors() {
            chrome.storage.local.set({ [this.hostname]: this.hiddenSelectors });
        }

        updateGlobalStyles() {
            let styleEl = document.getElementById(this.styleId);
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = this.styleId;
                document.head.appendChild(styleEl);
            }
            if (this.hiddenSelectors.length === 0) {
                styleEl.textContent = '';
                return;
            }

            if (this.isPoofffMode) {
                // When in Edit Mode, unhide elements but mark them with dashed borders and numbers
                let css = '';
                this.hiddenSelectors.forEach((sel, i) => {
                    const num = i + 1;
                    css += `
                        ${sel} {
                            opacity: 0.3 !important;
                            outline: 2px dashed #ff4757 !important;
                            outline-offset: -2px !important;
                            position: relative !important;
                            filter: grayscale(100%) !important;
                        }
                        ${sel}::after {
                            content: "${num}" !important;
                            position: absolute !important;
                            top: 0 !important;
                            left: 0 !important;
                            background: #ff4757 !important;
                            color: white !important;
                            font-size: 14px !important;
                            font-family: monospace !important;
                            font-weight: bold !important;
                            padding: 2px 6px !important;
                            border-radius: 0 0 4px 0 !important;
                            z-index: 2147483647 !important;
                            pointer-events: none !important;
                            line-height: 1 !important;
                            box-shadow: 0 0 4px rgba(0,0,0,0.5) !important;
                        }
                    `;
                });
                styleEl.textContent = css;
            } else {
                // Normal mode: hide elements securely
                // Use :is() to prevent one invalid selector from breaking the entire rule
                const css = ':is(' + this.hiddenSelectors.join(',\n') + ') { display: none !important; }';
                styleEl.textContent = css;
            }
        }

        resetAll() {
            this.hiddenSelectors = [];
            this.undoStack = [];
            this.saveSelectors();
            this.updateGlobalStyles();
            this.hideToast();
        }

        removeSelector(selector) {
            this.hiddenSelectors = this.hiddenSelectors.filter(s => s !== selector);
            this.undoStack = this.undoStack.filter(s => s !== selector);
            this.saveSelectors();
            this.updateGlobalStyles();
        }

        injectToast() {
            if (document.getElementById(this.toastId)) return;
            const toast = document.createElement('div');
            toast.id = this.toastId;
            toast.innerHTML = `<span>Element hidden</span><button id="poofff-undo-btn">Undo</button>`;
            document.body.appendChild(toast);

            const btn = document.getElementById('poofff-undo-btn');
            if (btn) btn.addEventListener('click', this.performUndo);
        }

        showToast() {
            const toast = document.getElementById(this.toastId);
            if (!toast) return;
            toast.classList.add('show');

            // Cleanup text if it was changed by mode toast
            if (!toast.querySelector('#poofff-undo-btn')) {
                toast.innerHTML = `<span>Element hidden</span><button id="poofff-undo-btn">Undo</button>`;
                document.getElementById('poofff-undo-btn').addEventListener('click', this.performUndo);
            }

            clearTimeout(this.toastTimeout);
            this.toastTimeout = setTimeout(() => {
                toast.classList.remove('show');
            }, 4000);
        }

        showModeToast(msg) {
            const toast = document.getElementById(this.toastId);
            if (!toast) return;
            toast.innerHTML = `<span>${msg}</span>`;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2000);
        }

        hideToast() {
            const toast = document.getElementById(this.toastId);
            if (toast) toast.classList.remove('show');
        }

        performUndo() {
            const lastSelector = this.undoStack.pop();
            if (!lastSelector) return;
            this.hiddenSelectors = this.hiddenSelectors.filter(s => s !== lastSelector);
            this.saveSelectors();
            this.updateGlobalStyles();
            if (this.undoStack.length === 0) {
                this.hideToast();
            } else {
                this.showToast();
            }
        }
    }

    // Instantiate
    new Poofff();

})();
