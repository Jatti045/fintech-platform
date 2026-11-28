# Fundleaf mobile interface

Fundleaf helps people see where their monthly income went, find individual transactions, and plan what they can still spend. The interface pairs quiet, instrument-like typography with a cash flow diagram that ties the monthly numbers together.

## Color and type

Cobalt is the default color scheme. Iris and Fern can be selected under Profile → Appearance. Each scheme has a light and dark version and follows the System, Light, or Dark preference independently. Positive income, warning, and danger colors have the same meanings in every scheme.

| Role            | Light     | Dark      |
| --------------- | --------- | --------- |
| Canvas          | `#F5F6FA` | `#141416` |
| Primary surface | `#FFFFFF` | `#1C1D21` |
| Main text       | `#171B2A` | `#F5F5FA` |
| Secondary text  | `#565E72` | `#B4B5C1` |
| Cobalt accent   | `#2948CB` | `#AABFFF` |
| Iris accent     | `#6541AC` | `#D7BDFF` |
| Fern accent     | `#146653` | `#93DECA` |
| Danger          | `#AA3449` | `#FFADB8` |

`constants/ThemePalettes.ts` owns these roles, including the corresponding on-accent, selected, and statement colors. Keep accent color in the spending ribbon, primary actions, and selection. Let neutral surfaces, alignment, and typography distinguish other content. Normal text pairs pass 4.5:1 contrast in all six combinations.

DM Sans semibold sets the screen headings and large totals. System text supplies labels, reading copy, and controls. Ledgers use tabular digits and right-align amounts. Protect full values at large text sizes and keep source-currency details below the converted amount.

Use 20 dp page gutters, a 4 dp spacing grid, 48 dp touch targets, and hairlines to separate dense rows. Shapes are 14 dp for fields and buttons, 22 dp for cards, and 28 dp for sheets. The floating navigation uses a pill and a single moving selection marker.

## Screen and interaction decisions

- Home separates the monthly income total, the tap-selectable cash flow ribbons, and Monthly details. Ribbons show the share of income spent and left. Overspending and net credits use explicit amounts and context. Monthly details retain the daily spending trend, and the budget preview starts collapsed.
- The same reporting-month button opens a sheet on all three financial screens. The sheet supports previous/next, jump to current month, and swipe. A swipe commits the reporting period after settling.
- Transaction search and creation share one row, with filters alongside the ledger. The category picker uses categories from transactions in the selected reporting month. Keep the virtualized list and original-currency references.
- Budget creation and month setup share a toolbar. Keep the remaining figure, progress, and signed category balances in view. Category expansion exposes existing row actions.
- Profile groups appearance and the color scheme separately from reporting currency and bank settings.

## Motion

| Before                                                    | After                                                      | Reason                                                              |
| --------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| Selected tab grows and moves adjacent tabs                | Fixed touch targets with one 195 ms translated indicator   | Keeps the entire navigation predictable during repeated tab changes |
| Button feedback relies on opacity                         | A short, interruptible 0.97-scale press and 150 ms release | Confirms the touch while keeping the action immediate               |
| Swipe-to-delete animates the icon through legacy Animated | The native Reanimated gesture moves the row                | Keeps row movement responsive while the ledger renders              |
| Sheet physics vary with platform defaults                 | One damped, non-bouncing spring with system reduced motion | Gives the sheet a consistent response to release and dismissal      |

`constants/Motion.ts` owns interaction timings. A tap traces the selected cash flow ribbon in 390 ms. Busy states share a leaf-outline loader that turns static under reduced motion. Keep frequent screen transitions quiet. With system reduced motion, skip button scale, snap the tab indicator, and disable sheet travel. Preserve keyboard, safe-area, back, and unsaved-draft behavior.
