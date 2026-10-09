# ChatGPT-inspired UI redesign
- [x] Shared AppDrawer with search, chat actions and floating navigation
- [x] Main chat screen and conversation presentation; preserve composer
- [x] Pure black/white theme backgrounds and main text
- [x] Verify navigation, conversations and light/dark layouts
- [x] Refine main screen, drawer and conversation to closely match uploaded references without restyling the chat input
- [x] Verify the refined screens and navigation in dark/light themes and narrow/wide layouts
- [x] Apply a consistent compact size scale to oversized app elements, preserving the chat input
- [x] Verify compact screens, navigation and conversation on narrow/wide layouts

# Vision premium upgrade
- [x] Rename visible app branding and page metadata to Vision; preserve established support contact addresses
- [x] Apply the guide’s glass surface system, buttons, fields, overlays and readable light/dark themes across the entire app
- [x] Refine chat, drawer, account/settings, tools, auth and admin while preserving existing behavior and compact sizing
- [x] Verify navigation, chat controls, forms, major screens, theme contrast and narrow/wide layouts
- Verification limitation: sending renders the conversation, but the existing AI endpoint returns HTML instead of JSON; AI replies remain unavailable with the local backend. UI navigation and profile persistence passed, with four regression tests passing.