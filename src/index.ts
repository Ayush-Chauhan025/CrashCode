import { AST_Parser } from "./parser";
import { AI_agent } from "./agent";

const parser = new AST_Parser();
const agent = new AI_agent();

const functions = parser.extract_exported_function(
    "./src/sample.ts"
);

const result = agent.generate_exploit("./sample.ts", functions[0]);

console.log(result);