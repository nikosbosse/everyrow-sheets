# Marketplace Assets

This directory contains assets for the Google Workspace Marketplace listing.

## Required Assets

| Asset | Size | File | Status |
|-------|------|------|--------|
| App Icon | 128x128 PNG | `icon-128x128.svg` | Ready to export |
| Banner | 440x280 PNG | `banner-440x280.svg` | Ready to export |
| Screenshot 1 | 1280x800 PNG | `screenshot-1-rank-1280x800.svg` | Ready to export |
| Screenshot 2 | 1280x800 PNG | `screenshot-2-screen-1280x800.svg` | Ready to export |

## Exporting to PNG

### Using a browser

1. Open any SVG file in a web browser
2. Right-click → "Save image as..." (some browsers support this)
3. Or use browser dev tools to screenshot at exact dimensions

### Using Inkscape (recommended)

```bash
# Install Inkscape
brew install inkscape

# Export icon
inkscape assets/icon-128x128.svg --export-filename=assets/icon-128x128.png --export-width=128 --export-height=128

# Export banner
inkscape assets/banner-440x280.svg --export-filename=assets/banner-440x280.png --export-width=440 --export-height=280

# Export screenshots
inkscape assets/screenshot-1-rank-1280x800.svg --export-filename=assets/screenshot-1-rank-1280x800.png --export-width=1280 --export-height=800
inkscape assets/screenshot-2-screen-1280x800.svg --export-filename=assets/screenshot-2-screen-1280x800.png --export-width=1280 --export-height=800
```

### Using ImageMagick

```bash
# Install ImageMagick
brew install imagemagick

# Convert all SVGs to PNG
for f in assets/*.svg; do
  convert -background none "$f" "${f%.svg}.png"
done
```

### Using Figma/Sketch

1. Import the SVG files
2. Export as PNG at the required dimensions

## Asset Guidelines

### Icon (128x128)
- Should be recognizable at small sizes
- Use simple shapes and bold colors
- Represents the everyrow brand

### Banner (440x280)
- Hero image shown in marketplace listing
- Should convey the product's value proposition
- Include product name and key features

### Screenshots (1280x800)
- Show the add-on in action within Google Sheets
- Highlight different features (Rank, Screen, etc.)
- Use realistic sample data
- 1-5 screenshots allowed

## Customization

Feel free to modify the SVG files to:
- Update colors to match brand guidelines
- Change sample data to be more relevant
- Add additional screenshots for other features (Dedupe, Merge, Agent)
