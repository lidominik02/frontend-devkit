# stop-hook-failing-gate

With a lint gate that fails, the core Stop hook blocks the end of the turn, and its reason
carries the gate's own output. `/windows-check` runs this scenario as its Stop-hook step.

## Fixture

### package.json
```json
{
  "name": "stop-hook-fixture",
  "private": true,
  "type": "module",
  "scripts": {
    "lint": "node scripts/lint.mjs"
  }
}
```

### scripts/lint.mjs
```js
console.log('lint: line one');
console.log('lint: src/a.js 3:1 error no-undef');
process.exit(1);
```

### src/a.js
```js
export const a = 1;
```

## Prompt
Add the line `// touched` at the top of src/a.js. Change nothing else, and run no command.

## Expect
- tool-called Edit
- file-matches src/a.js /^\/\/ touched/
- hook-blocked Stop /lint: FAILED/
- hook-blocked Stop /src\/a\.js 3:1 error no-undef/

## Options
- budget: 1
