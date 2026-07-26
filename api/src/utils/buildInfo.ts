import fs from "node:fs";
import path from "node:path";

const BUILD_ID_PATH = path.join(process.cwd(), "BUILD_ID");

// The production Dockerfile stamps this file once, at image build time (not
// container start), so it changes on every real deploy but stays stable
// across plain restarts. The dev image never writes it, so dev always
// reports "dev" and the frontend's version-check poll never fires there.
export const BUILD_VERSION: string = (() => {
  try {
    return fs.readFileSync(BUILD_ID_PATH, "utf-8").trim() || "dev";
  } catch {
    return "dev";
  }
})();
