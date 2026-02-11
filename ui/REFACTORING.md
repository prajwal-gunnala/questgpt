# UI Refactoring Guide

## 📁 New Structure

The UI has been refactored into a modular architecture for better maintainability:

```
ui/
├── index.html                 # Main HTML (now simplified with containers)
├── styles.css                 # All styles (unchanged)
├── renderer.js                # Original full renderer (still active)
├── renderer-new.js            # New modular orchestrator (WIP)
│
├── components/                # HTML Components
│   ├── header.html           # Header with logo and system info
│   ├── step1-search.html     # Search/discovery step
│   ├── step2-select.html     # Dependency selection step
│   ├── step3-install.html    # Installation & quiz step
│   ├── step4-results.html    # Verification results step
│   ├── modals.html           # All modal dialogs
│   └── footer.html           # Footer
│
└── js/                        # JavaScript Modules
    ├── app-state.js          # Global state management
    ├── component-loader.js   # Dynamic HTML loading
    ├── ui-helpers.js         # Common UI utilities
    ├── step1-handler.js      # Step 1 logic
    ├── step2-handler.js      # Step 2 logic
    ├── step3-handler.js      # Step 3 logic (TODO)
    ├── step4-handler.js      # Step 4 logic (TODO)
    ├── modal-handler.js      # Modal management (TODO)
    └── uninstall-handler.js  # Uninstall logic (TODO)
```

## 🎯 Benefits

### ✅ Completed
1. **Separation of Concerns**: Each step has its own HTML and JS file
2. **Component Reusability**: HTML components can be loaded dynamically
3. **Easier Maintenance**: Find and fix code faster
4. **Better Organization**: Logical grouping of related functionality
5. **Centralized State**: Global app state in one place

### 🚧 In Progress
- Step 3 (Installation & Quiz) handler needs extraction
- Step 4 (Results) handler needs extraction
- Modal handlers need extraction
- Uninstall functionality needs extraction

## 🔄 How It Works

### Component Loading
The new `component-loader.js` dynamically loads HTML components:

```javascript
await loadAllComponents(); // Loads all components in parallel
```

### State Management
All app state is now in `app-state.js`:

```javascript
window.appState = {
  systemInfo: null,
  selectedDependencies: new Set(),
  currentMode: 'full',
  // ... more state
};
```

### Module Pattern
Each step handler exports functions:

```javascript
// step1-handler.js
function handleSearch() { /* ... */ }
function initStep1() { /* ... */ }

module.exports = { handleSearch, initStep1 };
```

## 📝 Migration Status

### Current State
- **Original**: `renderer.js` (1051 lines) - Still active
- **New**: `renderer-new.js` - Partially implemented

### To Migrate
The following functions still need to be extracted from `renderer.js`:

**Step 3 Functions:**
- `handleInstall()`
- `showSafetyPreview()`
- `proceedWithInstall()`
- `startInstallation()`
- `displayNextMCQ()`
- `selectAnswer()`

**Step 4 Functions:**
- `runVerification()` ✅ (Enhanced)
- `proceedToVerification()` ✅ (Added)

**Modal Functions:**
- `uninstallSelected()`
- `showUninstallPlaceholder()`
- `executeUninstall()`

## 🚀 Usage

### Current (Active)
The app still uses the original `renderer.js`:
```html
<script src="renderer.js"></script>
```

### Future (After Migration)
Once migration is complete, switch to:
```html
<script src="js/app-state.js"></script>
<script src="js/component-loader.js"></script>
<script src="js/ui-helpers.js"></script>
<script src="js/step1-handler.js"></script>
<script src="js/step2-handler.js"></script>
<script src="js/step3-handler.js"></script>
<script src="js/step4-handler.js"></script>
<script src="js/modal-handler.js"></script>
<script src="js/uninstall-handler.js"></script>
<script src="renderer-new.js"></script>
```

## 🛠️ Next Steps

1. **Extract Step 3 logic** → Create `step3-handler.js`
2. **Extract Step 4 logic** → Create `step4-handler.js`
3. **Extract Modal logic** → Create `modal-handler.js`
4. **Extract Uninstall logic** → Create `uninstall-handler.js`
5. **Test thoroughly** → Ensure all features work
6. **Replace renderer.js** → Switch to modular approach
7. **Delete old file** → Clean up `renderer.js`

## 📋 Developer Guide

### Adding a New Component

1. Create HTML file in `components/`:
```html
<!-- components/my-component.html -->
<div class="my-component">
  <h2>My Component</h2>
  <p>Content here</p>
</div>
```

2. Add container in `index.html`:
```html
<div id="my-component-container"></div>
```

3. Load in `component-loader.js`:
```javascript
await loadComponent('my-component', 'my-component-container');
```

### Adding a New Handler Module

1. Create JS file in `js/`:
```javascript
// js/my-handler.js
function myFunction() {
  // Your logic here
}

function initMyHandler() {
  // Setup event listeners
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { myFunction, initMyHandler };
}
```

2. Include in `index.html`:
```html
<script src="js/my-handler.js"></script>
```

3. Initialize in `renderer-new.js`:
```javascript
initMyHandler();
```

## 🎨 Conventions

- **File naming**: Use kebab-case (e.g., `step1-handler.js`)
- **Function naming**: Use camelCase (e.g., `handleSearch()`)
- **Global functions**: Attach to `window` object
- **State**: Always use `window.appState`
- **Components**: Keep components focused and single-purpose

## 🔍 Debugging

The modular structure makes debugging easier:

1. **Isolate issues**: Check specific handler module
2. **Component issues**: Verify HTML in `components/`
3. **State issues**: Inspect `window.appState`
4. **Load issues**: Check browser console for component load errors

## 📚 Resources

- [Electron IPC Communication](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [ES6 Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [Component-Based Architecture](https://www.patterns.dev/posts/component-pattern/)
