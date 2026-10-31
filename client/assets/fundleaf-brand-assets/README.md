# Fundleaf brand assets

Brand: **Fundleaf**  
Tagline: **Your money, your control.**

## Ready-to-use assets

| File | Purpose |
|---|---|
| `app-icon.png` | Primary 1024 × 1024 iOS / Expo app icon |
| `app-icon-light.png` / `app-icon-dark.png` | Alternate icon colorways |
| `adaptive-icon-foreground.png` | Android adaptive foreground, transparent safe-area mark |
| `adaptive-icon-background.png` | Android adaptive background (solid emerald) |
| `adaptive-icon-monochrome.png` | Optional Android themed monochrome foreground |
| `splash-mark.png` | Transparent square mark for Expo splash image |
| `splash-fullscreen-light.png` / `splash-fullscreen-dark.png` | 1242 × 2688 full-screen splash artwork / visual references |
| `logo-horizontal-light.png` / `logo-horizontal-dark.png` | Transparent wordmark + tagline |
| `logo-mark.svg` | Scalable primary symbol |

Each graphic also has an editable SVG version. The SVG files reference system font family names; PNGs have the type rendered into the image.

## Expo configuration example

In your Expo app config, use the icon and transparent mark rather than treating the full-screen poster as `splash.image` (which Expo scales differently on different screen sizes):

```json
{
  "expo": {
    "name": "Fundleaf",
    "icon": "./assets/branding/app-icon.png",
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/branding/adaptive-icon-foreground.png",
        "backgroundImage": "./assets/branding/adaptive-icon-background.png",
        "monochromeImage": "./assets/branding/adaptive-icon-monochrome.png"
      }
    },
    "plugins": [
      ["expo-splash-screen", {
        "image": "./assets/branding/splash-mark.png",
        "imageWidth": 220,
        "resizeMode": "contain",
        "backgroundColor": "#F8FCF9",
        "dark": {"image": "./assets/branding/splash-mark.png", "backgroundColor": "#002F29"}
      }]
    ]
  }
}
```

Merge only the relevant keys into your **existing config**, preserving other settings such as app identifiers, deep links and plugins. The full-screen splash PNGs are standalone designs; using them as native splash screen images may crop or scale unexpectedly. Expo app icon changes generally require a new native build to appear on devices.

## Brand colors

- Deep emerald `#002F29`
- Brand emerald `#07483A`
- Green `#26B44A`
- Lime `#A8EB62`
- Off-white `#F8FCF9`
