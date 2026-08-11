// NoteZ Save-to-NoteZ extension popup
// Authenticates against the same Supabase session as the web app.
// Uses the stored JWT from localStorage (same origin as the NoteZ app).

const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"; // replace at build time
const NOTEZ_ORIGIN = "https://notez.app";               // replace with real domain

async function getSession() {
  // Ask the NoteZ tab for the Supabase session via scripting
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Look for Supabase session in localStorage under any sb- key
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
            try { return JSON.parse(localStorage.getItem(k)); } catch {}
          }
        }
        return null;
      },
    });
    return result?.result ?? null;
  } catch { return null; }
}

async function getStoredSession() {
  return new Promise(resolve => {
    chrome.storage.local.get(["sb_session"], r => resolve(r.sb_session ?? null));
  });
}

async function resolveToken() {
  // 1. Try active NoteZ tab
  const [tab] = await chrome.tabs.query({ url: NOTEZ_ORIGIN + "/*" });
  if (tab?.id) {
    try {
      const [r] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k?.startsWith("sb-") && k.endsWith("-auth-token")) {
              try {
                const d = JSON.parse(localStorage.getItem(k));
                return d?.access_token ?? null;
              } catch {}
            }
          }
          return null;
        },
      });
      if (r?.result) return r.result;
    } catch {}
  }
  // 2. Fall back to locally stored token
  const stored = await getStoredSession();
  return stored?.access_token ?? null;
}

async function loadFolders(token) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/folders?select=id,name&order=created_at.desc`, {
    headers: {
      apikey: "YOUR_ANON_KEY", // replace at build time
      Authorization: `Bearer ${token}`,
    },
  });
  if (!r.ok) return [];
  return r.json();
}

async function clipPage(token, folderId, title, url) {
  // Create a sources record and trigger process-source
  const sourceRes = await fetch(`${SUPABASE_URL}/rest/v1/sources`, {
    method: "POST",
    headers: {
      apikey: "YOUR_ANON_KEY",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      title: title.slice(0, 200) || url.slice(0, 200),
      kind: "url",
      source_url: url,
      status: "pending",
      user_id: null, // set server-side via RLS
    }),
  });
  if (!sourceRes.ok) throw new Error("Could not create source");
  const [source] = await sourceRes.json();

  // Trigger process-source edge function
  await fetch(`${SUPABASE_URL}/functions/v1/process-source`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sourceId: source.id }),
  });

  return source;
}

document.addEventListener("DOMContentLoaded", async () => {
  const main       = document.getElementById("main");
  const authNotice = document.getElementById("auth-notice");
  const folderSel  = document.getElementById("folder-select");
  const titleInput = document.getElementById("title-input");
  const clipBtn    = document.getElementById("clip-btn");
  const status     = document.getElementById("status");

  const token = await resolveToken();
  if (!token) { authNotice.style.display = "block"; return; }
  main.style.display = "block";

  // Pre-fill title from active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.title) titleInput.value = tab.title.slice(0, 120);

  // Load folders
  const folders = await loadFolders(token);
  folders.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f.id; opt.textContent = f.name;
    folderSel.appendChild(opt);
  });

  clipBtn.addEventListener("click", async () => {
    if (!tab?.url) return;
    clipBtn.disabled = true;
    status.textContent = "Saving…"; status.className = "msg";
    try {
      await clipPage(token, folderSel.value || null, titleInput.value, tab.url);
      status.textContent = "✓ Saved — processing in NoteZ"; status.className = "msg ok";
    } catch (e) {
      status.textContent = e.message || "Failed — try again"; status.className = "msg err";
    } finally {
      clipBtn.disabled = false;
    }
  });
});
