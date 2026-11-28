# Architecture

Lumen is a small hotel desk split the way a front office actually works. One surface is the room the staff stand in. Another is the board of rooms and stays. Behind those are the lookup, the operation, and the house rules. The first version keeps that split visible without pretending to be a production platform.

## Two frontends, composed at runtime

The shell and the operations desk are separate Vite applications.

The shell owns the frame: the property rail, the section navigation, and the command palette. It does not render rooms or reservations itself. It loads `OperationsDesk` from the operations remote through Module Federation (`remoteEntry.js` on port 5174) and passes the current section and an optional focused record. React is shared as a singleton so the remote does not mount a second copy.

The operations app owns the screens and the live house. It can run alone on port 5174 with its own section switcher. That standalone entry is the check that this is two applications and not one bundle with a lazy route. Shipping the board separately is the point of the split: the screens change when the house workflow changes, and the shell changes when navigation or the palette changes. They meet only at the exposed component and the actions feed.

Module Federation is more machinery than a first version strictly needs. A single React app would boot with less configuration. The cost is accepted so the boundary is real: the shell fails clearly when the remote is down, and the remote does not import the palette.

## Why the palette lives in the shell

The palette is not a feature of one screen. A check-in typed on the arrivals board, a room lookup typed from guests, and a procedure question typed from anywhere are the same gesture. Putting it in the shell means every section has it, and the operations remote does not need to know which service answers which sentence.

Routing is deterministic and tested. A lookup goes to Search. An imperative operation goes to Actions. A procedure question goes to Docs. A sentence that both gives an order and asks for a rule goes to Docs, which may call the other two. Questions are not executed: "can I cancel this stay?" is an assessment, not a cancellation.

The shell only decides where to send the sentence. It does not own hotel rules. Check-in requirements, cancellation fees, and request transitions live in the domain module the Actions service uses, which is also what Docs consults when it assesses a stay.

## Three services and one house file

Search reads. Actions writes. Docs reads the procedure files and calls the other two over HTTP when a question needs a record or an operation. They are separate processes so a policy question does not go through the code that assigns a room, and a search does not grow a write path.

They still have to see one house. Actions is the writer. It keeps the rooms, stays, guests, and requests in `data/store.json`, updates the file with a temp-file rename, and returns the events it applied. Search reads that file on each query, so a check-in is visible to the next search without a shared database. Docs never opens the file. If it needs the house, it calls Search or Actions.

A JSON file is the wrong tool once two writers contend or the house is larger than a single property. It is the right tool here: one writer, a few dozen records, no database to install, and the sample can be reset by deleting the file. The domain rules are ordinary functions, so a later store can sit under the same `transact` boundary.

## How the board updates

The operations app loads `GET /state` and subscribes to `GET /events`, a server-sent stream from Actions. A palette command that checks a guest in posts to Actions. Actions updates the file and writes the reservation and room events to every subscriber. The desk applies those events in place, so the briefing, the room, and the stay change without a reload. The same stream serves a click on the board and a call from Docs. The palette does not poke the remote directly.

There is a small gap if an event is published in the moment between the first read and the stream attaching. The client reads the house again when the stream opens, which closes that gap for the local demo.

## Retrieval without a model

The procedure set is six short synthetic documents: check-in, cancellation, housekeeping, late checkout, staff requests, and room assignment. Docs splits each file on its headings and ranks the passages with BM25. The answer quotes the best passage and, when the router asked for a tool, includes what Search or Actions returned.

That choice is deliberate. A desk should answer "what is our fee-free window?" with the house rule, including when the machine has no network and nobody has provisioned a model. Keyword retrieval over a few dozen passages is inspectable: a test can assert which heading came back, and a wrong answer is a passage you can open. It will miss paraphrases that share no terms with the document. That is the trade for a default path with no key and no hosted model.

If `OPENAI_API_KEY` is present, Docs may send the question, the passages it already retrieved, and the tool notes it already executed to the OpenAI chat completions API and use the reply as the wording. The model is not asked to search the web or to invent a rule, and a failure falls back to the composed answer. Unset, the key is never required and no outbound model call is made.

## What this version leaves out

There is no login, no second property, and no production deploy. The services allow any local origin because they are a demo on a laptop. The palette understands a fixed set of sentences rather than an open grammar. Those are boundaries, not unfinished copies of a larger system.
