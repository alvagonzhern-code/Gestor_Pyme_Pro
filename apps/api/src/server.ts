import { createApp } from "./app.js";
import { config } from "./config.js";

const app = createApp();
app.listen(config.port, () => {
  console.log(`Gestor Pyme API disponible en http://localhost:${config.port}`);
  if (!config.isProduction && config.jwtSecret.includes("development-only")) {
    console.warn(
      "AVISO: usa un JWT_SECRET seguro antes de exponer la aplicación en red.",
    );
  }
});
