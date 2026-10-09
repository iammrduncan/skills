// ceiling: at most 32 jobs; review a larger bound before changing it.
export const enqueue = (queue, job) => {
  if (queue.length >= 32) throw new Error('queue full');
  return [...queue, job];
};
