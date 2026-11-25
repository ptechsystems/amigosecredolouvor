export function randomIndex(size) {
  const buffer = new Uint32Array(1);
  const range = 2 ** 32;
  const limit = range - range % size;
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % size;
}

export function makeDraw(count) {
  if (!Number.isInteger(count) || count < 2 || count > 100) {
    throw new RangeError("O sorteio precisa de 2 a 100 participantes.");
  }

  const order = Array.from({length: count}, (_, i) => i);
  // Reject fixed points to give every valid assignment the same probability.
  do {
    for (let i = count - 1; i > 0; i--) {
      const j = randomIndex(i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
  } while (order.some((recipient, giver) => recipient === giver));
  return order;
}
