"use client";

/**
 * A minimal, store-only ZIP writer.
 *
 * The export is one video and one JSON. The video is already compressed —
 * deflating an MP4 buys nothing — and the JSON is a few kilobytes, so the
 * compression a library would add is not worth a dependency for it. Store-only
 * archives are ordinary ZIPs: every unzipper reads them.
 *
 * No ZIP64, no encryption, no directory entries. If an export ever needs to
 * carry something over 4GB, this is the thing to replace rather than extend.
 */

/** CRC-32, table built once. */
const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array<ArrayBuffer>): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS date/time, which is what the format stores. */
function dosStamp(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export interface ZipEntry {
  name: string;
  bytes: Uint8Array<ArrayBuffer>;
}

export function makeZip(entries: ZipEntry[], now = new Date()): Blob {
  const { time, date } = dosStamp(now);
  const enc = new TextEncoder();
  const chunks: BlobPart[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (const e of entries) {
    const name = Uint8Array.from(enc.encode(e.name)) as Uint8Array<ArrayBuffer>;
    const crc = crc32(e.bytes);
    const size = e.bytes.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // local file header
    local.setUint16(4, 20, true);         // version needed
    local.setUint16(6, 0x0800, true);     // UTF-8 names
    local.setUint16(8, 0, true);          // stored, not deflated
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);

    chunks.push(new Uint8Array(local.buffer), name, e.bytes);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);   // central directory header
    dir.setUint16(4, 20, true);           // version made by
    dir.setUint16(6, 20, true);           // version needed
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 0, true);
    dir.setUint16(12, time, true);
    dir.setUint16(14, date, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, size, true);
    dir.setUint32(24, size, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);      // where its local header sits

    const row = new Uint8Array(46 + name.length);
    row.set(new Uint8Array(dir.buffer), 0);
    row.set(name, 46);
    central.push(row);

    offset += 30 + name.length + size;
  }

  const centralSize = central.reduce((n, r) => n + r.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);     // end of central directory
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], {
    type: "application/zip",
  });
}
