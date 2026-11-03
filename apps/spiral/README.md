# Starspin

A one-tap arcade game for iOS: tap when the beam hits the ring, and build a spiral galaxy one star at a time. *Working title.*

Built with Expo (React Native). It's built and submitted in the cloud with EAS, so no Mac is needed.

- Design: [docs/design.md](docs/design.md)
- Store listing draft: [docs/store-listing.md](docs/store-listing.md)
- Privacy policy draft: [docs/privacy.md](docs/privacy.md)

## Run it
```bash
cd apps/spiral
npm install
npx expo start         # scan the QR code with Expo Go on an iPhone
npx expo start --web   # or play in a browser
```

## Check it
```bash
npm run typecheck
npm test
```

## Layout
- `src/game/logic.ts`: the rules (angles, grading, scoring, daily runs, share text). Pure TypeScript with unit tests.
- `src/game/Galaxy.tsx`: draws the stars and the background starfield.
- `App.tsx`: the game loop, input, and screens.
- `src/sound.ts`, `src/feedback.ts`, `src/storage.ts`: sound, haptics, and on-device saves.
- `scripts/make-icons.js`, `scripts/make-sounds.py`: generate the icon, splash and sounds.

## Ship it (once the Apple account exists)
```bash
npx eas-cli@latest login
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest submit -p ios --latest
```

If you install packages here, `npx expo install` may time out in sandboxed environments. Run `EXPO_OFFLINE=1 npx expo install <pkg>` instead.
