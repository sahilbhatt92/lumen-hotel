# Lumen Hotel

Lumen is the operations desk for Harbor House, a fictional 17-room hotel in Seacliff. The desk is for the people working a shift: it shows rooms, reservations, guests, and staff requests, and it takes the ordinary front-desk operations (check-in, check-out, room assignment, cancellation, and staff requests). A command palette on the shell accepts plain language, and a small document service answers questions from the property's own procedures.

The guest records, stays, and procedure documents are synthetic. Lumen is not a client system and it is not connected to a hotel.

## Run locally

Requires Node.js 22.

```bash
npm install
npm run dev
```

`npm run dev` starts both micro-frontends and all three services:

| Process | URL |
| --- | --- |
| Shell | http://localhost:5173 |
| Operations remote | http://localhost:5174 |
| Search | http://localhost:4001 |
| Actions | http://localhost:4002 |
| Docs | http://localhost:4003 |

Open the shell. The operations screens are loaded from the remote at runtime. The same operations app can also be opened on its own port, with a small standalone frame, which is how you can tell the two frontends are separate.

Where Docker is available, `docker compose up` runs the same `npm run dev` command inside a Node 22 container and publishes the ports above.

The business date is fixed at 26 November 2026 so the sample board stays stable. Operational state is written to `data/store.json` on first use. Delete that file to restore the sample house.

## Command palette

Press Ctrl+K or Cmd+K, or use Ask the desk.

- `find room 214` searches rooms, stays, guests, and requests.
- `check in LH-1842` checks in a ready arrival. The operations screens update from the actions service without a reload.
- `assign room 222 to LH-1860` puts a room on an unassigned arrival.
- `what is the late checkout policy?` answers from the property procedures.
- `can I cancel LH-1871 without a fee?` reads the stay and the cancellation rule, and does not cancel it.
- `check in LH-1842 and quote the identification rule` performs the check-in and cites the procedure.

## Architecture

The shell owns layout, navigation, and the command palette. The operations micro-frontend owns the hotel screens and is composed at runtime with Module Federation. Three Node services sit behind the palette:

- **Search** queries the current rooms, reservations, guests, and staff requests.
- **Actions** performs operations and publishes the resulting changes so the operations screens can update.
- **Docs** retrieves passages from the synthetic procedures. When a question also needs a record or an operation, it calls Search and Actions.

Retrieval is local. There is no model and no API key on the default path. If `OPENAI_API_KEY` is set, Docs may ask that model to phrase an answer from passages and tool results it already has. The desk still retrieves and still calls the other services without the key.

A longer note on the split, the palette, and the retrieval choice is in [docs/architecture.md](docs/architecture.md).

## Checks

```bash
npm run lint
npm run typecheck
npm test
```

GitHub Actions runs those three on push and pull request.
