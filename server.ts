const express = require("express");
const helmet = require("helmet");

const app = express();
app.use(helmet());

const PORT = process.env.PORT || 8000;

app.get("/health", (_req: any, res: any) => {
  res.json({ status: "ok" });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;
