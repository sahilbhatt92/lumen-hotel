import { openFileStore } from "@lumen/domain/server";
import { listen } from "@lumen/http";
import { createSearchServer } from "./server.js";

const port = Number(process.env.PORT ?? 4001);
const store = openFileStore();
const server = createSearchServer(store);

listen(server, port).then((bound) => {
  console.log(`search listening on ${bound}`);
});
