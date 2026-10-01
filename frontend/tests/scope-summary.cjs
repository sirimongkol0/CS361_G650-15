const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', file), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const context = { exports: {} };
  vm.runInNewContext(compiled, context);
  return context.exports;
}
const { countByScope } = load('scope-summary.ts');
const { parseScopeLevel, scopeLevelLabels, scopeLevelColors } = load('labels.ts');

assert.deepEqual({ ...countByScope([]) }, { program: 0, broader: 0, unclassified: 0 });
assert.deepEqual({ ...countByScope([
  { scopeLevel: 'program' }, { scopeLevel: 'program' }, { scopeLevel: 'faculty' },
  { scopeLevel: 'university' }, { scopeLevel: null }, {}, { scopeLevel: 'department' },
]) }, { program: 2, broader: 2, unclassified: 3 });
assert.equal(parseScopeLevel('program'), 'program');
assert.equal(parseScopeLevel('faculty'), 'faculty');
assert.equal(parseScopeLevel('university'), 'university');
assert.equal(parseScopeLevel('department'), null);
assert.equal(parseScopeLevel(null), null);
assert.equal(parseScopeLevel(undefined), null);
assert.deepEqual(Object.keys(scopeLevelLabels), ['program', 'faculty', 'university']);
assert.equal(scopeLevelLabels.program, 'หลักสูตร CSTU');
assert.equal(scopeLevelLabels.faculty, 'ระดับคณะ');
assert.equal(scopeLevelLabels.university, 'ระดับมหาวิทยาลัย');
assert.deepEqual(Object.keys(scopeLevelColors), Object.keys(scopeLevelLabels));
console.log('PASS: scope-level counts (CSTU direct vs faculty/university vs unclassified), parsing and labels');
