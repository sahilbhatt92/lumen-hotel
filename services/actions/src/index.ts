import { openFileStore } from "@lumen/domain/server";
import { listen } from "@lumen/http";
import { createActionsServer } from "./server.js";

const port = Number(process.env.PORT ?? 4002);
const server = createActionsServer(openFileStore());

listen(server, port).then((bound) => {
  console.log(`actions listening on ${bound}`);
});
