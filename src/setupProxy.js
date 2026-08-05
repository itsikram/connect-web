const path = require("path");
const fs = require("fs");

/**
 * Serve .mobileconfig with Apple's MIME type so Safari installs it
 * into Settings → Profile Downloaded (not the Files app).
 */
module.exports = function setupProxy(app) {
  app.get("/connect.mobileconfig", (req, res) => {
    const filePath = path.join(__dirname, "../public/connect.mobileconfig");
    if (!fs.existsSync(filePath)) {
      return res.status(404).send("iOS profile not found");
    }
    res.setHeader("Content-Type", "application/x-apple-aspen-config");
    res.setHeader(
      "Content-Disposition",
      'inline; filename="connect.mobileconfig"'
    );
    res.setHeader("Cache-Control", "no-store");
    return res.sendFile(filePath);
  });
};
