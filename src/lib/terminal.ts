// Terminal UI controller: a single conversation with WadoodLLM. Everything
// typed goes straight to the model (/api/chat); 'retro' is the one door out,
// 'clear' and 'exit' are quiet courtesies. No command registry — the LLM is
// the interface.

const PROMPT = 'WadoodLLM ✦';
const CHAT_ENDPOINT = '/api/chat';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// URLs and emails in an answer become real links; everything else stays
// escaped text. Email matching is safe after the URL pass because a URL's
// "@" is always preceded by "/" — no local part, no match.
function linkify(text: string): string {
  return escapeHtml(text)
    .replace(
      /\bhttps?:\/\/[^\s<>()"']+[^\s<>()"'.,;:!?]/g,
      (url) =>
        `<a href="${url}" target="_blank" rel="noopener" class="underline underline-offset-4">${url}</a>`
    )
    .replace(
      /\b[\w.+-]+@[\w-]+\.[\w.-]*\w/g,
      (addr) => `<a href="mailto:${addr}" class="underline underline-offset-4">${addr}</a>`
    );
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

  if (!commandInput || !commandHistory || !terminalContent || !typedText) {
    console.error('Terminal elements not found.');
    return;
  }

  const sessionId = newSessionId();
  const ghostHint = document.getElementById('ghost-hint');
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

  // --- Ghost hints: quiet grey suggestions at an idle prompt --------------
  // First visit whispers a question ~900ms in; after that an idle pause
  // (~7.5s) sometimes surfaces the next one — suggestions, not nagging.
  // Any keystroke dismisses instantly.

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
    scrollToBottom();
  }

  function hideHint(): void {
    ghostHint?.classList.remove('on');
  }

  function scheduleHint(delayMs = 7500, always = false): void {
    if (!ghostHint) return;
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => {
      if (busy || commandInput!.value) return;
      if (always || Math.random() < 0.65) {
        chatHintIndex = (chatHintIndex + 1) % CHAT_HINTS.length;
        showHint(CHAT_HINTS[chatHintIndex]);
      } else {
        scheduleHint();
      }
    }, delayMs);
  }

  function scrollToBottom(): void {
    terminalContent!.scrollTop = terminalContent!.scrollHeight;
  }

  function echoHtml(line: string): string {
    return `<div><span class="text-accent-gold">${PROMPT}</span> ${escapeHtml(line)}</div>`;
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
      responseDiv.innerHTML = linkify(text);
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
      let streamed = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        streamed += decoder.decode(value, { stream: true });
        responseDiv.textContent = streamed;
        scrollToBottom();
      }
      if (!streamed) {
        settle('(no response — try asking again)', true);
      } else {
        // stream is plain text while it arrives; links go live at the end
        responseDiv.innerHTML = linkify(streamed);
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
    scheduleHint();
    rememberLine(raw);
    if (!trimmed) return;

    const word = trimmed.toLowerCase();
    if (word === 'retro') {
      print(trimmed, 'As you wish. Powering down the intelligence… raising the nostalgia.');
      busy = true; // the terminal is leaving — no more input
      window.setTimeout(() => warpTo('/retro'), 700);
      return;
    }
    if (word === 'clear') {
      commandHistory!.innerHTML = '';
      return;
    }
    if (word === 'exit' || word === 'quit') {
      print(trimmed, "There is no exit — only orbit. (For the pre-AI web, type 'retro'.)");
      return;
    }
    void askAI(trimmed);
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

  commandInput.addEventListener('input', () => {
    syncTypedText();
    hideHint();
    scheduleHint();
    // typing can wrap the prompt to a new line — keep it above the fold
    scrollToBottom();
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
      // keep focus in the conversation — there is nothing to complete
      e.preventDefault();
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
    // self-recovery: if we are still here well after the navigation should
    // have happened (nav failed, or a bfcache restore resumed this timer),
    // stand the terminal back up instead of staying collapsed forever
    window.setTimeout(() => {
      page.classList.remove('term-warping');
      core?.classList.remove('flare');
      tesseract?.classList.remove('active');
      busy = false;
    }, 3600);
  }

  // The title bar X is the same door
  document.getElementById('term-close')?.addEventListener('click', (e) => {
    e.preventDefault();
    warpTo('/retro');
  });

  // Back/forward cache: pressing Back from /retro restores this page
  // exactly as it left — mid-warp, collapsed, input locked. Cleanup runs on
  // every pageshow (not just persisted) — it is idempotent, and browsers
  // differ on which restore path they take.
  window.addEventListener('pageshow', () => {
    document.getElementById('term-page')?.classList.remove('term-warping');
    document.getElementById('warp-core')?.classList.remove('flare');
    document.getElementById('warp-tesseract')?.classList.remove('active');
    sessionStorage.removeItem('orbit-nav');
    sessionStorage.removeItem('orbit-warp-in');
    busy = false;
    focusInput();
    hideHint();
    // pageshow fires on first load too (after init), so this IS the
    // first-visit hint: a quiet opening line ~900ms in, guaranteed.
    scheduleHint(900, true);
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
