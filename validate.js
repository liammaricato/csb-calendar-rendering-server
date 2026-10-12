// Validation and normalization of the calendar data (used by server.js).

const ICONS = ['shuttlecock', 'coffee', 'trophy'];
const STATUSES = ['normal', 'highlight', 'done', 'cancelled'];
const MAX_ITEMS = 8;

function text(v, field, max, required, errors) {
  if (v == null || v === '') {
    if (required) errors.push(`${field}: required`);
    return '';
  }
  if (typeof v !== 'string') { errors.push(`${field}: must be a string`); return ''; }
  const s = v.trim();
  if (s.length > max) errors.push(`${field}: at most ${max} characters (has ${s.length})`);
  return s;
}

function validate(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['the body must be a JSON object'] };
  }

  const data = {
    month: text(input.month, 'month', 16, true, errors).toUpperCase(),
    items: [],
  };

  const items = input.items;
  if (!Array.isArray(items) || items.length === 0) {
    errors.push('items: must have at least 1 item');
  } else if (items.length > MAX_ITEMS) {
    errors.push(`items: at most ${MAX_ITEMS} per art (has ${items.length})`);
  } else {
    items.forEach((it, i) => {
      const p = `items[${i}]`;
      if (!it || typeof it !== 'object') { errors.push(`${p}: must be an object`); return; }
      const date = text(it.date, `${p}.date`, 10, true, errors);
      const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
      let order = 0;
      if (!m) {
        errors.push(`${p}.date: use the DD/MM/YYYY format, e.g. 06/11/2026`);
      } else {
        const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
        const d = new Date(Date.UTC(year, month - 1, day));
        if (year < 2020 || year > 2100 || d.getUTCDate() !== day || d.getUTCMonth() !== month - 1) {
          errors.push(`${p}.date: ${date} is not a valid date`);
        }
        order = d.getTime();
      }
      const icon = it.icon || 'shuttlecock';
      const status = it.status || 'normal';
      if (!ICONS.includes(icon)) errors.push(`${p}.icon: use ${ICONS.join(', ')}`);
      if (!STATUSES.includes(status)) errors.push(`${p}.status: use ${STATUSES.join(', ')}`);
      data.items.push({
        date,
        title: text(it.title, `${p}.title`, 28, true, errors).toUpperCase(),
        description: text(it.description, `${p}.description`, 70, false, errors),
        icon,
        status,
        _order: order,
      });
    });
    data.items.sort((a, b) => a._order - b._order);
    data.items.forEach((it) => delete it._order);
  }

  return errors.length ? { ok: false, errors } : { ok: true, data };
}

module.exports = { validate, ICONS, STATUSES, MAX_ITEMS };
