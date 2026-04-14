# UI/UX Full Redesign - NetPulse NMS

## Goal
전체 UI/UX를 현대적인 NOC/NMS 대시보드 스타일로 완전히 리디자인. 다크 테마 중심, 생동감 있는 컬러 시스템, 시각적 위계, 마이크로 인터랙션 추가.

## Design Direction
- Dark-first NOC aesthetic with vibrant status colors
- Glass-morphism cards with subtle borders and gradients
- Proper color system: emerald=healthy, red=critical, amber=warning, blue=info, violet=AI
- Better typography scale (stop using 10px everywhere)
- Smooth transitions and hover states
- Professional sidebar with active indicators and section dividers

## TODOs

- [x] T1: Color System & Theme Overhaul — Redesign `globals.css` CSS variables for both light/dark themes. Add new semantic color tokens (success, warning, info, chart-1 through chart-5). Make dark theme richer with deeper blues and proper contrast. Add utility classes for glass effects, gradients, glow.

- [x] T2: App Shell Redesign — Completely redesign `app-shell.tsx`. Modern sidebar with gradient active indicator, better section headers, animated collapse, polished header bar with better notification popover and user menu. Improve mobile drawer.

- [x] T3: Login & Auth Pages Redesign — Redesign `auth/login/page.tsx`, `auth/invite/page.tsx`, `setup/page.tsx`. Add animated background, better brand panel, polished form cards with proper focus states and transitions.

- [x] T4: Dashboard Page Redesign — Complete overhaul of `dashboard/page.tsx`. Colorful stat cards with gradients and icons, better chart styling with vibrant colors, improved alert list with severity colors, better skeleton loading states. Make it look like a proper NOC dashboard.

- [x] T5: Devices Pages Redesign — Redesign `devices/page.tsx` and `devices/[id]/page.tsx`. Better table styling, colorful status indicators, improved card view, polished metric charts with proper colors, better modals using Dialog component.

- [x] T6: Incidents Pages Redesign — Redesign `incidents/page.tsx` and `incidents/[id]/page.tsx`. Severity-colored cards, better timeline visualization, improved chat UI, polished RCA display, better filter controls.

- [x] T7: Remaining Pages Redesign — Redesign `topology/page.tsx`, `maps/page.tsx`, `reports/page.tsx`, `users/page.tsx`, `ai/page.tsx`, `settings/page.tsx`. Consistent styling across all pages, better empty states, improved tables and forms.

## Parallelization
- T1 must go first (foundation)
- T2 can follow T1 (depends on new theme tokens)
- T3 can run parallel with T2 (independent pages)
- T4 depends on T1 (uses new color tokens)
- T5, T6 depend on T1
- T7 depends on T1

## Final Verification Wave

- [x] F1: Oracle Review — Verify all pages use consistent design language, proper color system, no broken layouts
- [x] F2: Build Verification — `yarn build` passes with zero errors
- [x] F3: Visual QA — Browser check of all pages for visual consistency and responsiveness
