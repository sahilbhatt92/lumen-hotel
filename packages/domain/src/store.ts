import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ActionOutcome, HotelState } from "./types.js";
import { createSeedState } from "./seed.js";

export interface HotelStore {
  read(): HotelState;
  transact(fn: (state: HotelState) => ActionOutcome): ActionOutcome;
}

export function defaultDataFile(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../data/store.json");
}

export function openFileStore(file = process.env.LUMEN_DATA_FILE ?? defaultDataFile()): HotelStore {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    const payload = JSON.stringify(createSeedState(), null, 2);
    try {
      fs.writeFileSync(file, payload, { flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  return new FileStore(file);
}

export class MemoryStore implements HotelStore {
  constructor(private state: HotelState = createSeedState()) {}

  read(): HotelState {
    return structuredClone(this.state);
  }

  transact(fn: (state: HotelState) => ActionOutcome): ActionOutcome {
    const outcome = fn(structuredClone(this.state));
    if (outcome.ok && outcome.changed) this.state = outcome.state;
    return outcome;
  }
}

class FileStore implements HotelStore {
  constructor(private readonly file: string) {}

  read(): HotelState {
    return JSON.parse(this.readRaw()) as HotelState;
  }

  transact(fn: (state: HotelState) => ActionOutcome): ActionOutcome {
    const outcome = fn(this.read());
    if (outcome.ok && outcome.changed) this.write(outcome.state);
    return outcome;
  }

  private readRaw(): string {
    try {
      return fs.readFileSync(this.file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return fs.readFileSync(this.file, "utf8");
    }
  }

  private write(state: HotelState): void {
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, this.file);
  }
}
