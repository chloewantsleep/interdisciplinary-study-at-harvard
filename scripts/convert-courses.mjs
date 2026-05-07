// scripts/convert-courses.mjs
// Run: node scripts/convert-courses.mjs
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC_DIR = "C:\\Users\\chloe\\Downloads\\Unified_Courses";
const OUT = join(ROOT, "data", "courses.json");

const EXTRA_DIR = "C:\\Users\\chloe\\Downloads";

const FILES = [
  { dir: SRC_DIR,   file: "Harvard_Courses_Unified.xlsx",            sheets: ["GSD Courses", "HKS Courses", "HLS Courses", "HDS Courses"] },
  { dir: EXTRA_DIR, file: "Harvard_HGSE_FAS_HSPH_HBS_Unified.xlsx",  sheets: ["HGSE Courses", "FAS Courses", "HSPH Courses", "HBS Courses"] },
];

const FIELD_MAP = {
  "Course ID": "id",
  "Course Name": "name",
  "School": "school",
  "Semester": "semester",
  "Year": "year",
  "Course Type": "type",
  "Credits": "credits",
  "Instruction Method": "mode",
  "Schedule": "schedule",
  "Instructor": "instructor",
  "Department/Area": "department",
  "Prerequisites": "prerequisites",
  "Enrollment Restrictions": "restrictions",
  "Course Description": "description",
  "Course Page": "url",
  "Keywords": "keywords",
};

function clean(v) {
  if (v === null || v === undefined) return "";
  const s = String(v).trim().replace(/\s+/g, " ");
  return s === "nan" ? "" : s;
}

const seen = new Set();
const courses = [];

for (const { dir, file, sheets } of FILES) {
  const path = join(dir ?? SRC_DIR, file);
  let wb;
  try {
    wb = XLSX.readFile(path);
  } catch (e) {
    console.error(`Could not read ${file}: ${e.message}`);
    continue;
  }
  for (const sheetName of sheets) {
    const ws = wb.Sheets[sheetName];
    if (!ws) { console.warn(`  Sheet '${sheetName}' not found in ${file}`); continue; }
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    let added = 0;
    for (const row of rows) {
      const c = {};
      for (const [xlsxKey, jsonKey] of Object.entries(FIELD_MAP)) {
        c[jsonKey] = clean(row[xlsxKey] ?? "");
      }
      if (!c.name) continue;
      // Dedup by school+id or school+name
      const key = `${c.school}||${c.id || c.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // Parse keywords into array
      c.keywordList = c.keywords
        ? c.keywords.split(";").map(k => k.trim()).filter(Boolean)
        : [];
      // Numeric credits
      c.creditsNum = parseFloat(c.credits) || 0;
      courses.push(c);
      added++;
    }
    console.log(`  ${sheetName}: ${added} courses`);
  }
}

// Build keyword universe
const kwCounts = {};
for (const c of courses) {
  for (const kw of c.keywordList) {
    kwCounts[kw] = (kwCounts[kw] || 0) + 1;
  }
}
const keywords = Object.entries(kwCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([kw, count]) => ({ kw, count }));

writeFileSync(OUT, JSON.stringify({ courses, keywords }, null, 0), "utf8");
const mb = (readFileSync(OUT).length / 1024 / 1024).toFixed(1);
console.log(`\nWrote ${courses.length} courses, ${keywords.length} keywords → data/courses.json (${mb} MB)`);
