---
name: universal-navigation
description: Preserve Seatbelt's shared back navigation, footer, bottom-navigation exceptions and Driver/Rider feed behavior when adding or changing project routes.
---

# Universal Navigation

Use this project-local skill when adding or changing Seatbelt routes or session-mode navigation. Preserve explicit user changes to these requirements.

Read `src/components/AppChrome.tsx`, `src/components/AccountPage.tsx`, `src/app/layout.tsx` and the affected route before editing. Read the relevant installed Next.js guides in `node_modules/next/dist/docs/`; do not assume an older routing API.

- Reuse `AccountPage` for application and settings screens. Its back control uses shared navigation history and returns Home when no previous application route is known. Avoid a second back control in AppChrome for those screens.
- Keep one shared footer through the root layout. Use established CSS variables, spacing, buttons and loading/error states rather than a new page shell.
- Keep bottom navigation on standard application screens. Hide it within Settings and informational/legal screens; changing an exception requires the user's requested functional difference.
- Keep session mode on the server-owned account/profile contract. Rider mode browses Driver posts; Driver mode browses Rider requests. Driver capability alone does not establish identity, eligibility, completed onboarding or an active account.
- Use protected APIs for posts, offers, messages and histories. Never reintroduce browser writes to trips/messages or public recurring-route discovery.
- Clear private screen state when the signed-in account changes. UI guards complement server authorization and RLS; they do not replace them.

When verification is authorized, inspect back behavior after direct entry and in-app navigation, both session modes, Settings/informational exceptions, keyboard access, and mobile/desktop footer/navigation placement. Record untested states honestly. The skill does not authorize provider activation, live migrations, Git staging, commits, pushes or changes to external workspace instructions.
