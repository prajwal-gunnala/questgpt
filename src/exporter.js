const fs = require('fs');
const path = require('path');

/**
 * Context Exporter Module (MINIMAL VERSION)
 * Export environment context for sharing with AI assistants
 */
class Exporter {
  constructor(stateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Export context to JSON
   */
  toJSON(context = null) {
    const state = context || this.stateManager.getAll();
    console.log('[Exporter] Exporting to JSON');
    return JSON.stringify(state, null, 2);
  }

  /**
   * Export context to Markdown (MINIMAL)
   */
  toMarkdown(context = null) {
    const state = context || this.stateManager.getAll();
    console.log('[Exporter] Exporting to Markdown');
    
    let md = `# QuestGPT Environment Context\n\n`;
    md += `**Last Scan:** ${state.last_scan || 'Never'}\n\n`;
    md += `**System:** ${state.system?.os || 'Unknown'} (${state.system?.package_manager})\n\n`;
    md += `## Installed Tools (${Object.keys(state.installed_tools || {}).length})\n\n`;
    
    Object.values(state.installed_tools || {}).forEach(tool => {
      md += `- **${tool.display_name}** v${tool.version} (${tool.source})\n`;
    });
    
    return md;
  }

  /**
   * Export context to plain text (MINIMAL)
   */
  toPlainText(context = null) {
    const state = context || this.stateManager.getAll();
    console.log('[Exporter] Exporting to plain text');
    
    let text = `QuestGPT Environment Context\n`;
    text += `Last Scan: ${state.last_scan || 'Never'}\n`;
    text += `System: ${state.system?.os} (${state.system?.package_manager})\n\n`;
    text += `Installed Tools (${Object.keys(state.installed_tools || {}).length}):\n`;
    
    Object.values(state.installed_tools || {}).forEach(tool => {
      text += `- ${tool.display_name} v${tool.version}\n`;
    });
    
    return text;
  }

  /**
   * Save export to file
   */
  async saveToFile(format = 'json', filePath = null) {
    const state = this.stateManager.getAll();
    
    let content;
    let extension;
    switch (format.toLowerCase()) {
      case 'markdown':
      case 'md':
        content = this.toMarkdown(state);
        extension = '.md';
        break;
      case 'text':
      case 'txt':
        content = this.toPlainText(state);
        extension = '.txt';
        break;
      default:
        content = this.toJSON(state);
        extension = '.json';
    }

    const outputPath = filePath || path.join(
      this.stateManager.stateDir, 
      `environment_export_${Date.now()}${extension}`
    );

    fs.writeFileSync(outputPath, content, 'utf8');
    console.log(`[Exporter] Saved to: ${outputPath}`);
    return outputPath;
  }
}

module.exports = Exporter;
