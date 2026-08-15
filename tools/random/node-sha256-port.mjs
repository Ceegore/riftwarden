import { createHash } from 'node:crypto';

export const nodeSha256 = async (bytes) => createHash('sha256').update(bytes).digest('hex');
