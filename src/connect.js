// The prompt that connects GoalAgents to any agent, with a copy icon on its block.
import { MCP_URL } from './config.js';

export const CONNECT_PROMPT =
  `Connect this MCP server for me: ${MCP_URL} (GoalAgents, remote, sign-in with OAuth). ` +
  `If you can't connect it yourself, tell me exactly how to do it in this app.`;

const COPY = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>';
const DONE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>';

// Fills <pre data-connect-prompt> blocks with the prompt and puts a copy icon on every <pre> in root.
export function setUpConnect(root = document) {
  root.querySelectorAll('pre[data-connect-prompt]').forEach(pre => { pre.textContent = CONNECT_PROMPT; });
  root.querySelectorAll('pre').forEach(pre => {
    const box = document.createElement('div'), btn = document.createElement('button');
    box.className = 'copybox'; btn.className = 'copy'; btn.innerHTML = COPY;
    btn.title = 'Copy'; btn.setAttribute('aria-label', 'Copy');
    pre.replaceWith(box); box.append(pre, btn);
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(pre.textContent.trim()); btn.innerHTML = DONE; btn.title = 'Copied'; }
      catch { btn.title = 'Select the text and copy it'; }
      setTimeout(() => { btn.innerHTML = COPY; btn.title = 'Copy'; }, 1500);
    });
  });
}
