# Sync the website and the phone app (same Wi-Fi, no accounts)

FitTrack keeps data on each device. To see the same data on the website and the phone, run the small
sync server on your computer. Both the website and the phone app merge their data through it.

## Start the server (on your computer, needs Node 20+)
```bash
npm install --legacy-peer-deps
npm run build:web        # builds the website into ./dist
npm run sync:server      # prints the address and a 6-digit pairing code
```
It prints something like `http://192.168.1.20:8787` and `Pairing code: 483920`.

## Connect
- **Website:** open the printed address in a browser on any device on the same Wi-Fi. In *Settings > Sync across devices* the address is pre-filled; enter the pairing code and tap *Sync now*.
- **Phone app:** *Settings > Sync across devices*, enter the same address and code, tap *Sync now*.
Sync again whenever you want to share new data. It is manual; nothing runs in the background.

## What syncs
New workouts, runs, cardio, counters, measurements, goals, plans and custom exercises are merged both ways.
A row that exists on both sides keeps each device's own version (for example, if both devices entered steps for the
same day, each keeps its own number). **Edits and deletions do not sync**, so nothing is ever lost. The first device
to sync decides the profile; a new device adopts it. The pairing code and address are never put in a backup file.

## Security
Traffic is plain HTTP on your own network, protected by the pairing code. Use it on a trusted home network, do not
forward the port to the internet, and stop the server when you are done. Data is stored in `./sync-data/` on your computer
(it is git-ignored). The website must be opened from the sync server's address (an https site cannot call an http server).
