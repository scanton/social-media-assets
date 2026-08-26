/* ============================================================
   DECK VALIDATION

   Checks a Deck JSON against references/deck.schema.json.

   Deliberately not a JSON Schema library. This validates the subset the deck
   schema actually uses, which is small and fixed, and the point is that the
   nugget builder and the render route agree on the contract without either of
   them taking a dependency the other cannot have. The builder runs this in a
   browser; the render route runs it in node. Same file, same verdict.

   Errors are paths, not prose, because "beats/2/text is 137 characters, over
   the 120 limit" is actionable and "invalid deck" is not.
   ============================================================ */

const typeOf = v => Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;

function resolve(ref, root) {
  /* only local pointers, which is all the schema uses */
  const parts = ref.replace(/^#\//, '').split('/');
  let node = root;
  for (const p of parts) node = node?.[p.replace(/~1/g, '/').replace(/~0/g, '~')];
  return node;
}

function check(value, schema, root, path, errs) {
  if (!schema) return;
  if (schema.$ref) return check(value, resolve(schema.$ref, root), root, path, errs);

  const at = path || '(root)';

  if (schema.const !== undefined && value !== schema.const) {
    errs.push(`${at} must be ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errs.push(`${at} must be one of ${schema.enum.join(', ')}, got ${JSON.stringify(value)}`);
    return;
  }
  if (schema.type) {
    const t = typeOf(value);
    const ok = schema.type === 'integer'
      ? t === 'number' && Number.isInteger(value)
      : t === schema.type;
    if (!ok) { errs.push(`${at} must be ${schema.type}, got ${t}`); return; }
  }

  if (typeof value === 'string') {
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errs.push(`${at} is ${value.length} characters, over the ${schema.maxLength} limit`);
    }
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errs.push(`${at} is ${value.length} characters, under the ${schema.minLength} minimum`);
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errs.push(`${at} must be at least ${schema.minimum}, got ${value}`);
    if (schema.maximum !== undefined && value > schema.maximum) errs.push(`${at} must be at most ${schema.maximum}, got ${value}`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) errs.push(`${at} must be greater than ${schema.exclusiveMinimum}, got ${value}`);
  }

  if (Array.isArray(value) && schema.items) {
    value.forEach((v, i) => check(v, schema.items, root, `${at === '(root)' ? '' : at}/${i}`, errs));
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required || []) {
      if (!(key in value)) errs.push(`${at} is missing required field "${key}"`);
    }
    for (const [key, v] of Object.entries(value)) {
      const sub = schema.properties?.[key];
      if (!sub) {
        /* an unknown field is a fault, not a curiosity: it is nearly always a
           field one half of the contract writes and the other has not learned
           to read, which is the exact drift this schema exists to catch */
        if (schema.additionalProperties === false) {
          errs.push(`${at} has unknown field "${key}"`);
        }
        continue;
      }
      check(v, sub, root, `${at === '(root)' ? '' : at}/${key}`, errs);
    }
  }
}

/** Returns [] when the deck is valid, otherwise one message per fault. */
export function validateDeck(deck, schema) {
  const errs = [];
  check(deck, schema, schema, '', errs);
  return errs;
}

export default validateDeck;
