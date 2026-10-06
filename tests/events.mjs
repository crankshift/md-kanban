import { get } from 'node:http';

/** Minimal server-sent events client for the board's /api/events stream. */
export async function connectEvents(t, url) {
  const events = [];
  let ended = false;
  let waiting = [];
  const response = await new Promise((resolve, reject) => {
    const req = get(`${url}/api/events`, resolve);
    req.on('error', reject);
    t.after(() => req.destroy());
  });
  let buffer = '';
  response.setEncoding('utf8');
  const settle = () => { waiting = waiting.filter((check) => !check()); };
  response.on('data', (chunk) => {
    buffer += chunk;
    for (let end = buffer.indexOf('\n\n'); end >= 0; end = buffer.indexOf('\n\n')) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const name = /^event: (.*)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      if (name) events.push({ name, data: data ? JSON.parse(data) : null });
    }
    settle();
  });
  response.on('close', () => { ended = true; settle(); });
  const until = (predicate, label, timeout = 8000) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), timeout);
    const check = () => {
      if (!predicate()) return false;
      clearTimeout(timer); resolve(); return true;
    };
    if (!check()) waiting.push(check);
  });
  return {
    response, events,
    changes: () => events.filter((event) => event.name === 'change').length,
    ended: () => ended,
    waitForChanges: (count, timeout) => until(() => events.filter((event) => event.name === 'change').length >= count, `${count} change event(s)`, timeout),
    waitForEnd: (timeout) => until(() => ended, 'stream end', timeout),
  };
}

export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
