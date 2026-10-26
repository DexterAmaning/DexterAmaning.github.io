// Local preview: npm run serve, then open the printed URL.
import { startServer } from "./lib.mjs";

const port = Number(process.env.PORT ?? 4173);
const { origin } = await startServer(port);
console.log(`Serving site/ at ${origin}/ (Ctrl+C to stop)`);
