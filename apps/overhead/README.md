# Overhead

A daily puzzle: name the place from a satellite photo. Every guess zooms the photo out, from 2 km across to 64 km, and wrong guesses show how far off you are and which way to go. *Working title.*

Built with Expo (React Native), like the other games here.

## Run it
```bash
cd apps/overhead
npm install
npx expo start                              # scan the QR code with Expo Go
EXPO_PUBLIC_PREVIEW=1 npx expo start --web  # browser, with arrows to page through every day
```

## Check it
```bash
npm run typecheck
npm test
```

## How it works
- `src/game/logic.ts`: rules (day number, distance and direction, zoom level, share text, place search). Unit tested.
- `src/game/places.ts`: the ~170 places a player can type. Answers come from this list.
- `src/game/puzzles.ts`: which place runs on which day. Day #1 is Nov 4, 2026; the list repeats after the end.
- `src/game/images.ts`: generated; maps each puzzle to its six zoom images and capture date.
- `App.tsx`: the one screen (photo, guess box, guess list, reveal, how-to-play).

## Images
All photos are Sentinel-2 true color (10 m pixels), read from the free public copy on AWS (`sentinel-cogs` bucket, no account needed). Copernicus data may be used commercially as long as the app credits it, which it does under the photo: "Contains modified Copernicus Sentinel data".

To add or redo a day:
```bash
pip install rasterio pyproj mgrs pillow numpy
python scripts/render.py scripts/render-places.json /tmp/out --only some-id > /tmp/render.log
python scripts/import-images.py /tmp/out /tmp/render.log
```
`render.py` picks the clearest pass from 2024-2025 for the months listed per place, mosaics neighboring tiles, and writes six 640 px JPEGs. Look at every image before shipping; thin cloud and smoke slip past the cloud filter.

Do not swap in Google, Apple, Esri or Mapbox imagery: their terms don't allow reuse in a game.

## Web prototype
```bash
EXPO_PUBLIC_PREVIEW=1 npx expo export -p web
python scripts/web-single.py dist overhead.html   # one self-contained file
```

## Wallpapers and prints
`scripts/wallpaper.py scripts/wallpapers.json out/` renders each place at full 10 m detail as a phone wallpaper (1290 x 2796) and a 16 x 20 in print file (4800 x 6000). Same credit line applies.
