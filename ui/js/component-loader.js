/**
 * Component Loader
 * Loads HTML components dynamically
 */

async function loadComponent(componentName, targetId) {
  try {
    const response = await fetch(`components/${componentName}.html`);
    if (!response.ok) throw new Error(`Failed to load ${componentName}`);
    
    const html = await response.text();
    const target = document.getElementById(targetId);
    
    if (target) {
      target.innerHTML = html;
    } else {
      console.error(`Target element #${targetId} not found`);
    }
  } catch (error) {
    console.error(`Error loading component ${componentName}:`, error);
  }
}

async function loadAllComponents() {
  // Load all components in parallel
  await Promise.all([
    loadComponent('header', 'header-container'),
    loadComponent('step1-search', 'step1-container'),
    loadComponent('step2-select', 'step2-container'),
    loadComponent('step3-install', 'step3-container'),
    loadComponent('step4-results', 'step4-container'),
    loadComponent('modals', 'modals-container'),
    loadComponent('footer', 'footer-container')
  ]);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadComponent, loadAllComponents };
}
