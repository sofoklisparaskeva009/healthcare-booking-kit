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

- Keep appointment categories and optional private fees in the shared booking module; validate the category and derive fees server-side so submitted quotes cannot be tampered with.
- Persist appointment type and nullable private fee separately; the legacy price column is compatibility-only and must not imply free care.
