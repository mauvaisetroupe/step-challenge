#!/usr/bin/env python3
"""
Exports the app icons of apps/mobile from icons/app-icon-foreground.svg.

Usage (from the repository root):

    python3 icons/export-app-icons.py

Requires Inkscape (https://inkscape.org). The Inkscape binary is looked up
in $INKSCAPE, then in PATH, then in the default macOS location.

Generated files (apps/mobile/assets/images):

- android-icon-foreground.png  adaptive icon foreground (transparent)
- android-icon-background.png  adaptive icon background (plain colour)
- android-icon-monochrome.png  themed icon (Android 13+): white on transparent
- icon.png                     generic app icon (foreground on background)
- splash-icon.png              splash screen image (foreground, transparent)
- favicon.png                  web favicon

And, outside the app (icons/):

- playstore-icon.png           Google Play listing icon (512 x 512, opaque);
                               upload it in the Play Console with the next
                               release that changes the launcher icon
- feature-graphic.png          Google Play feature graphic (1024 x 500,
                               opaque), from icons/feature-graphic.svg

Keep BACKGROUND in sync with app.json (android.adaptiveIcon.backgroundColor
and the expo-splash-screen backgroundColor).
"""

import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

BACKGROUND = '#1389FC'

# Enlargement of the drawing in icon.png and favicon.png.
ICON_ZOOM = 1.6

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'icons' / 'app-icon-foreground.svg'
OUTPUT = ROOT / 'apps' / 'mobile' / 'assets' / 'images'
STORE_OUTPUT = ROOT / 'icons'


def find_inkscape():
    candidates = [
        os.environ.get('INKSCAPE'),
        shutil.which('inkscape'),
        '/Applications/Inkscape.app/Contents/MacOS/inkscape',
    ]

    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate

    sys.exit('Inkscape not found: install it or set $INKSCAPE.')


def export(inkscape, svg_path, png_path, width, opaque=False):
    command = [
        inkscape,
        str(svg_path),
        '--export-type=png',
        f'--export-filename={png_path}',
        f'--export-width={width}',
    ]

    if opaque:
        # No alpha channel at all (Google Play listing icon).
        command.append('--export-png-color-mode=RGB_8')

    subprocess.run(command, check=True, capture_output=True)
    print(f'  {png_path.relative_to(ROOT)}')


def with_background(svg, zoom=1.0):
    """
    Returns the SVG with a full-canvas background rectangle, the drawing
    enlarged by `zoom` around the centre of the canvas.
    """
    opening = (
        f'<rect width="1024" height="1024" fill="{BACKGROUND}"/>'
        f'<g transform="translate(512,512) scale({zoom}) translate(-512,-512)">'
    )
    svg = re.sub(r'(<svg\b[^>]*>)', lambda m: m.group(1) + opening, svg, count=1)
    return svg.replace('</svg>', '</g></svg>')


def main():
    inkscape = find_inkscape()
    source = SOURCE.read_text()

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)

        background_svg = tmp / 'background.svg'
        background_svg.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">'
            f'<rect width="1024" height="1024" fill="{BACKGROUND}"/></svg>'
        )

        # icon.png and favicon.png are never cropped by a launcher: the
        # drawing does not need the adaptive icon safe zone margin.
        icon_svg = tmp / 'icon.svg'
        icon_svg.write_text(with_background(source, zoom=ICON_ZOOM))

        print(f'Exporting from {SOURCE.relative_to(ROOT)}:')

        export(inkscape, SOURCE, OUTPUT / 'android-icon-foreground.png', 1024)
        # The drawing is already white on transparent: Android only uses
        # the alpha channel of the monochrome layer.
        export(inkscape, SOURCE, OUTPUT / 'android-icon-monochrome.png', 1024)
        export(inkscape, background_svg, OUTPUT / 'android-icon-background.png', 1024)
        export(inkscape, icon_svg, OUTPUT / 'icon.png', 1024)
        # Full square canvas, so the splash image keeps the same proportions
        # whatever the drawing: app.json (imageWidth) and the in-app splash
        # overlay (components/animated-icon.tsx) rely on it.
        export(inkscape, SOURCE, OUTPUT / 'splash-icon.png', 1024)
        export(inkscape, icon_svg, OUTPUT / 'favicon.png', 48)
        export(inkscape, icon_svg, STORE_OUTPUT / 'playstore-icon.png', 512, opaque=True)
        export(
            inkscape,
            STORE_OUTPUT / 'feature-graphic.svg',
            STORE_OUTPUT / 'feature-graphic.png',
            1024,
            opaque=True,
        )


if __name__ == '__main__':
    main()
