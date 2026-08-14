import * as fs from "node:fs";
import * as path from "node:path";
import libCoverage from "istanbul-lib-coverage";
import libReport from "istanbul-lib-report";
import reports from "istanbul-reports";

// Merges the per-test coverage snapshots collected by `e2e/coverage-fixture.ts`
// into a single HTML report served at https://coverage.planner.local/e2e/.
// Lives under coverage-reports/ (not dist/) so app builds never wipe it.
const rawDir = path.resolve(import.meta.dirname, "../coverage-e2e/raw");
const outDir = path.resolve(import.meta.dirname, "../coverage-reports/e2e");

const coverageMap = libCoverage.createCoverageMap();
for (const file of fs.readdirSync(rawDir)) {
  if (!file.endsWith(".json")) continue;
  const snapshot = JSON.parse(fs.readFileSync(path.join(rawDir, file), "utf8"));
  coverageMap.merge(snapshot);
}

fs.mkdirSync(outDir, { recursive: true });
const context = libReport.createContext({
  dir: outDir,
  coverageMap,
  defaultSummarizer: "nested",
});
reports.create("html-spa", {}).execute(context);
reports.create("text-summary", {}).execute(context);