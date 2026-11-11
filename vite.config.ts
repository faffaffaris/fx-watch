import fs from "node:fs";
import type { IncomingMessage } from "node:http";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import cesium from "vite-plugin-cesium";

function dashboardUpload(): Plugin {
  return {
    name: "fx-watch-dashboard-upload",
    configureServer(server) {
      server.middlewares.use("/api/dashboard", (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }
        if (req.headers["x-fx-role"] !== "admin") {
          res.statusCode = 403;
          res.end("Admin sign-in is required.");
          return;
        }
        readBody(req, 12_000_000)
          .then((raw) => {
            const parsed = JSON.parse(raw) as { countries?: unknown; generatedAt?: unknown };
            if (!Array.isArray(parsed.countries) || parsed.countries.length === 0 || typeof parsed.generatedAt !== "string") {
              res.statusCode = 400;
              res.end("The file needs generatedAt and a countries array.");
              return;
            }
            const target = path.resolve(server.config.root, "public/dashboard.json");
            fs.writeFileSync(target, JSON.stringify(parsed));
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok: true, countries: parsed.countries.length }));
          })
          .catch((error: unknown) => {
            res.statusCode = 400;
            res.end(error instanceof Error ? error.message : "Could not read the upload.");
          });
      });
    },
  };
}

function readBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Upload is larger than 12 MB."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export default defineConfig({
  plugins: [react(), cesium(), dashboardUpload()],
  server: { port: 5173 },
});
