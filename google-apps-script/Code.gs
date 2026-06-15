const API_TOKEN = ''; // Optional. Put the same value in VITE_GOOGLE_SCRIPT_TOKEN if you want a simple shared secret.
const IMAGE_FOLDER_NAME = 'VeloStock Item Images';

const TABLE_HEADERS = {
  users: ['id', 'email', 'password_hash', 'salt', 'created_at'],
  rooms: ['id', 'user_id', 'name', 'created_at'],
  boxes: ['id', 'room_id', 'user_id', 'name', 'created_at', 'updated_at', 'archived'],
  inventory_items: [
    'id',
    'user_id',
    'box_id',
    'name',
    'sku',
    'description',
    'category',
    'quantity',
    'min_stock_level',
    'price',
    'location',
    'image_url',
    'purchase_date',
    'created_at',
    'updated_at',
  ],
  stock_transactions: [
    'id',
    'item_id',
    'user_id',
    'type',
    'quantity',
    'notes',
    'movement_reason',
    'from_box_id',
    'to_box_id',
    'related_item_id',
    'created_at',
  ],
  item_movements: ['id', 'user_id', 'item_id', 'from_box_id', 'to_box_id', 'notes', 'created_at'],
  box_movements: ['id', 'user_id', 'box_id', 'from_room_id', 'to_room_id', 'notes', 'created_at'],
  categories: ['id', 'user_id', 'name', 'is_default', 'sort_order', 'created_at'],
  user_settings: ['id', 'user_id', 'settings', 'updated_at', 'created_at'],
};

const USER_TABLES = Object.keys(TABLE_HEADERS).filter((name) => name !== 'users');

function doGet() {
  setupSheets_();
  return json_({ data: { ok: true, message: 'VeloStock Google Sheet API is ready.' }, error: null });
}

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.payload) {
      const payload = JSON.parse(e.parameter.payload || '{}');
      return response_(handleApi_(payload), e.parameter.callback);
    }

    setupSheets_();

    return response_(
      {
        data: {
          ok: true,
          message: 'VeloStock Google Sheet API is ready.',
        },
        error: null,
      },
      e && e.parameter && e.parameter.callback,
    );
  } catch (err) {
    return response_(
      errorResponse_(err),
      e && e.parameter && e.parameter.callback,
    );
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || '{}');
    return response_(handleApi_(payload));
  } catch (err) {
    return response_(errorResponse_(err));
  }
}

function handleApi_(payload) {
  if (API_TOKEN && payload.token !== API_TOKEN) {
    throw new Error('Invalid API token.');
  }

  setupSheets_();

  switch (payload.action) {
    case 'auth':
      return { data: handleAuth_(payload), error: null };

    case 'select':
      return { data: selectRows_(payload), error: null };

    case 'insert':
      return { data: insertRows_(payload), error: null };

    case 'update':
      return { data: updateRows_(payload), error: null };

    case 'delete':
      return { data: deleteRows_(payload), error: null };

    case 'upsert':
      return { data: upsertRows_(payload), error: null };

    case 'rpc':
      return { data: runRpc_(payload), error: null };

    case 'upload':
      return { data: uploadFile_(payload), error: null };

    default:
      throw new Error('Unknown action: ' + payload.action);
  }
}

function errorResponse_(err) {
  return {
    data: null,
    error: {
      message: String(err && err.message ? err.message : err),
    },
  };
}

function response_(value, callback) {
  const text = JSON.stringify(value);

  if (callback) {
    const safeCallback = String(callback);

    if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(safeCallback)) {
      return ContentService
        .createTextOutput(
          JSON.stringify(errorResponse_(new Error('Invalid JSONP callback.'))),
        )
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(safeCallback + '(' + text + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(text)
    .setMimeType(ContentService.MimeType.JSON);
}

function setupSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABLE_HEADERS).forEach((table) => {
    const headers = TABLE_HEADERS[table];
    let sheet = ss.getSheetByName(table);
    if (!sheet) sheet = ss.insertSheet(table);

    const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    const isEmpty = firstRow.every((value) => value === '');

    if (isEmpty) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      return;
    }

    const existing = firstRow.filter(String);
    headers.forEach((header) => {
      if (existing.indexOf(header) === -1) {
        sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      }
    });
  });
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function now_() {
  return new Date().toISOString();
}

function uuid_() {
  return Utilities.getUuid();
}

function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function hashPassword_(password, salt) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt) + '::' + String(password));
  return raw.map((byte) => ('0' + (byte & 0xff).toString(16)).slice(-2)).join('');
}

function handleAuth_(payload) {
  const email = normalizeEmail_(payload.email);
  const password = String(payload.password || '');

  if (!email) throw new Error('Email is required.');
  if (password.length < 4) throw new Error('Password must be at least 4 characters.');

  const users = readTable_('users');
  const existing = users.rows.find((row) => row.email === email);

  if (payload.mode === 'sign-up') {
    if (existing) throw new Error('This email already exists. Please sign in.');

    const salt = uuid_();
    const user = {
      id: uuid_(),
      email,
      password_hash: hashPassword_(password, salt),
      salt,
      created_at: now_(),
    };

    appendRows_('users', [user]);
    return { user: { id: user.id, email: user.email } };
  }

  if (!existing) throw new Error('No account found for this email. Please sign up first.');

  const incomingHash = hashPassword_(password, existing.salt);
  if (incomingHash !== existing.password_hash) {
    throw new Error('Incorrect password.');
  }

  return { user: { id: existing.id, email: existing.email } };
}

function readTable_(table) {
  if (!TABLE_HEADERS[table]) throw new Error('Unknown table: ' + table);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(table);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 1 || lastColumn < 1) {
    return { sheet, headers: TABLE_HEADERS[table], rows: [] };
  }

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].filter(String);
  const values = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, headers.length).getValues() : [];
  const rows = values.map((row, index) => {
    const obj = { __rowNumber: index + 2 };
    headers.forEach((header, colIndex) => {
      obj[header] = parseCell_(header, row[colIndex]);
    });
    return obj;
  });

  return { sheet, headers, rows };
}

function parseCell_(header, value) {
  if (value === '') return '';
  if (value instanceof Date) return value.toISOString();
  if (header === 'archived' || header === 'is_default') return value === true || value === 'true' || value === 'TRUE';
  if (header === 'quantity' || header === 'min_stock_level' || header === 'sort_order') return Number(value || 0);
  if (header === 'price') return Number(value || 0);
  if (header === 'settings') {
    try {
      return typeof value === 'string' ? JSON.parse(value) : value;
    } catch (_err) {
      return value;
    }
  }
  return value;
}

function toCell_(header, value) {
  if (value === undefined || value === null) return '';
  if (header === 'settings' && typeof value !== 'string') return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function publicRow_(row) {
  const out = {};
  Object.keys(row).forEach((key) => {
    if (key !== '__rowNumber') out[key] = row[key];
  });
  return out;
}

function withDefaults_(table, row, userId) {
  const at = now_();
  const copy = Object.assign({}, row);

  if (!copy.id) copy.id = uuid_();
  if (USER_TABLES.indexOf(table) >= 0 && !copy.user_id && userId) copy.user_id = userId;
  if (!copy.created_at) copy.created_at = at;
  if ((table === 'boxes' || table === 'inventory_items' || table === 'user_settings') && !copy.updated_at) copy.updated_at = at;
  if (table === 'boxes' && copy.archived === undefined) copy.archived = false;
  if (table === 'inventory_items') {
    if (copy.category === undefined || copy.category === '') copy.category = 'General';
    if (copy.quantity === undefined || copy.quantity === '') copy.quantity = 0;
    if (copy.min_stock_level === undefined || copy.min_stock_level === '') copy.min_stock_level = 5;
    if (copy.price === undefined || copy.price === '') copy.price = 0;
  }
  if (table === 'categories') {
    if (copy.is_default === undefined || copy.is_default === '') copy.is_default = false;
    if (copy.sort_order === undefined || copy.sort_order === '') copy.sort_order = 0;
  }

  return copy;
}

function filterRows_(rows, payload, table) {
  let filtered = rows.slice();
  const filters = payload.filters || [];

  if (USER_TABLES.indexOf(table) >= 0 && payload.userId && !filters.some((filter) => filter.column === 'user_id')) {
    filtered = filtered.filter((row) => String(row.user_id || '') === String(payload.userId));
  }

  filters.forEach((filter) => {
    filtered = filtered.filter((row) => String(row[filter.column] ?? '') === String(filter.value ?? ''));
  });

  return filtered;
}

function orderRows_(rows, order) {
  if (!order) return rows;
  return rows.slice().sort((a, b) => {
    const aValue = a[order.column];
    const bValue = b[order.column];
    const direction = order.ascending ? 1 : -1;

    if (aValue === bValue) return 0;
    if (aValue === undefined || aValue === null || aValue === '') return 1;
    if (bValue === undefined || bValue === null || bValue === '') return -1;
    return aValue > bValue ? direction : -direction;
  });
}

function selectRows_(payload) {
  const tableData = readTable_(payload.table);
  let rows = filterRows_(tableData.rows, payload, payload.table);
  rows = orderRows_(rows, payload.order);
  rows = rows.map(publicRow_);

  if (payload.table === 'stock_transactions') {
    const items = readTable_('inventory_items').rows;
    rows = rows.map((row) => {
      const item = items.find((i) => i.id === row.item_id);
      return Object.assign({}, row, {
        inventory_items: item ? { name: item.name, sku: item.sku } : null,
      });
    });
  }

  if (payload.single) {
    if (rows.length !== 1) throw new Error('Expected one row, found ' + rows.length + '.');
    return rows[0];
  }

  if (payload.maybeSingle) {
    return rows.length ? rows[0] : null;
  }

  return rows;
}

function appendRows_(table, rows) {
  const tableData = readTable_(table);
  const headers = tableData.headers;
  const values = rows.map((row) => headers.map((header) => toCell_(header, row[header])));

  if (values.length > 0) {
    tableData.sheet.getRange(tableData.sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
  }
}

function insertRows_(payload) {
  const input = Array.isArray(payload.values) ? payload.values : [payload.values];
  const rows = input.map((row) => withDefaults_(payload.table, row || {}, payload.userId));
  appendRows_(payload.table, rows);
  const result = rows.map(publicRow_);
  return payload.single ? result[0] : result;
}

function updateRows_(payload) {
  const tableData = readTable_(payload.table);
  const rows = filterRows_(tableData.rows, payload, payload.table);
  const values = Object.assign({}, payload.values || {});

  if (payload.table === 'boxes' || payload.table === 'inventory_items' || payload.table === 'user_settings') {
    values.updated_at = now_();
  }

  rows.forEach((row) => {
    tableData.headers.forEach((header, index) => {
      if (Object.prototype.hasOwnProperty.call(values, header)) {
        tableData.sheet.getRange(row.__rowNumber, index + 1).setValue(toCell_(header, values[header]));
        row[header] = values[header];
      }
    });
  });

  return rows.map(publicRow_);
}

function upsertRows_(payload) {
  const tableData = readTable_(payload.table);
  const input = Array.isArray(payload.values) ? payload.values : [payload.values];
  const conflict = payload.onConflict || 'id';
  const result = [];

  input.forEach((raw) => {
    const row = withDefaults_(payload.table, raw || {}, payload.userId);
    const existing = tableData.rows.find((item) => String(item[conflict] || '') === String(row[conflict] || ''));

    if (existing) {
      const updatePayload = {
        table: payload.table,
        userId: payload.userId,
        filters: [{ column: conflict, value: row[conflict] }],
        values: row,
      };
      result.push.apply(result, updateRows_(updatePayload));
    } else {
      appendRows_(payload.table, [row]);
      result.push(publicRow_(row));
    }
  });

  return payload.single ? result[0] : result;
}

function deleteRows_(payload) {
  const table = payload.table;
  const tableData = readTable_(table);
  const rows = filterRows_(tableData.rows, payload, table);
  const rowNumbers = rows.map((row) => row.__rowNumber).sort((a, b) => b - a);

  if (table === 'rooms') {
    rows.forEach((room) => cascadeDeleteRoom_(room.id, payload.userId));
  }

  if (table === 'boxes') {
    rows.forEach((box) => cascadeDeleteBox_(box.id, payload.userId));
  }

  if (table === 'inventory_items') {
    rows.forEach((item) => cascadeDeleteItem_(item.id, payload.userId));
  }

  rowNumbers.forEach((rowNumber) => tableData.sheet.deleteRow(rowNumber));
  return rows.map(publicRow_);
}

function cascadeDeleteRoom_(roomId, userId) {
  const boxes = readTable_('boxes').rows.filter((box) => box.room_id === roomId && (!userId || box.user_id === userId));
  boxes.forEach((box) => {
    cascadeDeleteBox_(box.id, userId);
    deleteByFilters_('boxes', [{ column: 'id', value: box.id }], userId);
  });
}

function cascadeDeleteBox_(boxId, userId) {
  const items = readTable_('inventory_items').rows.filter((item) => item.box_id === boxId && (!userId || item.user_id === userId));
  items.forEach((item) => {
    cascadeDeleteItem_(item.id, userId);
    deleteByFilters_('inventory_items', [{ column: 'id', value: item.id }], userId);
  });
}

function cascadeDeleteItem_(itemId, userId) {
  deleteByFilters_('stock_transactions', [{ column: 'item_id', value: itemId }], userId);
  deleteByFilters_('item_movements', [{ column: 'item_id', value: itemId }], userId);
}

function deleteByFilters_(table, filters, userId) {
  deleteRows_({ table, filters, userId });
}

function runRpc_(payload) {
  if (payload.fn !== 'transfer_inventory_item') throw new Error('Unknown RPC: ' + payload.fn);
  return transferInventoryItem_(payload.userId, payload.params || {});
}

function transferInventoryItem_(userId, params) {
  const itemId = params.p_item_id;
  const toBoxId = params.p_to_box_id;
  const quantity = Number(params.p_quantity || 0);
  const reason = params.p_reason || '';

  if (!userId) throw new Error('User is not signed in.');
  if (!itemId || !toBoxId) throw new Error('Missing transfer details.');
  if (!quantity || quantity <= 0) throw new Error('Transfer quantity must be greater than zero.');

  const itemData = readTable_('inventory_items');
  const source = itemData.rows.find((item) => item.id === itemId && item.user_id === userId);
  if (!source) throw new Error('Source item not found.');
  if (Number(source.quantity) < quantity) throw new Error('Not enough stock available.');

  const fromBoxId = source.box_id || '';
  let relatedItemId = itemId;

  if (Number(source.quantity) === quantity) {
    updateRows_({
      table: 'inventory_items',
      userId,
      filters: [{ column: 'id', value: itemId }],
      values: { box_id: toBoxId },
    });
  } else {
    updateRows_({
      table: 'inventory_items',
      userId,
      filters: [{ column: 'id', value: itemId }],
      values: { quantity: Number(source.quantity) - quantity },
    });

    const clone = Object.assign({}, publicRow_(source), {
      id: uuid_(),
      box_id: toBoxId,
      quantity,
      created_at: now_(),
      updated_at: now_(),
    });
    appendRows_('inventory_items', [clone]);
    relatedItemId = clone.id;
  }

  appendRows_('stock_transactions', [
    withDefaults_(
      'stock_transactions',
      {
        item_id: itemId,
        user_id: userId,
        type: 'TRANSFER',
        quantity,
        notes: reason ? 'Moved stock: ' + reason : 'Moved stock',
        movement_reason: reason,
        from_box_id: fromBoxId,
        to_box_id: toBoxId,
        related_item_id: relatedItemId,
      },
      userId,
    ),
  ]);

  appendRows_('item_movements', [
    withDefaults_(
      'item_movements',
      {
        user_id: userId,
        item_id: itemId,
        from_box_id: fromBoxId,
        to_box_id: toBoxId,
        notes: reason,
      },
      userId,
    ),
  ]);

  return { ok: true };
}

function uploadFile_(payload) {
  const dataUrl = String(payload.dataUrl || '');
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) throw new Error('Invalid upload data.');

  const mimeType = payload.mimeType || match[1] || 'application/octet-stream';
  const bytes = Utilities.base64Decode(match[2]);
  const safeName = String(payload.path || payload.filename || uuid_()).replace(/[\\/:*?"<>|]/g, '_');
  const blob = Utilities.newBlob(bytes, mimeType, safeName);
  const folder = getImageFolder_();
  const file = folder.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    publicUrl: 'https://drive.google.com/uc?export=view&id=' + file.getId(),
  };
}

function getImageFolder_() {
  const folders = DriveApp.getFoldersByName(IMAGE_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(IMAGE_FOLDER_NAME);
}
