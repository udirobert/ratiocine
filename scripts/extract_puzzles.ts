import { writeFileSync } from "fs";
import { PUZZLE_POOL } from "../showcase/app/play/puzzle-data.ts";

const out = JSON.stringify(PUZZLE_POOL, null, 2);
writeFileSync("data/puzzles.json", out);
console.log(`Extracted ${PUZZLE_POOL.length} puzzles to data/puzzles.json`);
