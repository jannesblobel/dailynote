import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { createServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const commitHash = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: root })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
})();

globalThis.__COMMIT_HASH__ = commitHash;

const vite = await createServer({
  root,
  logLevel: "error",
  server: { middlewareMode: true },
  appType: "custom",
});

try {
  const { Calendar } = await vite.ssrLoadModule(
    "/src/components/Calendar/Calendar.tsx",
  );
  const now = new Date();
  const year = now.getFullYear();
  const today = [
    String(year),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const calendarHtml = renderToStaticMarkup(
    React.createElement(Calendar, {
      year,
      hasNote: () => false,
      onYearChange: () => {},
      now,
    }),
  );

  const indexPath = path.join(root, "dist/index.html");
  const indexHtml = await fs.readFile(indexPath, "utf8");
  const $ = load(indexHtml, { decodeEntities: false });
  $("#root")
    .attr("data-ssg-calendar", "true")
    .attr("data-ssg-year", String(year))
    .attr("data-ssg-today", today)
    .html(calendarHtml);
  await fs.writeFile(indexPath, $.html());
} finally {
  await vite.close();
}
