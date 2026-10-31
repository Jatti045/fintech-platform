# Fundleaf overlay audit

## Converted

| Interface | Implementation | Dismissal and state |
| --- | --- | --- |
| Home Help & Usage | `informationModal.tsx` | Shared scrolling sheet, swipe/backdrop/Back/accessible handle |
| Transaction create/edit and inline details | `TxModal.tsx` | Existing fields, date controls and mutations; user edits require discard confirmation; busy saves block dismissal |
| Transaction currency picker | `TxModal.tsx` | Sheet stacked above the transaction draft; selection retains the parent form |
| Transaction category filter | `TxFilterOpt.tsx` | Shared scrolling sheet; selection applies the original filter |
| Budget create/edit | `BudgetModal.tsx` | Existing validation and mutations; changed fields require discard confirmation; busy saves block dismissal |
| Smart Month Setup / inherited limits / suggested allocations | `MonthSetupModal.tsx` | Existing suggestion selection/apply logic; modified selections or amounts require discard confirmation |
| Profile default currency | `CurrencyPickerModal.tsx` | Shared scrolling sheet; original preference action |

No separate Home financial-summary, recurring-bill, month-picker, appearance or notification-preference modal exists. Those are inline controls or expandable cards and remain so.

## Deliberately retained

| Interface | Reason |
| --- | --- |
| `themedAlert.tsx` | Critical delete/logout/disconnect confirmations, validation/error alerts, and unsaved-work confirmation require explicit decisions. This dialog also appears above sheet portals. |
| Forgot Password / OTP / Reset Password | Security-sensitive linked recovery flow; OTP and reset already require confirmation before exit. Keep their existing validation, token and close behavior. |
| Profile Change Password | Security-sensitive credential entry, with existing explicit Cancel and busy protection. |
| AI privacy disclosure | Explicit external-processing consent; retain accept/keep-disabled decision and disclosure content. |
| Notification onboarding | One-time permission choice; accidental dragging must not persist an unintended decline. |
| `PostConnectionDialog.tsx` | Explicit acknowledgement of a completed bank connection and background syncing. |
| `PlaidLinkConnectedDialog.tsx` | Legacy, currently unused acknowledgement component; no reason to migrate an unused interface. |
| Transaction rules manager | Full-screen multi-stage editor, preview/apply/history/undo workflow; reducing it to a nested sheet would crowd a complex flow. |
| Native date picker, image picker, Plaid Link, device permission prompts, native alerts | Platform-owned interactions retain native behavior. |
| Loader, persistent Plaid banners, app error boundary | Blocking progress, persistent status, or full-screen recovery; not dismissible dialogs. |

No navigation-based modal routes were found. Category selection within transaction forms remains inline.

## Shared architecture

`FundleafSheet` uses `@gorhom/bottom-sheet` 5.2.14 with the existing Expo 54 / React Native 0.81.5 / Reanimated 4.1 / Gesture Handler 2.28 stack. A single `BottomSheetModalProvider` sits under the existing gesture root and alert provider. Nested sheets use push stacking, and only the top active sheet consumes Android Back. Unmounting unregisters Back handlers and dismisses portal content.

All sheets share themed surfaces, backdrop and handle tokens, rounded corners, titles, safe-area padding, capped dynamic sizing and `BottomSheetScrollView`. `BrandInput` selects `BottomSheetTextInput` inside the sheet context; ordinary screens retain React Native inputs. Horizontal controls use Gesture Handler's ScrollView. No custom pan recognizers were added.

`useSheetDismiss` routes Cancel, backdrop, accessible handle dismissal, and Back through the same unsaved-work confirmation. Dirty sheets disable pan-to-close so a gesture cannot destroy a draft before a decision; Keep editing preserves inputs. Clean sheets support swipe-down dismissal. Busy forms block dismissal. Successful mutations close directly using their original callbacks. Authentication, financial calculations, APIs and persistence are unchanged.

## Verification boundaries

Component tests mock the native animation/gesture engine: they verify presentation lifecycle, dismissal callbacks, top-sheet Back routing, busy guards, dirty-state confirmation and cleanup, along with existing form/filter/mutation tests. Web previews exercised real Gorhom opening/reopening, pointer drag dismissal, backdrop taps, editable inputs, keep/discard decisions, nested currency selection with draft preservation, internal scrolling at 320px, and light/dark rendering. The initial presentation and backdrop behavior were corrected based on these checks. These checks do not establish native iOS/Android gesture, hardware-Back, software-keyboard, VoiceOver/TalkBack, or physical-device behavior. Those still require device testing.

Sources consulted: [Gorhom props](https://gorhom.dev/react-native-bottom-sheet/props), [keyboard handling](https://gorhom.dev/react-native-bottom-sheet/keyboard-handling), and the installed package's peer dependencies and source. Required native dependencies were already installed; no Expo or React Native upgrades were made.
