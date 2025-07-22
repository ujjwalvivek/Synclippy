// sync.js - Cross-device clipboard sync logic

export function setupSync(editor, ws, wsReady, saveNote) {
  // On Sync button click: always use textarea selection if present, else clipboard
  const syncClipboardBtn = document.getElementById('syncClipboardBtn');
  if (syncClipboardBtn) {
    syncClipboardBtn.onclick = async () => {
      let text = '';
      // Always use textarea selection if present (even if not focused)
      if (editor.selectionStart !== editor.selectionEnd) {
        text = editor.value.substring(editor.selectionStart, editor.selectionEnd);
      }
      // If no selection, fallback to clipboard
      if (!text) {
        try {
          text = await navigator.clipboard.readText();
        } catch {}
      }
      if (!text) {
        alert('Please select some text in the notepad or copy something first, then press Sync.');
        return;
      }
      if (wsReady()) {
        ws.send(JSON.stringify({ clipboard: text }));
      } else {
        alert('Not connected to server.');
      }
    };
  }

  // On PC: also send clipboard to server on Ctrl+C or Ctrl+X in textarea
  editor.addEventListener('copy', () => sendClipboardToServer(editor, ws, wsReady));
  editor.addEventListener('cut', () => sendClipboardToServer(editor, ws, wsReady));
}

export async function sendClipboardToServer(editor, ws, wsReady) {
  if (wsReady()) {
    let text = '';
    // Always use textarea selection if present (even if not focused)
    if (editor.selectionStart !== editor.selectionEnd) {
      text = editor.value.substring(editor.selectionStart, editor.selectionEnd);
    }
    if (!text) {
      try {
        text = await navigator.clipboard.readText();
      } catch {}
    }
    if (text) {
      ws.send(JSON.stringify({ clipboard: text }));
    }
  }
}

export function showRemoteClipboardOverlay(editor, value, saveNote) {
  if (document.getElementById('remoteClipboardOverlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'remoteClipboardOverlay';
  overlay.style.position = 'fixed';
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backdropFilter = 'blur(24px) saturate(150%)';
  overlay.style.zIndex = 4000;
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.innerHTML = `
    <div class="remote-clipboard-modal">
      <div class="remote-clipboard-title">Remote clipboard received. Allow?</div>
      <div class="remote-clipboard-content">${value.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
      <div class="remote-clipboard-actions">
        <button id="allowClipboardBtn" class="remote-clipboard-btn allow">Allow</button>
        <button id="denyClipboardBtn" class="remote-clipboard-btn deny">Deny</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('allowClipboardBtn').onclick = async () => {
    // Always write to clipboard
    let clipboardSuccess = false;
    try {
      await navigator.clipboard.writeText(value);
      clipboardSuccess = true;
    } catch (e) {
      clipboardSuccess = false;
    }
    // Fallback for iOS/Safari
    if (!clipboardSuccess) {
      try {
        const fallback = document.createElement('textarea');
        fallback.value = value;
        fallback.style.position = 'fixed';
        fallback.style.left = '-9999px';
        document.body.appendChild(fallback);
        fallback.select();
        document.execCommand('copy');
        document.body.removeChild(fallback);
      } catch {}
    }
    // Always append to notepad on a new line
    if (editor.value && !editor.value.endsWith('\n')) {
      editor.value += '\n';
    }
    editor.value += value;
    saveNote();
    // Auto-scroll to bottom
    editor.scrollTop = editor.scrollHeight;
    overlay.remove();
  };
  document.getElementById('denyClipboardBtn').onclick = () => {
    overlay.remove();
  };
}
