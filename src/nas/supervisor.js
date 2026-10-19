const { fork } = require('node:child_process');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { error } = require('../errors');
function createNasSupervisor({ spawn, timeoutMs = 30000, retryMs = 15000 } = {}) {
  let child = null,
    pending = null,
    stuck = false,
    stopped = false,
    healthy = false,
    lastVerified = null,
    lastError = null,
    nextAttempt = 0;
  const queue = [];
  function rejectQueue() {
    for (const task of queue.splice(0)) {
      clearTimeout(task.timer);
      task.reject(error('NAS_UNAVAILABLE'));
    }
  }
  function fail() {
    healthy = false;
    lastError = 'NAS_UNAVAILABLE';
    stuck = !!child;
    nextAttempt = Date.now() + retryMs;
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(error('NAS_UNAVAILABLE'));
      pending = null;
    }
    rejectQueue();
    child?.kill('SIGTERM');
  }
  function ensureChild() {
    if (child) return;
    child = spawn
      ? spawn()
      : fork(path.join(__dirname, 'worker.js'), [], {
          stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
          serialization: 'advanced',
          windowsHide: true,
        });
    child.on('message', (message) => {
      if (!pending || message.id !== pending.id || stuck) return;
      const task = pending;
      pending = null;
      clearTimeout(task.timer);
      if (message.error) {
        healthy = message.error === 'NAS_SPACE_LOW';
        if (healthy) lastVerified = Date.now();
        lastError = message.error;
        task.reject(error(message.error));
        if (
          !['NAS_BUSY', 'ENOENT', 'NAS_HEALTH_REQUIRED', 'NAS_SPACE_LOW', 'EEXIST'].includes(
            message.error,
          )
        ) {
          nextAttempt = Date.now() + retryMs;
          rejectQueue();
        }
      } else {
        healthy = true;
        lastError = null;
        lastVerified = Date.now();
        task.resolve(message.result);
      }
      pump();
    });
    child.on('exit', () => {
      child = null;
      stuck = false;
      healthy = false;
      lastError = 'NAS_UNAVAILABLE';
      if (pending) {
        clearTimeout(pending.timer);
        pending.reject(error('NAS_UNAVAILABLE'));
        pending = null;
      }
      rejectQueue();
      nextAttempt = Date.now() + retryMs;
    });
    child.on('error', fail);
  }
  function pump() {
    if (pending || stuck || stopped || !queue.length) return;
    const task = queue.shift();
    if (Date.now() < nextAttempt && !['health', 'initialize'].includes(task.op)) {
      clearTimeout(task.timer);
      task.reject(error('NAS_UNAVAILABLE'));
      pump();
      return;
    }
    try {
      ensureChild();
      pending = task;
      child.send({ id: task.id, op: task.op, payload: task.payload }, (e) => {
        if (e) fail();
      });
    } catch {
      fail();
    }
  }
  function request(op, payload) {
    if (
      stopped ||
      (stuck && child) ||
      (Date.now() < nextAttempt && !['health', 'initialize'].includes(op))
    )
      return Promise.reject(error('NAS_UNAVAILABLE'));
    if (queue.length >= 64) return Promise.reject(error('NAS_BUSY'));
    return new Promise((resolve, reject) => {
      const task = { id: randomUUID(), op, payload, resolve, reject };
      task.timer = setTimeout(() => {
        if (pending === task) fail();
        else {
          const index = queue.indexOf(task);
          if (index >= 0) queue.splice(index, 1);
          reject(error('NAS_BUSY'));
        }
      }, timeoutMs);
      queue.push(task);
      pump();
    });
  }
  return {
    request,
    status: () => ({
      available: healthy && !stuck && !stopped,
      stuck,
      busy: !!pending,
      queued: queue.length,
      lastVerified,
      lastError,
      nextAttempt,
    }),
    stop() {
      stopped = true;
      fail();
    },
  };
}
module.exports = { createNasSupervisor };
