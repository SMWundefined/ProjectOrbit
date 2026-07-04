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
  const ghostHint = document.getElementById('ghost-hint');
  let mode: 'command' | 'chat' = 'command';
  let busy = false;
  let ranHelp = false;

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

  // --- Ghost hints: quiet grey suggestions at an idle prompt --------------
  // First visit whispers "type help"; after that, an idle pause (~6-8s)
  // may surface what to try next — command mode points at ai-chat, chat
  // mode rotates real questions. Any keystroke dismisses instantly.

  const CHAT_HINTS = [
    'ask: what is Wadood reading right now?',
    'ask: is Wadood working on AI?',
    'ask: what does he do at Meta?',
    "ask: what's his chess rating?",
    'ask: who does he look up to?',
    'ask: what is he building these days?',
  ];
  let chatHintIndex = Math.floor(Math.random() * CHAT_HINTS.length);
  let hintTimer = 0;

  function showHint(text: string): void {
    if (!ghostHint) return;
    ghostHint.textContent = `  ${text}`;
    ghostHint.classList.add('on');
  }

  function hideHint(): void {
    ghostHint?.classList.remove('on');
  }

  function scheduleHint(delayMs?: number): void {
    if (!ghostHint) return;
    window.clearTimeout(hintTimer);
    const delay = delayMs ?? (mode === 'chat' ? 7500 : 6000);
    hintTimer = window.setTimeout(() => {
      if (busy || commandInput!.value) return;
      if (mode === 'command') {
        showHint(ranHelp ? 'try ai-chat' : 'type help');
      } else if (Math.random() < 0.65) {
        // chat prompts only sometimes get a hint — suggestions, not nagging
        chatHintIndex = (chatHintIndex + 1) % CHAT_HINTS.length;
        showHint(CHAT_HINTS[chatHintIndex]);
      } else {
        scheduleHint();
        return;
      }
    }, delay);
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
    hideHint();
    scheduleHint(chat ? 5000 : undefined);
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
      scheduleHint();
    }
  }

  // --- Line submission -----------------------------------------------------

  function submit(raw: string): void {
    if (busy) return;
    const trimmed = raw.trim();
    hideHint();
    if (trimmed.toLowerCase() === 'help') ranHelp = true;
    scheduleHint();

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
    } else if (result.type === 'navigate') {
      print(raw, result.html);
      busy = true; // the terminal is leaving — no more input
      window.setTimeout(() => warpTo(result.href), result.delayMs);
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

  commandInput.addEventListener('input', () => {
    syncTypedText();
    hideHint();
    scheduleHint();
  });

  commandInput.addEventListener('keydown', (e) => {
    hideHint();
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

  // Wormhole exit to the classic site: the page collapses into a gravity
  // well at center screen while the singularity flares, then navigates.
  function warpTo(href: string): void {
    const page = document.getElementById('term-page');
    const core = document.getElementById('warp-core');
    const tesseract = document.getElementById('warp-tesseract');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // the retro side picks these up for its matching expand-in
    sessionStorage.setItem('orbit-nav', '1');
    sessionStorage.setItem('orbit-warp-in', '1');
    if (reducedMotion || !page) {
      location.assign(href);
      return;
    }
    // one arc: the world collapses into the corona; the corona holds a
    // beat, then expands — and its light unfolds into the tesseract
    // strands that carry you out the other side
    page.classList.add('term-warping');
    core?.classList.add('flare');
    window.setTimeout(() => tesseract?.classList.add('active'), 820);
    window.setTimeout(() => location.assign(href), 2050);
  }

  // The title bar X is the same door
  document.getElementById('term-close')?.addEventListener('click', (e) => {
    e.preventDefault();
    warpTo('/retro');
  });

  // Back/forward cache: pressing Back from /retro restores this page
  // exactly as it left — mid-warp, collapsed, input locked. pageshow with
  // persisted=true is the only signal; undo the warp and hand back the prompt.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    document.getElementById('term-page')?.classList.remove('term-warping');
    document.getElementById('warp-core')?.classList.remove('flare');
    document.getElementById('warp-tesseract')?.classList.remove('active');
    sessionStorage.removeItem('orbit-nav');
    sessionStorage.removeItem('orbit-warp-in');
    busy = false;
    focusInput();
    hideHint();
    scheduleHint();
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

  // First visit: a quiet nudge toward the door.
  scheduleHint(900);

  // --- Virtual keyboard: never let it hide the prompt --------------------
  // iOS Safari only shrinks the *visual* viewport when the keyboard rises;
  // the layout (and the h-dvh window) stays full height, so the keyboard
  // covers the bottom half. Worse, #term-page centers the window, so just
  // shrinking it re-centers it half under the keyboard anyway. The fix:
  // size the window to the visual viewport AND pin it to the visible top,
  // tracking offsetTop because iOS scrolls the layout viewport on focus.
  const vv = window.visualViewport;
  if (vv && terminalWindow && matchMedia('(pointer: coarse)').matches) {
    // high-water mark of the viewport height = "no keyboard" baseline;
    // reset on rotate so landscape isn't judged against portrait
    let tallest = 0;
    const fitToViewport = () => {
      tallest = Math.max(tallest, vv.height);
      const keyboardUp = tallest - vv.height > 120;
      if (keyboardUp) {
        terminalWindow.style.height = `${vv.height}px`;
        terminalWindow.style.alignSelf = 'flex-start';
        terminalWindow.style.transform = `translateY(${vv.offsetTop}px)`;
      } else {
        terminalWindow.style.height = '';
        terminalWindow.style.alignSelf = '';
        terminalWindow.style.transform = '';
      }
      scrollToBottom();
    };
    vv.addEventListener('resize', fitToViewport);
    vv.addEventListener('scroll', fitToViewport);
    window.addEventListener('orientationchange', () => {
      tallest = 0;
      window.setTimeout(fitToViewport, 300);
    });
    // focusing the input raises the keyboard; re-fit once it settles
    commandInput.addEventListener('focus', () => window.setTimeout(fitToViewport, 350));
    fitToViewport();
  }
}
