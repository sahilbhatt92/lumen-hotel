import { listen } from "@lumen/http";
import { createDocsServer } from "./server.js";

const port = Number(process.env.PORT ?? 4003);
listen(createDocsServer(), port).then((bound) => {
  console.log(`docs listening on ${bound}`);
});
