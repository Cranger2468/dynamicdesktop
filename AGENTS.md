<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the web preview on TanStack Start and reuse its island experience in the isolated Electron renderer; this preserves Lovable deployment while packaging an offline desktop app.
- Keep all privileged desktop operations in Electron main with a narrow context-isolated preload bridge; the renderer never receives Node access.
- Persist desktop utility preferences locally for offline startup, with no Cloud dependency, because this app is a standalone macOS utility.
- Use a separate relative-base Electron Vite configuration and desktop packaging scripts; the website build must not be changed into a file-protocol app.
- Pin Electron to the 38.x line (never ^39+): Electron 39 / Chromium 142 dropped macOS 12, and the Intel download must keep running on macOS 12 Monterey.
