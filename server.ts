import express from "express";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import path from "path";

function getFriendlyErrorMessage(error: any) {
  if (error.code === 'EAUTH' || error.responseCode === 535) {
    return "Authentication failed. Please check your username and password. If using Gmail, ensure you are using an App Password.";
  }
  if (error.code === 'ECONNREFUSED') {
    return "Connection refused. Please check your SMTP host and port.";
  }
  if (error.code === 'ENOTFOUND') {
    return "Host not found. Please verify the SMTP host address.";
  }
  if (error.code === 'ESOCKET' || error.code === 'ETIMEDOUT') {
    return "Network error or timeout. Please check your connection and port settings (e.g., try port 465 or 587).";
  }
  return error.message || "An unknown error occurred.";
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API routes
  app.post("/api/verify-smtp", async (req, res) => {
    try {
      const { smtp } = req.body;

      if (!smtp || !smtp.host || !smtp.port || !smtp.user || !smtp.pass) {
        return res.status(400).json({ error: "Missing required SMTP configuration" });
      }

      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: parseInt(smtp.port, 10),
        secure: smtp.port == 465,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
      });

      await transporter.verify();
      res.json({ success: true, message: "Connection successful!" });
    } catch (error: any) {
      console.error("SMTP Verification Error:", error);
      res.status(400).json({ error: getFriendlyErrorMessage(error), details: error.message });
    }
  });

  app.post("/api/send-email", async (req, res) => {
    try {
      const { smtp, email } = req.body;

      if (!smtp || !smtp.host || !smtp.port || !smtp.user || !smtp.pass) {
        return res.status(400).json({ error: "Missing SMTP configuration" });
      }

      if (!email || !email.to || !email.subject || !email.html) {
        return res.status(400).json({ error: "Missing email details" });
      }

      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: parseInt(smtp.port, 10),
        secure: smtp.port == 465, // true for 465, false for other ports
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
      });

      const info = await transporter.sendMail({
        from: `"${smtp.name || smtp.user}" <${smtp.user}>`,
        to: email.to,
        subject: email.subject,
        html: email.html,
      });

      res.json({ success: true, messageId: info.messageId });
    } catch (error: any) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: getFriendlyErrorMessage(error), details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
