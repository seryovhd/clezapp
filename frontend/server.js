// Simple express server to run frontend production build with GZIP compression & caching
const express = require("express");
const path = require("path");
const compression = require("compression");

const app = express();

// Habilitar compresión GZIP para todos los recursos (reduce JS y CSS hasta un 75%)
app.use(compression());

// Servir archivos estáticos del build con cache para recursos con hash
app.use(
  express.static(path.join(__dirname, "build"), {
    maxAge: "1y",
    setHeaders: (res, filePath) => {
      // index.html NUNCA debe guardarse en caché para que las actualizaciones se apliquen de inmediato
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
    }
  })
);

app.get("/*", function (req, res) {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Frontend production server running on port ${PORT} with GZIP enabled`);
});
