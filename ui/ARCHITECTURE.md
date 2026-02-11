# QuestGPT UI Architecture

## 🏗️ Modular Structure Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         index.html                              │
│                    (Main Container Only)                        │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ Dynamically Loads ↓
                        │
┌───────────────────────┴─────────────────────────────────────────┐
│                    Component Loader                             │
│                 (component-loader.js)                           │
└───────┬─────────┬─────────┬─────────┬─────────┬────────────────┘
        │         │         │         │         │
        ↓         ↓         ↓         ↓         ↓
    ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐
    │Header│ │Step1 │ │Step2 │ │Step3 │ │  Modals  │
    │ .html│ │ .html│ │ .html│ │ .html│ │   .html  │
    └──────┘ └──────┘ └──────┘ └──────┘ └──────────┘


┌─────────────────────────────────────────────────────────────────┐
│                    Application State                            │
│                     (app-state.js)                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  • systemInfo        • selectedDependencies                │ │
│  │  • analysisResult    • currentMCQIndex                     │ │
│  │  • sudoPassword      • installedPackagesHistory            │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │ Shared State ↕
┌────────────────────────────┴────────────────────────────────────┐
│                      Module Handlers                            │
├─────────────────┬──────────────────┬──────────────────┬─────────┤
│  Step 1 Handler │  Step 2 Handler  │  Step 3 Handler  │ Step 4  │
│                 │                  │                  │ Handler │
│  • Search       │  • Display Deps  │  • Installation  │ • Verify│
│  • Analyze      │  • Selection     │  • MCQ Quiz      │ • Show  │
│  • Navigate     │  • Stack Options │  • Progress      │ Results │
└─────────────────┴──────────────────┴──────────────────┴─────────┘
         ↕                  ↕                 ↕                ↕
┌─────────────────────────────────────────────────────────────────┐
│                      UI Helpers                                 │
│  • showStep()        • addTerminalLine()                        │
│  • displaySystemInfo()   • clearTerminal()                      │
│  • showLoading()     • displayConflicts()                       │
└─────────────────────────────────────────────────────────────────┘
         ↕                                                    ↕
┌─────────────────────────────────────────────────────────────────┐
│                    Electron IPC Bridge                          │
│               (Communication with Main Process)                 │
│  • detect-system     • analyze-request                          │
│  • check-installed   • install-dependency                       │
│  • verify-installation   • generate-uninstall-plan              │
└─────────────────────────────────────────────────────────────────┘
```

## 📦 File Responsibility Matrix

| File | Purpose | Dependencies | Lines |
|------|---------|--------------|-------|
| **index.html** | Main container with placeholders | None | ~50 |
| **components/*** | Isolated HTML sections | None | ~30 each |
| **app-state.js** | Global state management | None | ~40 |
| **component-loader.js** | Dynamic HTML loading | None | ~30 |
| **ui-helpers.js** | Common UI utilities | app-state | ~80 |
| **step1-handler.js** | Search & analysis logic | app-state, ui-helpers, ipc | ~80 |
| **step2-handler.js** | Selection & display logic | app-state, ui-helpers, ipc | ~180 |
| **step3-handler.js** | Install & quiz logic | app-state, ui-helpers, ipc | ~300 |
| **step4-handler.js** | Verification logic | app-state, ui-helpers, ipc | ~100 |
| **modal-handler.js** | Modal management | app-state, ui-helpers | ~80 |
| **uninstall-handler.js** | Uninstall operations | app-state, ui-helpers, ipc | ~120 |
| **renderer-new.js** | Main orchestrator | All modules | ~100 |

**Total Estimated Lines: ~1,190** (vs original 1,051 but much more organized!)

## 🔄 Data Flow

### User Action Flow
```
User Input
    ↓
Event Listener (in step handler)
    ↓
Update App State
    ↓
IPC Call to Main Process (if needed)
    ↓
Update UI (via ui-helpers)
    ↓
Navigate to Next Step
```

### Example: Search Flow
```
1. User types "pandas"
2. step1-handler.handleSearch()
3. ipcRenderer.invoke('analyze-request')
4. Store result in window.appState.analysisResult
5. Call displayDependencies() from step2-handler
6. showStep(2) to navigate
```

## 🎯 Module Communication

### Direct Calls
```javascript
// step1-handler calls step2-handler
import { displayDependencies } from './step2-handler.js';
displayDependencies(dependencies);
```

### Shared State
```javascript
// Both modules access same state
window.appState.selectedDependencies.add('pandas');
```

### Event-Based (Future Enhancement)
```javascript
// Emit custom events
window.dispatchEvent(new CustomEvent('dependencies-selected', {
  detail: { count: 5 }
}));

// Listen in other modules
window.addEventListener('dependencies-selected', (e) => {
  console.log(`${e.detail.count} deps selected`);
});
```

## 📊 Before vs After Comparison

### Before (Monolithic)
```
renderer.js (1051 lines)
├── Step 1 logic (mixed)
├── Step 2 logic (mixed)
├── Step 3 logic (mixed)
├── Step 4 logic (mixed)
├── Helper functions (mixed)
├── State variables (scattered)
└── IPC handlers (mixed)

❌ Hard to find specific logic
❌ Difficult to test individual features
❌ Merge conflicts when multiple devs work
❌ HTML embedded in JS
```

### After (Modular)
```
Components (7 files, ~200 lines)
├── Pure HTML, no logic
└── Easy to modify layout

State (1 file, ~40 lines)
└── Single source of truth

Handlers (6 files, ~860 lines)
├── step1-handler.js
├── step2-handler.js
├── step3-handler.js
├── step4-handler.js
├── modal-handler.js
└── uninstall-handler.js

Utils (2 files, ~110 lines)
├── ui-helpers.js
└── component-loader.js

Orchestrator (1 file, ~100 lines)
└── renderer-new.js

✅ Easy to locate specific features
✅ Test individual modules
✅ Multiple devs can work simultaneously
✅ Clean separation of HTML/JS
```

## 🧪 Testing Strategy

### Unit Testing (Future)
```javascript
// Test individual modules
describe('step1-handler', () => {
  it('should handle search correctly', () => {
    // Test logic
  });
});
```

### Integration Testing
```javascript
// Test module interactions
describe('search to selection flow', () => {
  it('should transition from step1 to step2', () => {
    // Test navigation
  });
});
```

## 🚀 Performance Benefits

1. **Parallel Loading**: Components load simultaneously
2. **Lazy Loading**: Can load components on-demand
3. **Code Splitting**: Smaller individual files
4. **Browser Caching**: Components cached separately
5. **Easier Minification**: Module bundlers work better

## 🔐 Security Considerations

1. **Component Injection**: Use `textContent` not `innerHTML` for user data
2. **State Validation**: Validate before updating `appState`
3. **IPC Security**: Sanitize data before IPC calls
4. **CSP Headers**: Add Content Security Policy for production

## 📱 Mobile/Responsive (Future)

The modular structure makes it easier to:
- Swap mobile-specific components
- Load different layouts based on screen size
- Create tablet-optimized flows

## 🎨 Theming (Future)

Components can be easily themed:
```
components/
├── header.html          (default theme)
├── header-dark.html     (dark theme)
└── header-minimal.html  (minimal theme)
```

Load based on user preference:
```javascript
const theme = getUserTheme();
loadComponent(`header-${theme}`, 'header-container');
```

## 🌐 i18n Support (Future)

Separate text content from logic:
```
components/
├── en/
│   ├── step1-search.html
│   └── step2-select.html
└── es/
    ├── step1-search.html
    └── step2-select.html
```

## 🏁 Migration Checklist

- [x] Create component files
- [x] Create handler modules (step1, step2)
- [x] Create app-state module
- [x] Create ui-helpers module
- [x] Create component-loader
- [ ] Extract step3-handler
- [ ] Extract step4-handler
- [ ] Extract modal-handler
- [ ] Extract uninstall-handler
- [ ] Test all features
- [ ] Update documentation
- [ ] Replace old renderer.js
- [ ] Celebrate! 🎉
