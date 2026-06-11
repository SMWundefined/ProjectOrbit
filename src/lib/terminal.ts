// Terminal UI controller: input handling, history navigation, tab
// completion, and rendering. Command behavior lives in commands.ts.

import { commandNames, escapeHtml, executeCommand, type CommandContext } from './commands';

function longestCommonPrefix(values: string[]): string {
  if (values.length === 0) return '';
  let prefix = values[0];
  for (const value of values.slice(1)) {
    while (!value.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}

export function initTerminal(): void {
  const commandInput = document.getElementById('command-input') as HTMLInputElement | null;
  const commandHistory = document.getElementById('command-history');
  const terminalContent = document.getElementById('terminal-content');
  const typedText = document.getElementById('typed-text');
  const terminalWindow = document.getElementById('terminal-window');

  if (!commandInput || !commandHistory || !terminalContent || !typedText) {
    console.error('Terminal elements not found.');
    return;
  }

  // Identity is injected by Terminal.astro from env — never hardcoded here.
  const prompt = terminalContent.dataset.prompt || 'guest@orbit:~$';
  const ctx: CommandContext = {
    links: {
      github: terminalContent.dataset.github ?? '',
      linkedin: terminalContent.dataset.linkedin ?? '',
      email: terminalContent.dataset.email ?? '',
      website: terminalContent.dataset.website ?? '',
    },
  };

  // Entered-command history for up/down recall. historyIndex === entered.length
  // means "live line"; draft preserves whatever was typed before recalling.
  const entered: string[] = [];
  let historyIndex = 0;
  let draft = '';

  // Mirror the hidden input into the visible line so the block cursor
  // sits exactly where the next character will land.
  function syncTypedText(): void {
    typedText!.textContent = commandInput!.value;
  }

  function scrollToBottom(): void {
    terminalContent!.scrollTop = terminalContent!.scrollHeight;
  }

  function print(command: string, html: string): void {
    const entry = document.createElement('div');
    entry.className = 'mb-3';
    entry.innerHTML = `
      <div><span class="text-term-blue">${prompt}</span> ${escapeHtml(command)}</div>
      <div class="whitespace-pre-wrap">${html}</div>
    `;
    commandHistory!.appendChild(entry);
    scrollToBottom();
  }

  function run(raw: string): void {
    const result = executeCommand(raw, ctx);
    if (result.type === 'clear') {
      commandHistory!.innerHTML = '';
    } else {
      print(raw, result.html);
    }
    if (raw.trim()) entered.push(raw);
    historyIndex = entered.length;
    draft = '';
    commandInput!.value = '';
    syncTypedText();
  }

  function recall(direction: -1 | 1): void {
    if (direction === -1) {
      if (historyIndex === 0) return;
      if (historyIndex === entered.length) draft = commandInput!.value;
      historyIndex -= 1;
      commandInput!.value = entered[historyIndex];
    } else {
      if (historyIndex === entered.length) return;
      historyIndex += 1;
      commandInput!.value = historyIndex === entered.length ? draft : entered[historyIndex];
    }
    syncTypedText();
  }

  function complete(): void {
    const value = commandInput!.value;
    if (!value || value.includes(' ')) return;
    const matches = commandNames().filter((name) => name.startsWith(value.toLowerCase()));
    if (matches.length === 0) return;
    if (matches.length === 1) {
      commandInput!.value = matches[0];
    } else {
      const prefix = longestCommonPrefix(matches);
      if (prefix.length > value.length) {
        commandInput!.value = prefix;
      } else {
        // Stuck on an ambiguous prefix — list the options, shell-style.
        print(value, matches.join('   '));
      }
    }
    syncTypedText();
  }

  commandInput.addEventListener('input', syncTypedText);

  commandInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      run(commandInput.value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      recall(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      recall(1);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      complete();
    }
  });

  // Focus management: preventScroll stops the browser from yanking the
  // window around to reveal the visually hidden input. Refocus only on
  // clicks inside the terminal, and never while the user is selecting text.
  function focusInput(): void {
    commandInput!.focus({ preventScroll: true });
  }

  focusInput();

  (terminalWindow ?? terminalContent).addEventListener('click', () => {
    const selection = window.getSelection();
    if (selection && selection.toString()) return;
    focusInput();
  });
}
