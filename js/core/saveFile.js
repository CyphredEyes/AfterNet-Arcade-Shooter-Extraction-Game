/* ===================================================================
   .ghsave file format
   ┌───────────────┬───────────┬──────────────┬────────────────────┐
   │ "GHSV" (4 B)  │ ver (1 B) │ CRC32 (4 B)  │ gzip(JSON) payload │
   └───────────────┴───────────┴──────────────┴────────────────────┘
   =================================================================== */

const MAGIC   = new Uint8Array([0x47, 0x48, 0x53, 0x56]); // "GHSV"
const VERSION = 1;
const HEADER_SIZE = 9;

/* ---- CRC32 (table-driven) ---- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* ---- gzip helpers (CompressionStream API, no dependency) ---- */
async function gzip(bytes) {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();

  const reader = cs.readable.getReader();
  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

async function gunzip(bytes) {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();

  const reader = ds.readable.getReader();
  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

/* ---- public API ---- */

export async function serialize(state) {
  const json = JSON.stringify(state);
  const jsonBytes = new TextEncoder().encode(json);
  const payload   = await gzip(jsonBytes);
  const checksum  = crc32(payload);

  const out = new Uint8Array(HEADER_SIZE + payload.length);
  out.set(MAGIC, 0);
  out[4] = VERSION;
  new DataView(out.buffer).setUint32(5, checksum, true);
  out.set(payload, HEADER_SIZE);
  return out;
}

export async function deserialize(bytes) {
  if (!bytes || bytes.length < HEADER_SIZE) {
    throw new Error('Save file too small to be valid.');
  }
  for (let i = 0; i < 4; i++) {
    if (bytes[i] !== MAGIC[i]) throw new Error('Not a Green Horizon save file.');
  }
  const version = bytes[4];
  if (version !== VERSION) {
    throw new Error(`Unsupported save version: ${version} (expected ${VERSION}).`);
  }
  const checksum = new DataView(bytes.buffer, bytes.byteOffset).getUint32(5, true);
  const payload  = bytes.slice(HEADER_SIZE);
  if (crc32(payload) !== checksum) {
    throw new Error('Save file corrupted (checksum mismatch).');
  }
  const jsonBytes = await gunzip(payload);
  const json = new TextDecoder().decode(jsonBytes);
  return JSON.parse(json);
}