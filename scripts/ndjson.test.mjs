// Mirrors the buffer logic in ChatAdvisor.jsx: NDJSON where a JSON object may
// be split across arbitrary chunk boundaries.
function makeParser() {
  let buffer = '';
  let assembled = '';
  let done = false;
  let error = null;
  return {
    feed(chunk) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const e = JSON.parse(line);
        if (e.error) error = e.error;
        if (e.delta) assembled += e.delta;
        if (e.done) done = true;
      }
    },
    get state() { return { assembled, done, error }; },
  };
}

const wire =
  JSON.stringify({ delta: 'Hello ' }) + '\n' +
  JSON.stringify({ delta: 'from Darbi' }) + '\n' +
  JSON.stringify({ delta: ' — what do you enjoy?' }) + '\n' +
  JSON.stringify({ done: true }) + '\n';

let pass = 0, fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
};

// 1. whole payload at once
let p = makeParser(); p.feed(wire);
check('single chunk', p.state, { assembled: 'Hello from Darbi — what do you enjoy?', done: true, error: null });

// 2. one byte at a time — worst-case split, including mid-JSON and mid-UTF8-char boundaries
p = makeParser();
for (const ch of wire) p.feed(ch);
check('byte-by-byte', p.state, { assembled: 'Hello from Darbi — what do you enjoy?', done: true, error: null });

// 3. split exactly on a newline
p = makeParser();
const nl = wire.indexOf('\n') + 1;
p.feed(wire.slice(0, nl)); p.feed(wire.slice(nl));
check('split on newline', p.state, { assembled: 'Hello from Darbi — what do you enjoy?', done: true, error: null });

// 4. in-band error after partial output — partial text must survive
p = makeParser();
p.feed(JSON.stringify({ delta: 'Partial answer' }) + '\n' + JSON.stringify({ error: 'overloaded_error' }) + '\n');
check('in-band error keeps partial', p.state, { assembled: 'Partial answer', done: false, error: 'overloaded_error' });

// 5. a delta containing a literal \n must not be treated as a frame boundary
p = makeParser();
p.feed(JSON.stringify({ delta: 'line one\nline two' }) + '\n' + JSON.stringify({ done: true }) + '\n');
check('newline inside a delta', p.state, { assembled: 'line one\nline two', done: true, error: null });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
