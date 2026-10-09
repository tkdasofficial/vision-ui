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

- Page UIs live in `src/views/`; each `src/routes/*` file only wraps a view (and `<Protected>` for signed-in pages). Why: keeps ported screens separate from routing.
- Views navigate via `@/lib/router-compat` (thin adapter over TanStack Router). Why: lets ported code keep simple `navigate(path)` calls; never reintroduce react-router-dom.
- Backend is browser-only: `src/backend/` (localStorage tables + local auth) exposes a Supabase-shaped `supabase` object so views keep their query code. Why: user chose no online backend; AI/edge features return an "unavailable" error.
- The chat composer uses AI Elements PromptInput primitives; its existing file-routing callbacks remain separate from the primitive's attachment collection. Why: preserves ZIP/conversion behavior while sharing accessible input and submission controls.
- Speech text is joined through the browser-safe appendTranscript helper, with regression tests alongside existing tests. Why: preserves typed text and whitespace across recognition updates without coupling transcription to a service.
- Chat navigation uses a single controlled AppDrawer on all screen sizes. Why: keeps search, history and chat actions consistent with accessible dismissible navigation.
- Drawer overlays support a scoped overlayClassName and retain a visible strip of the chat page. Why: screenshot-matched navigation must not change overlays used by other screens.
- Conversation layout and message markdown use AI Elements primitives, with existing domain result cards retained. Why: shares accessible transcript, scrolling and message controls without changing offline tool behavior.
- Shared compact sizing roles are defined as Tailwind theme tokens and used by chat navigation, drawer, profile and conversation controls; the composer retains its independent sizing. Why: keeps density consistent without changing the protected input appearance.
- The premium glass surface system is centralized in global semantic tokens and role utilities, with a body theme covering ported views and portals; native ported buttons use Button's layout-preserving legacy variant. Why: upgrades every screen consistently while preserving handlers and custom tool geometry.
