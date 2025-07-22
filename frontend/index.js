// notepad.js - Main logic for Local Notepad
import { setupSync, showRemoteClipboardOverlay } from './sync.js';

const editor = document.getElementById('editor');
const STORAGE_KEY = 'modernNotepadContent';
let lastClipboard = '';
let isOnline = true;
let ws;
let wsReady = false;
let suppressInput = false;
let suppressCursor = false;
let remoteClipboard = '';
let remoteClipboardAvailable = false;

// Load note from backend, fallback to localStorage
async function loadNote() {
  try {
    const res = await fetch('/api/note');
    if (res.ok) {
      const data = await res.json();
      editor.value = data.content || '';
      localStorage.setItem(STORAGE_KEY, data.content || '');
      isOnline = true;
    } else {
      throw new Error('Backend unavailable');
    }
  } catch {
    editor.value = localStorage.getItem(STORAGE_KEY) || '';
    isOnline = false;
  }
}

function connectWS() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  ws.onopen = () => { wsReady = true; };
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (typeof data.content === 'string') {
      suppressInput = true;
      editor.value = data.content;
      localStorage.setItem(STORAGE_KEY, data.content);
      suppressInput = false;
    }
    if (typeof data.clipboard === 'string') {
      showRemoteClipboardOverlay(editor, data.clipboard, saveNote);
    }
  };
  ws.onclose = () => { wsReady = false; setTimeout(connectWS, 2000); };
}
connectWS();

// Save note to backend, localStorage, and WebSocket
async function saveNote() {
  const content = editor.value;
  localStorage.setItem(STORAGE_KEY, content);
  if (isOnline) {
    try {
      await fetch('/api/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
    } catch {
      isOnline = false;
    }
  }
  if (wsReady && !suppressInput) {
    ws.send(JSON.stringify({ content }));
  }
}

// Initial load
loadNote();

// Auto-save on input (with suppression for remote updates)
editor.addEventListener('input', () => { if (!suppressInput) saveNote(); });

// Utility: Move caret to end of contenteditable
function moveCaretToEnd(el) {
  el.focus();
  if (typeof window.getSelection != "undefined" && typeof document.createRange != "undefined") {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

const clipboardPopup = document.getElementById('clipboardPopup');
const clipboardText = document.getElementById('clipboardText');
const insertClipboardBtn = document.getElementById('insertClipboardBtn');
const closeClipboardBtn = document.getElementById('closeClipboardBtn');

// Show clipboard popup with Allow/Deny and iOS warning
// Use command instead of toolbar button
async function showClipboardPopup(pasteAtEnd = false) {
  clipboardPopup.style.display = 'block';
  clipboardText.textContent = 'Requesting clipboard access...';
  insertClipboardBtn.textContent = 'Allow';
  insertClipboardBtn.style.display = 'inline-block';
  closeClipboardBtn.textContent = 'Fuck';
  let clipboardContent = '';
  try {
    clipboardContent = await navigator.clipboard.readText();
    clipboardText.textContent = clipboardContent || '[Clipboard is empty]';
  } catch (e) {
    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      clipboardText.textContent = '[Clipboard access denied. On iOS, clipboard access is only available in some browsers, over HTTPS, and only after a direct user gesture. Try using Chrome or Edge, or paste manually.]';
    } else {
      clipboardText.textContent = '[Clipboard access denied]';
    }
    insertClipboardBtn.style.display = 'none';
  }
  insertClipboardBtn.onclick = () => {
    if (clipboardContent && clipboardContent !== '[Clipboard is empty]' && clipboardContent !== '[Clipboard access denied]') {
      if (pasteAtEnd) {
        moveCaretToEnd(editor);
        const content = editor.value;
        if (content.length > 0 && !content.endsWith('\n')) {
          document.execCommand('insertText', false, '\n');
        }
        document.execCommand('insertText', false, clipboardContent);
      } else {
        document.execCommand('insertText', false, clipboardContent);
      }
    }
    clipboardPopup.style.display = 'none';
  };
  closeClipboardBtn.onclick = () => {
    clipboardPopup.style.display = 'none';
  };
}

// Command palette actions
const commands = [
  { name: 'Undo', shortcut: 'Ctrl+Z', action: () => { document.execCommand('undo'); } },
  { name: 'Redo', shortcut: 'Ctrl+Y', action: () => { document.execCommand('redo'); } },
  { name: 'Copy', shortcut: 'Ctrl+C', action: () => { document.execCommand('copy'); sendClipboardToServer(); } },
  { name: 'Cut', shortcut: 'Ctrl+X', action: () => { document.execCommand('cut'); sendClipboardToServer(); } },
  { name: 'Paste', shortcut: 'Ctrl+V', action: async () => {
    try {
      const text = await navigator.clipboard.readText();
      moveCaretToEnd(editor);
      const content = editor.value;
      if (content.length > 0 && !content.endsWith('\n')) {
        document.execCommand('insertText', false, '\n');
      }
      document.execCommand('insertText', false, text);
    } catch {}
  } },
  { name: 'Paste Clipboard', shortcut: '', action: async () => {
    await showClipboardPopup(true);
  } },
  { name: 'Paste Remote Clipboard', shortcut: '', action: () => {
    if (remoteClipboardAvailable && remoteClipboard) {
      moveCaretToEnd(editor);
      const content = editor.value;
      if (content.length > 0 && !content.endsWith('\n')) {
        document.execCommand('insertText', false, '\n');
      }
      document.execCommand('insertText', false, remoteClipboard);
      remoteClipboardAvailable = false;
      remoteClipboard = '';
    } else {
      alert('No remote clipboard available.');
    }
  } },
  { name: 'Reload Note', shortcut: '', action: () => loadNote() },
  { name: 'Clear Note', shortcut: '', action: () => { editor.value = ''; saveNote(); } },
];

const commandPalette = document.getElementById('commandPalette');
const commandList = document.getElementById('commandList');
let paletteOpen = false;
let filteredCommands = commands;
let selectedIdx = 0;

function openCommandPalette() {
  paletteOpen = true;
  commandPalette.style.display = 'block';
  filterCommands('');
}
function closeCommandPalette() {
  paletteOpen = false;
  commandPalette.style.display = 'none';
  editor.focus();
}
function filterCommands(query) {
  filteredCommands = commands.filter(cmd => cmd.name.toLowerCase().includes(query.toLowerCase()));
  renderCommandList();
}
function renderCommandList() {
  commandList.innerHTML = '';
  // Add divider after input
  const divider = document.createElement('div');
  divider.className = 'command-divider';
  commandList.appendChild(divider);
  filteredCommands.forEach((cmd, i) => {
    const li = document.createElement('li');
    li.textContent = cmd.name + (cmd.shortcut ? ` (${cmd.shortcut})` : '');
    li.className = i === selectedIdx ? 'selected' : '';
    li.onclick = () => { cmd.action(); closeCommandPalette(); };
    commandList.appendChild(li);
  });
}
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
    openCommandPalette();
    e.preventDefault();
  } else if (paletteOpen && e.key === 'Escape') {
    closeCommandPalette();
  }
});
// Close command palette when clicking outside
document.addEventListener('mousedown', (e) => {
  if (paletteOpen && !commandPalette.contains(e.target)) {
    closeCommandPalette();
  }
});
// Attach palette hint click handler after all functions are defined
document.querySelector('.palette-hint').onclick = openCommandPalette;
// Focus editor on load
editor.focus();

// --- Image paste support for #editor ---
editor.addEventListener('paste', async (e) => {
  if (!e.clipboardData) return;
  const items = e.clipboardData.items;
  let handled = false;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.indexOf('image') !== -1) {
      e.preventDefault();
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.onload = function(evt) {
        // Insert image at caret position as <img src="...">
        const img = document.createElement('img');
        img.src = evt.target.result;
        img.alt = 'Pasted Image';
        // Insert at caret
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          sel.getRangeAt(0).insertNode(img);
        } else {
          editor.appendChild(img);
        }
        saveNote();
      };
      reader.readAsDataURL(file);
      handled = true;
    }
  }
  // Optionally, handle pasted images from HTML (e.g. from web)
  if (!handled && e.clipboardData.types.includes('text/html')) {
    const html = e.clipboardData.getData('text/html');
    if (/<img\s/i.test(html)) {
      // Let browser handle it, but ensure images are styled by CSS
      setTimeout(saveNote, 100);
    }
  }
});

// Setup sync logic (clipboard sync, overlay, etc.)
setupSync(editor, ws, () => wsReady, saveNote);
