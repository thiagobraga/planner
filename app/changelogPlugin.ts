import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const CHANGELOG_VIRTUAL_ID = "virtual:changelog";
const CHANGELOG_RESOLVED_ID = `\0${CHANGELOG_VIRTUAL_ID}`;
const CHANGELOG_PATH = fileURLToPath(new URL("../CHANGELOG.md", import.meta.url));

function readRootChangelog(): string {
  if (!existsSync(CHANGELOG_PATH)) return "";
  return readFileSync(CHANGELOG_PATH, "utf-8");
}

export function changelogPlugin(): Plugin {
  return {
    name: "planner-changelog",
    enforce: "pre",
    resolveId(id) {
      if (id === CHANGELOG_VIRTUAL_ID) return CHANGELOG_RESOLVED_ID;
      return null;
    },
    load(id) {
      if (id === CHANGELOG_RESOLVED_ID) {
        return `export default ${JSON.stringify(readRootChangelog())};`;
      }
      return null;
    },
    configureServer(server) {
      server.watcher.add(CHANGELOG_PATH);
      const reloadOnChange = (changedPath: string) => {
        if (changedPath !== CHANGELOG_PATH) return;
        const mod = server.moduleGraph.getModuleById(CHANGELOG_RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("change", reloadOnChange);
      server.watcher.on("add", reloadOnChange);
      server.watcher.on("unlink", reloadOnChange);
    },
  };
}
