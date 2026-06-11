// Terminal UI controller: input handling, history navigation, tab
// completion, AI chat mode, and rendering. Command behavior lives in
// commands.ts; the AI backend lives at /api/chat.

import { commandNames, escapeHtml, executeCommand, type CommandContext } from './commands';

const AI_PROMPT = 'ai ✦'; // ai ✦ — gold marks chat mode throughout
const CHAT_ENDPOINT = '/api/chat';

function longestCommonPrefix(values: string[]): string {
  if (values.length === 0) return '';
  let prefix = values[0];
  for (const value of values.slice(1)) {
    while (!value.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}

function newSessionId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function initTerminal(): void {
  const commandInput = document.getElementById('command-input') as HTMLInputElement | null;
  const commandHistory = document.getElementById('command-history');
  const terminalContent = document.getElementById('terminal-content');
  const typedText = document.getElementById('typed-text');
  const terminalWindow = document.getElementById('terminal-window');
  const promptLabel = document.getElementById('prompt-label');
  const cursor = document.getElementById('cursor');

  if (!commandInput || !commandHistory || !terminalContent || !typedText || !promptLabel) {
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

  const sessionId = newSessionId();
  let mode: 'command' | 'chat' = 'command';
  let busy = false;

  // Entered-line history for up/down recall. historyIndex === entered.length
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

  function setMode(next: 'command' | 'chat'): void {
    mode = next;
    const chat = next === 'chat';
    promptLabel!.textContent = chat ? `${AI_PROMPT} ` : `${prompt} `;
    promptLabel!.classList.toggle('text-accent-gold', chat);
    promptLabel!.classList.toggle('text-term-blue', !chat);
    cursor?.classList.toggle('text-accent-gold', chat);
  }

  function echoHtml(line: string): string {
    const promptClass = mode === 'chat' ? 'text-accent-gold' : 'text-term-blue';
    const promptText = mode === 'chat' ? AI_PROMPT : prompt;
    return `<div><span class="${promptClass}">${promptText}</span> ${escapeHtml(line)}</div>`;
  }

  function print(line: string, html: string): void {
    const entry = document.createElement('div');
    entry.className = 'mb-3';
    entry.innerHTML = `${echoHtml(line)}<div class="whitespace-pre-wrap">${html}</div>`;
    commandHistory!.appendChild(entry);
    scrollToBottom();
  }

  function rememberLine(raw: string): void {
    if (raw.trim()) entered.push(raw);
    historyIndex = entered.length;
    draft = '';
    commandInput!.value = '';
    syncTypedText();
  }

  // --- AI chat -----------------------------------------------------------

  async function askAI(question: string): Promise<void> {
    busy = true;

    const entry = document.createElement('div');
    entry.className = 'mb-3';
    entry.innerHTML = echoHtml(question);

    const responseDiv = document.createElement('div');
    responseDiv.className = 'whitespace-pre-wrap text-term-muted';
    responseDiv.textContent = 'thinking';
    entry.appendChild(responseDiv);
    commandHistory!.appendChild(entry);
    scrollToBottom();

    let dots = 0;
    const thinking = window.setInterval(() => {
      dots = (dots + 1) % 4;
      responseDiv.textContent = `thinking${'.'.repeat(dots)}`;
    }, 350);

    const settle = (text: string, isError: boolean) => {
      window.clearInterval(thinking);
      responseDiv.textContent = text;
      responseDiv.classList.toggle('text-term-muted', isError);
    };

    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question, sessionId }),
      });

      const isError = !response.ok || response.headers.get('X-Orbit-Route') === 'error';

      if (!response.body) {
        settle(await response.text(), isError);
        return;
      }

      // Stream tokens into the response line as they arrive.
      window.clearInterval(thinking);
      responseDiv.textContent = '';
      responseDiv.classList.toggle('text-term-muted', isError);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        responseDiv.textContent += decoder.decode(value, { stream: true });
        scrollToBottom();
      }
      if (!responseDiv.textContent) {
        settle('(no response — try asking again)', true);
      }
    } catch {
      settle('Could not reach the AI endpoint. Is the site running with its backends up?', true);
    } finally {
      window.clearInterval(thinking);
      busy = false;
      scrollToBottom();
    }
  }

  // --- Line submission -----------------------------------------------------

  function submit(raw: string): void {
    if (busy) return;
    const trimmed = raw.trim();

    if (mode === 'chat') {
      rememberLine(raw);
      if (!trimmed) return;
      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        print(trimmed, 'Back to command mode.');
        setMode('command');
        return;
      }
      void askAI(trimmed);
      return;
    }

    const result = executeCommand(raw, ctx);
    if (result.type === 'clear') {
      commandHistory!.innerHTML = '';
    } else if (result.type === 'enter-chat') {
      print(raw, result.html);
      setMode('chat');
    } else {
      print(raw, result.html);
    }
    rememberLine(raw);
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
    if (mode !== 'command') return;
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
      submit(commandInput.value);
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
