# Fundleaf mobile design

Fundleaf reads like a monthly statement supported by a ledger. Home leads with the month’s financial position and daily activity. Transactions use date-grouped rows. Budgets put remaining money and exceptions in view. Profile uses plain settings groups.

## Foundations

| Role             | Light     | Dark      |
| ---------------- | --------- | --------- |
| Canvas           | `#F7F8F4` | `#121212` |
| Primary surface  | `#FFFFFF` | `#1E1E1E` |
| Field            | `#EEF0EA` | `#202020` |
| Sheet            | `#FFFFFF` | `#242424` |
| Main text        | `#191E19` | `#F6F6F4` |
| Secondary text   | `#575F56` | `#AEAFAB` |
| Primary action   | `#274D35` | `#BCE8A1` |
| Selected surface | `#E0ECD9` | `#29382A` |
| Danger           | `#A22C22` | `#FFB4AB` |
| Warning          | `#805600` | `#F1CE87` |

`constants/ThemePalettes.ts` owns color, typography, spacing and motion roles. Appearance follows the saved System, Light or Dark preference. The dark canvas, lists and sheets use neutral charcoal. Reserve green for interaction, income, and the main chart series. Pair warning and danger with words and signed values.

Use native system typography. Screen titles are 27, section titles 19, labels and body 15, captions 13, ledger amounts 16, and primary totals 38. Use 600 for controls and 700 for headings. Let important values and labels wrap when text is enlarged.

Use 4, 8, 16, 24, 32 and 48 dp spacing. Page gutters are 16 dp, and major sections are 24 dp apart. Use 10 dp corners for controls, 16 for surfaces, and 22 for sheets. The floating navigation dock uses a pill silhouette. Hairlines separate ledger rows, and flat backgrounds group settings. Keep depth limited to the navigation dock.

## Data and interaction

- Format values through the existing currency formatter. Use tabular digits, right-align ledger values, and keep original-currency references below converted values. Preserve the signs of expenses, income, credits and amounts over budget.
- Use the report’s daily net spending series on Home. Show a zero baseline and distinguish net credits from spending. Category progress tracks clamp their fill at 100% and retain the actual percentage in their accessibility text.
- Position the primary create action in the screen controls, above the ledger or budget list. Use solid fill for primary actions, quiet fill for secondary actions, and a danger treatment for destructive confirmation. Show progress inside submitting controls and keep form values visible.
- Keep the floating dock in the navigator layout above the system safe area. The active tab has a visible label and selected state. Haptics accompany a successful tab change.
- Use native sheet gestures, inset-aware scroll content, a visible close action, and existing dismissal protection for dirty or saving forms. Month changes commit after the picker settles.
- Give frequent controls immediate opacity or fill feedback. The dock animates its selected width over 200 ms with system reduced-motion handling. Use native easing for sheet gestures so dragging stays responsive. Static skeletons and progress tracks convey status without repeated motion.
- Use 48 dp minimum touch targets for primary controls, accessible names for icon-only actions, and live regions for status feedback. Permit line wrapping, safe-area insets and keyboard-aware scrolling. Normal text pairs meet 4.5:1 contrast.
