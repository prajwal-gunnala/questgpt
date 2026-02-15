/**
 * Error Analyzer Module
 * Uses Gemini AI to diagnose installation failures and suggest fixes.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

class ErrorAnalyzer {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  /**
   * Analyze an installation error and return a user-friendly diagnosis.
   * @param {{ command: string, stderr: string, exitCode: number, dependency: string, systemInfo: object }} errorContext
   * @returns {Promise<{ root_cause: string, explanation: string, suggested_fixes: string[] }>}
   */
  async analyzeError(errorContext) {
    const prompt = `You are a Linux system administration expert. A user tried to install software and got an error.

FAILED COMMAND: ${errorContext.command}
EXIT CODE: ${errorContext.exitCode || 'unknown'}
ERROR OUTPUT:
${(errorContext.stderr || '').substring(0, 1500)}

DEPENDENCY: ${errorContext.dependency}
OS: ${errorContext.systemInfo?.os || 'Linux'}
PACKAGE MANAGER: ${errorContext.systemInfo?.packageManager || 'apt'}

Analyze this error and return ONLY valid JSON (no markdown, no explanation outside JSON):
{
  "root_cause": "One sentence describing the root cause",
  "explanation": "2-3 sentence plain English explanation a beginner would understand",
  "suggested_fixes": [
    "First fix command or action to try",
    "Second alternative fix",
    "Third alternative fix"
  ]
}

Rules:
- Keep explanations simple and beginner-friendly
- Suggested fixes should be concrete terminal commands when possible
- Maximum 3 suggested fixes
- No jargon — explain like talking to a first-year CS student`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();

      // Clean markdown fences
      text = text.replace(/^```json\n?/gm, '').replace(/^```\n?/gm, '').replace(/\n?```$/gm, '').trim();

      return JSON.parse(text);
    } catch (error) {
      // Fallback when AI analysis fails
      return {
        root_cause: 'Unable to determine the exact cause automatically.',
        explanation: `The command "${errorContext.command}" failed. This could be due to network issues, missing repositories, or permission problems.`,
        suggested_fixes: [
          (errorContext.systemInfo?.os || '').toLowerCase().includes('win')
            ? 'Try running the app as Administrator and retry the installation'
            : 'Try running: sudo apt-get update && then retry the installation',
          'Check your internet connection',
          'Try running the command manually in a terminal to see full output'
        ]
      };
    }
  }
}

module.exports = ErrorAnalyzer;
