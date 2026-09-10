/**
 * Google Apps Script — receptor del espejo del Security Center.
 *
 * Pega este archivo en Extensiones -> Apps Script de la Google Sheet de
 * destino, sustituye SECRET por el mismo valor que SHEET_WEBAPP_SECRET de la
 * Edge Function, y despliega como Web App:
 *
 *   Implementar -> Nueva implementación -> Aplicación web
 *     Ejecutar como:            Yo
 *     Quién tiene acceso:       Cualquier usuario
 *   Copia la URL /exec resultante a SHEET_WEBAPP_URL de la Edge Function.
 *
 * "Cualquier usuario" es necesario porque la Edge Function llama sin cuenta
 * de Google; la autorización real es el `secret` del body. No expone datos:
 * doGet no existe y doPost solo ESCRIBE si el secreto coincide.
 *
 * Cada llamada trae { secret, sheet, headers[], rows[] }. Crea la pestaña
 * `sheet` si no existe, escribe la fila de cabecera una sola vez y añade las
 * filas al final. LockService serializa llamadas concurrentes para que dos
 * lotes no se pisen.
 */

var SECRET = 'PEGA_AQUI_EL_MISMO_VALOR_QUE_SHEET_WEBAPP_SECRET';

function doPost(e) {
  var out = function (obj) {
    return ContentService
      .createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON);
  };

  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return out({ ok: false, error: 'body no es JSON' });
  }

  if (!body || body.secret !== SECRET) {
    return out({ ok: false, error: 'unauthorized' });
  }

  var sheetName = String(body.sheet || 'unknown').replace(/[^\w\- ]/g, '').slice(0, 100) || 'unknown';
  var rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return out({ ok: true, appended: 0 });
  }
  var headers = (Array.isArray(body.headers) && body.headers.length)
    ? body.headers
    : Object.keys(rows[0]);

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return out({ ok: false, error: 'lock timeout' });
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
    }

    var values = rows.map(function (r) {
      return headers.map(function (h) {
        var v = r[h];
        return (v === null || v === undefined) ? '' : String(v);
      });
    });

    sheet
      .getRange(sheet.getLastRow() + 1, 1, values.length, headers.length)
      .setValues(values);

    return out({ ok: true, appended: values.length });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
