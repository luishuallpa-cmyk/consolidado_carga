/**
 * IEM · Consolidado de carga diario
 * - Catálogo desde Supabase (Fríos / Secos)
 * - Líneas por camión + vista consolidada
 * - Excel estilo referencia + descuento de stock opcional
 */
(function () {
  'use strict';

  var cfg = window.IEM_CONFIG || {};
  var supabase = null;
  var catalogo = []; // {codigo, descripcion, codigo_fabrica, unidad_ref, factor, stock, tipo, marca, activo}
  var lineas = []; // {camion, codigo, descripcion, tipo, unidad_ref, factor, cantidad, codigo_fabrica}
  var productoSel = null;
  var vista = 'detalle'; // detalle | consolidado
  var STORAGE_KEY = 'iem_consolidado_carga_v1';
  var lastImportFiles = null; // FileList o array para re-leer carpeta
  var dirHandleCarga = null; // FileSystemDirectoryHandle (Chrome/Edge)
  var lastCarpetaSig = ''; // nombre|mtime del último Excel procesado
  var _watchCarpetaTimer = null;
  var _watchCarpetaBusy = false;
  var IDB_NAME = 'iem_consolidado_fs';
  var IDB_STORE = 'handles';

  function $(id) { return document.getElementById(id); }

  /** Día siguiente; si cae domingo → lunes */
  function fechaRepartoSiguiente(desde) {
    var d = desde ? new Date(desde) : new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    // 0 = domingo
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function aplicarFechaReparto() {
    var iso = fechaRepartoSiguiente();
    var el = $('consFecha');
    if (el) el.value = iso;
    var lab = $('consFechaLabel');
    if (lab) {
      try {
        var p = iso.split('-');
        lab.textContent = p[2] + '/' + p[1] + '/' + p[0];
      } catch (e) { lab.textContent = iso; }
    }
    return iso;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function status(msg) {
    var el = $('consStatus');
    if (el) el.textContent = msg;
  }
  function toast(msg) {
    status(msg);
    try { console.log('[consolidado]', msg); } catch (e) {}
  }

  function tipoDe(p) {
    var t = String((p && (p.tipo_almacen || p.tipo)) || '').toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (t.indexOf('FRIO') !== -1) return 'FRIOS';
    if (t.indexOf('SECO') !== -1) return 'SECOS';
    return '';
  }

  /** Misma lógica orientativa que inventario: tipo_almacen > línea > descripción */
  function clasificarProducto(p) {
    if (!p) return 'SECOS';
    var t = tipoDe(p);
    if (t === 'FRIOS' || t === 'SECOS') return t;
    var blob = (
      String(p.linea || '') + ' ' +
      String(p.descripcion || '') + ' ' +
      String(p.marca || '')
    ).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Fríos típicos Laive / IEM
    if (/YOGUR|YOG\.|QUESO|MANTEQUILL|CREMA DE|LECHE FRES|UHT |SALCHICH|JAMON|JAMÓN|CHORIZ|HOT DOG|TOCIN|JAMONADA|MORTADEL|CHICHARRON|MOZZARELL|EDAM|PARMESANO|CHEDDAR|BIO DEFENSA|GRIEGO|PROBIOT|CREAM CHEESE|MARGARINA SWIS POTE/.test(blob)) {
      return 'FRIOS';
    }
    // Secos / ambient
    if (/EVAPORAD|BOLSITARRO|PRACTITARRO|MANJAR|FUDGE|WATTS|BEBIDA|ALMENDRA|NUTRILAC|SIROPE|BASE DE HELADO|DULCE DE LECHE/.test(blob)) {
      return 'SECOS';
    }
    return 'SECOS';
  }

  function actualizarSelectCamiones() {
    var cams = {};
    lineas.forEach(function (l) {
      if (l.camion) cams[l.camion] = true;
    });
    var lista = Object.keys(cams).sort();
    ['consCamion', 'consFiltroCamion'].forEach(function (id) {
      var sel = $(id);
      if (!sel) return;
      var prev = sel.value;
      var esFiltro = id === 'consFiltroCamion';
      sel.innerHTML = esFiltro
        ? "<option value=''>Todos los camiones</option>"
        : "<option value=''>— Elegir camión —</option>";
      lista.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        sel.appendChild(opt);
      });
      if (prev && cams[prev]) sel.value = prev;
      else if (!esFiltro && lista.length === 1) sel.value = lista[0];
    });
  }

  function enriquecerDesdeCatalogo() {
    if (!lineas.length) return;
    lineas.forEach(function (l) {
      l.codigo = normCodigo4(l.codigo) || String(l.codigo || '').trim();
      var cat = productoPorCodigo(l.codigo);
      if (cat) {
        l.tipo = tipoPorCodigo(l.codigo, cat.descripcion, cat.linea);
        l.linea = cat.linea || l.linea || '';
        if (cat.descripcion) l.descripcion = cat.descripcion;
        l.codigo_fabrica = cat.codigo_fabrica || l.codigo_fabrica || '';
        if (cat.factor > 1 && !(l.factor > 1)) l.factor = cat.factor;
        if (!l.unidad_ref && cat.unidad_ref) l.unidad_ref = cat.unidad_ref;
      } else {
        l.tipo = tipoPorCodigo(l.codigo, l.descripcion, l.linea);
      }
      l._categoria = categoriaDeItem(l);
    });
  }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (o && Array.isArray(o.lineas)) lineas = o.lineas;
      if (o && o.fecha && $('consFecha')) $('consFecha').value = o.fecha;
    } catch (e) {}
  }
  function saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        fecha: ($('consFecha') || {}).value || '',
        lineas: lineas
      }));
    } catch (e) {}
  }

  function normKey(k) {
    return String(k || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s._\-]+/g, '')
      .toUpperCase();
  }

  function valRow(row, names) {
    if (!row) return '';
    var map = {};
    Object.keys(row).forEach(function (k) { map[normKey(k)] = k; });
    for (var i = 0; i < names.length; i++) {
      var real = map[normKey(names[i])];
      if (real !== undefined && row[real] !== undefined && row[real] !== null && String(row[real]).trim() !== '') {
        return row[real];
      }
    }
    return '';
  }

  /** Parsea Excel del macro: EntidadNombre + ConsolidadoComprobanteProducto* */
  function filasMacroALineas(filas) {
    var out = [];
    (filas || []).forEach(function (row) {
      var camion = String(valRow(row, [
        'EntidadNombre', 'Entidad Nombre', 'Camion', 'Camión', 'Ruta'
      ])).trim();
      var codigo = String(valRow(row, [
        'ConsolidadoComprobanteProductoCodigo',
        'Consolidado Comprobante Producto Codigo',
        'Codigo', 'Código', 'ProductoCodigo'
      ])).trim();
      if (!codigo) return;
      // Normalizar Uniflex cortos
      if (/^\d{1,3}$/.test(codigo)) codigo = ('0000' + codigo).slice(-4);
      var desc = String(valRow(row, [
        'ConsolidadoComprobanteProductoDescripcion',
        'Consolidado Comprobante Producto Descripcion',
        'Producto', 'Descripcion', 'Descripción'
      ])).trim();
      var und = String(valRow(row, [
        'ConsolidadoComprobanteProductoUnidadBase',
        'UnidadBase', 'Unidad'
      ])).trim();
      var uref = String(valRow(row, [
        'ConsolidadoComprobanteProductoUnidadReferencia',
        'UnidadReferencia', 'Unidad Ref'
      ])).trim();
      var factor = parseFloat(String(valRow(row, [
        'ConsolidadoComprobanteProductoFactorReferencia',
        'FactorReferencia', 'Factor'
      ])).replace(',', '.')) || 1;
      var cant = parseFloat(String(valRow(row, [
        'ConsolidadoComprobanteCantidad',
        'Cantidad', 'ConsolidadoComprobanteCantidad'
      ])).replace(',', '.')) || 0;
      if (!(cant > 0)) return;
      if (!camion) camion = 'SIN CAMION';
      var peso = parseFloat(String(valRow(row, [
        'ConsolidadoComprobantePeso', 'Peso', 'Peso/Obs', 'PesoObs'
      ])).replace(',', '.'));
      if (!isFinite(peso)) peso = 0;

      var cat = catalogo.find(function (p) { return p.codigo === codigo; });
      var tipo = cat ? cat.tipo : clasificarProducto({ descripcion: desc });
      var fab = cat ? cat.codigo_fabrica : '';
      var linCat = cat ? (cat.linea || '') : '';
      if (!desc && cat) desc = cat.descripcion;
      if (!uref && cat) uref = cat.unidad_ref;
      if (!(factor > 1) && cat && cat.factor > 1) factor = cat.factor;

      out.push({
        camion: camion,
        codigo: codigo,
        descripcion: desc || codigo,
        tipo: tipo,
        linea: linCat,
        unidad_ref: uref || und || '',
        factor: factor,
        cantidad: cant,
        peso: peso,
        codigo_fabrica: fab,
        _archivo: row.__archivo || ''
      });
    });
    return out;
  }

  function sheetToRows(wb) {
    var name = wb.SheetNames[0];
    // Prefer sheet with Consolidado in name
    for (var i = 0; i < wb.SheetNames.length; i++) {
      if (/consolidado|carga|general/i.test(wb.SheetNames[i])) {
        name = wb.SheetNames[i];
        break;
      }
    }
    var sheet = wb.Sheets[name];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  }


  function supportsDirPicker() {
    return typeof window.showDirectoryPicker === 'function';
  }

  function openIdb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  async function saveDirHandle(handle) {
    try {
      var db = await openIdb();
      await new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(handle, 'carga');
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
      db.close();
    } catch (e) {
      console.warn('[IEM] no se pudo guardar handle carpeta', e);
    }
  }

  async function loadDirHandle() {
    try {
      var db = await openIdb();
      var handle = await new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readonly');
        var req = tx.objectStore(IDB_STORE).get('carga');
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
      db.close();
      return handle || null;
    } catch (e) {
      return null;
    }
  }

  async function ensureDirPermission(handle, mode) {
    if (!handle) return false;
    mode = mode || 'read';
    try {
      var q = await handle.queryPermission({ mode: mode });
      if (q === 'granted') return true;
      var r = await handle.requestPermission({ mode: mode });
      return r === 'granted';
    } catch (e) {
      console.warn('[IEM] permiso carpeta', e);
      return false;
    }
  }

  function setCarpetaStatus(msg) {
    var el = $('consCarpetaStatus');
    if (el) {
      el.hidden = !msg;
      el.textContent = msg || '';
    }
  }

  /** Lista Excel de un DirectoryHandle; devuelve el más reciente. */
  async function pickNewestExcelFromDir(dirHandle) {
    var candidates = [];
    for await (var entry of dirHandle.values()) {
      if (entry.kind !== 'file') continue;
      if (!/\.(xlsx|xls|xlsm|csv)$/i.test(entry.name)) continue;
      // ignorar temporales de Excel (~$...)
      if (/^~\$-/.test(entry.name) || entry.name.indexOf('~$') === 0) continue;
      try {
        var file = await entry.getFile();
        candidates.push({ name: file.name, lastModified: file.lastModified, file: file, handle: entry });
      } catch (eF) {}
    }
    if (!candidates.length) return null;
    candidates.sort(function (a, b) { return b.lastModified - a.lastModified; });
    return candidates[0];
  }

  async function vincularCarpetaCarga() {
    if (!supportsDirPicker()) {
      alert('Tu navegador no permite vincular carpeta de forma permanente.\nUsa Chrome o Edge, o elige «Carpeta (una vez)».');
      return;
    }
    try {
      var handle = await window.showDirectoryPicker({
        id: 'iem-carga',
        mode: 'read',
        startIn: 'documents'
      });
      dirHandleCarga = handle;
      await saveDirHandle(handle);
      lastCarpetaSig = '';
      setCarpetaStatus('Carpeta: ' + (handle.name || 'vinculada') + ' · vigilando…');
      toast('Carpeta vinculada. Al reemplazar el Excel se actualizará solo.');
      await escanearCarpetaCarga(true);
      startWatchCarpeta();
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      console.warn(e);
      alert('No se pudo vincular la carpeta: ' + ((e && e.message) || e));
    }
  }

  /**
   * Lee la carpeta vinculada. Si hay Excel nuevo o forzar=true, importa y opcionalmente genera PDF.
   */
  async function escanearCarpetaCarga(forzar) {
    if (!dirHandleCarga || _watchCarpetaBusy) return;
    _watchCarpetaBusy = true;
    try {
      var ok = await ensureDirPermission(dirHandleCarga, 'read');
      if (!ok) {
        setCarpetaStatus('Permiso de carpeta revocado. Vuelve a vincular.');
        return;
      }
      var newest = await pickNewestExcelFromDir(dirHandleCarga);
      if (!newest) {
        setCarpetaStatus('Carpeta «' + (dirHandleCarga.name || '') + '»: sin Excel');
        return;
      }
      var sig = newest.name + '|' + newest.lastModified;
      setCarpetaStatus('📁 ' + newest.name + (forzar || sig !== lastCarpetaSig ? ' · leyendo…' : ' · al día'));
      if (!forzar && sig === lastCarpetaSig) return;

      await importarArchivos([newest.file]);
      lastCarpetaSig = sig;
      setCarpetaStatus('📁 ' + newest.name + ' · actualizado');

      var autoPdf = true;
      try {
        var cb = $('consAutoPdf');
        if (cb) autoPdf = !!cb.checked;
      } catch (eC) {}
      if (autoPdf && lineas && lineas.length) {
        try {
          // PDF de todos los camiones (vista multi)
          if (typeof renderVistaPreviaPanel === 'function') {
            renderVistaPreviaPanel('multi');
          }
        } catch (eP) {
          console.warn('[IEM] auto PDF', eP);
        }
      }
    } catch (e) {
      console.warn('[IEM] escanear carpeta', e);
      setCarpetaStatus('Error leyendo carpeta');
    } finally {
      _watchCarpetaBusy = false;
    }
  }

  function startWatchCarpeta() {
    stopWatchCarpeta();
    if (!dirHandleCarga) return;
    _watchCarpetaTimer = setInterval(function () {
      if (document.body.classList.contains('mode-carga') || !$('consWorkspace') || !$('consWorkspace').hidden) {
        escanearCarpetaCarga(false);
      }
    }, 12000); // cada 12 s
  }

  function stopWatchCarpeta() {
    if (_watchCarpetaTimer) {
      clearInterval(_watchCarpetaTimer);
      _watchCarpetaTimer = null;
    }
  }

  async function restaurarCarpetaVinculada() {
    if (!supportsDirPicker()) return;
    try {
      var h = await loadDirHandle();
      if (!h) return;
      dirHandleCarga = h;
      var ok = await ensureDirPermission(h, 'read');
      if (!ok) {
        setCarpetaStatus('Carpeta guardada: toca «Vincular» para dar permiso de nuevo');
        return;
      }
      setCarpetaStatus('Carpeta: ' + (h.name || 'vinculada') + ' · actualizando…');
      startWatchCarpeta();
      // Al abrir la app: leer Excel más reciente y armar vista
      await escanearCarpetaCarga(true);
    } catch (e) {
      console.warn('[IEM] restaurar carpeta', e);
    }
  }

  async function importarArchivos(fileList) {
    if (!window.XLSX) {
      alert('XLSX no cargó.');
      return;
    }
    var files = Array.prototype.slice.call(fileList || []).filter(function (f) {
      return /\.(xlsx|xls|xlsm|csv)$/i.test(f.name);
    });
    if (!files.length) {
      toast('No hay Excel en la selección.');
      return;
    }
    lastImportFiles = files;
    var st = $('consImportStatus');
    if (st) st.textContent = 'Leyendo ' + files.length + ' archivo(s)…';
    var todas = [];
    var errores = 0;
    for (var i = 0; i < files.length; i++) {
      try {
        var buf = await files[i].arrayBuffer();
        var wb = XLSX.read(buf, { type: 'array' });
        var filas = sheetToRows(wb);
        filas.forEach(function (r) { r.__archivo = files[i].name; });
        var parsed = filasMacroALineas(filas);
        todas = todas.concat(parsed);
      } catch (e) {
        errores++;
        console.warn(files[i].name, e);
      }
    }
    if (!todas.length) {
      if (st) st.textContent = 'No se leyeron líneas. ¿Es el Excel de consolidado de carga (EntidadNombre + código producto)?';
      alert('No se encontraron líneas del formato consolidado de carga.');
      return;
    }
    lineas = todas;
    enriquecerDesdeCatalogo();
    actualizarSelectCamiones();
    aplicarFechaReparto();
    saveLocal();
    vista = 'detalle';
    renderTabla();
    var camiones = {};
    lineas.forEach(function (l) { camiones[l.camion] = true; });
    var msg = 'Importados ' + lineas.length + ' líneas de ' + files.length + ' archivo(s) · ' +
      Object.keys(camiones).length + ' camión(es)' + (errores ? ' · ' + errores + ' archivo(s) con error' : '');
    if (st) st.textContent = msg;
    toast(msg);
  }


  async function initSupabase() {
    var url = cfg.SUPABASE_URL || cfg.supabaseUrl;
    var key = cfg.SUPABASE_ANON_KEY || cfg.supabaseAnonKey || cfg.SUPABASE_KEY;
    if (!window.supabase) {
      status('Falta librería Supabase (CDN). Revisa internet.');
      return false;
    }
    if (!url || !key) {
      status('Falta config.js con SUPABASE_URL y SUPABASE_ANON_KEY (cópialo del inventario).');
      return false;
    }
    supabase = window.supabase.createClient(url, key);
    return true;
  }

  async function cargarCatalogo() {
    if (!supabase) return;
    status('Cargando catálogo…');
    catalogo = [];
    var from = 0;
    var PAGE = 1000;
    for (;;) {
      var res = await supabase
        .from('productos')
        .select('codigo,codigo_fabrica,descripcion,unidad_ref,factor_empaque,stock_teorico,tipo_almacen,marca,activo,linea')
        .order('codigo')
        .range(from, from + PAGE - 1);
      if (res.error) {
        // sin tipo_almacen
        if (/tipo_almacen/i.test(res.error.message || '')) {
          res = await supabase
            .from('productos')
            .select('codigo,codigo_fabrica,descripcion,unidad_ref,factor_empaque,stock_teorico,marca,activo,linea')
            .order('codigo')
            .range(from, from + PAGE - 1);
        }
        if (res.error) throw res.error;
      }
      if (!res.data || !res.data.length) break;
      res.data.forEach(function (p) {
        if (p.activo === false) return;
        var row = {
          codigo: String(p.codigo || '').trim(),
          codigo_fabrica: String(p.codigo_fabrica || '').trim(),
          descripcion: String(p.descripcion || '').trim(),
          unidad_ref: String(p.unidad_ref || '').trim(),
          factor: Number(p.factor_empaque) || 1,
          stock: Number(p.stock_teorico) || 0,
          tipo_almacen: String(p.tipo_almacen || '').trim(),
          linea: String(p.linea || '').trim(),
          marca: String(p.marca || '').trim()
        };
        row.tipo = clasificarProducto(row);
        catalogo.push(row);
      });
      if (res.data.length < PAGE) break;
      from += PAGE;
    }
    status('Catálogo Supabase: ' + catalogo.length + ' productos · Fríos/Secos/líneas listos');
    if (lineas.length) {
      enriquecerDesdeCatalogo();
      actualizarSelectCamiones();
      renderTabla();
    }
  }

  function buscar(q) {
    q = String(q || '').trim().toLowerCase();
    if (q.length < 1) return [];
    var out = [];
    for (var i = 0; i < catalogo.length && out.length < 40; i++) {
      var p = catalogo[i];
      var blob = (p.codigo + ' ' + p.descripcion + ' ' + p.codigo_fabrica).toLowerCase();
      if (blob.indexOf(q) >= 0) out.push(p);
    }
    return out;
  }

  function renderBusqueda() {
    var box = $('consResultados');
    var q = ($('consBuscar') || {}).value || '';
    if (!box) return;
    var hits = buscar(q);
    if (!hits.length || !String(q).trim()) {
      box.classList.remove('open');
      box.innerHTML = '';
      return;
    }
    box.innerHTML = hits.map(function (p) {
      return '<div class="cons-search-item" data-cod="' + esc(p.codigo) + '">' +
        '<strong>' + esc(p.codigo) + '</strong> · ' + esc(p.descripcion) +
        ' <span style="color:var(--c-muted)">(' + esc(p.tipo) + ' · stock ' + p.stock + ')</span></div>';
    }).join('');
    box.classList.add('open');
    box.querySelectorAll('.cons-search-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var cod = el.getAttribute('data-cod');
        productoSel = catalogo.find(function (x) { return x.codigo === cod; }) || null;
        if ($('consProdCodigo')) $('consProdCodigo').value = cod;
        if ($('consProdLabel')) {
          $('consProdLabel').value = productoSel
            ? (productoSel.codigo + ' — ' + productoSel.descripcion)
            : cod;
        }
        box.classList.remove('open');
        if ($('consBuscar')) $('consBuscar').value = '';
      });
    });
  }

  function agregarLinea() {
    var camion = String(($('consCamion') || {}).value || '').trim() || 'SIN CAMION';
    var cant = parseInt(($('consCant') || {}).value, 10);
    if (!productoSel) {
      toast('Elige un producto de la búsqueda.');
      return;
    }
    if (!cant || cant < 1) {
      toast('Cantidad inválida.');
      return;
    }
    // fusionar misma camión+código
    var prev = lineas.find(function (l) {
      return l.camion === camion && l.codigo === productoSel.codigo;
    });
    if (prev) {
      prev.cantidad += cant;
    } else {
      lineas.push({
        camion: camion,
        codigo: productoSel.codigo,
        descripcion: productoSel.descripcion,
        tipo: productoSel.tipo,
        unidad_ref: productoSel.unidad_ref,
        factor: productoSel.factor,
        cantidad: cant,
        peso: 0,
        codigo_fabrica: productoSel.codigo_fabrica
      });
    }
    saveLocal();
    renderTabla();
    if ($('consCant')) $('consCant').value = '1';
    toast('Agregado: ' + productoSel.codigo + ' × ' + cant + ' → ' + camion);
  }

  function consolidadoRows() {
    // suma por código (todos los camiones)
    var map = Object.create(null);
    lineas.forEach(function (l) {
      var k = l.codigo;
      if (!map[k]) {
        map[k] = {
          codigo: l.codigo,
          descripcion: l.descripcion,
          tipo: l.tipo,
          unidad_ref: l.unidad_ref,
          factor: l.factor,
          codigo_fabrica: l.codigo_fabrica,
          cantidad: 0
        };
      }
      map[k].cantidad += Number(l.cantidad) || 0;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) {
      if (a.tipo !== b.tipo) return a.tipo === 'FRIOS' ? -1 : 1;
      return String(a.codigo).localeCompare(String(b.codigo));
    });
  }

  function lineasFiltradas() {
    var ft = String(($('consFiltroTipo') || {}).value || '').toUpperCase();
    var fc = String(($('consFiltroCamion') || {}).value || '').trim();
    return lineas.filter(function (l) {
      if (ft === 'FRIOS' || ft === 'SECOS') {
        if (String(l.tipo || '').toUpperCase() !== ft) return false;
      }
      if (fc && String(l.camion || '') !== fc) return false;
      return true;
    });
  }

  function renderTabla() {
    document.querySelectorAll('[data-cons-vista]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-cons-vista') === vista);
    });
    try {
      renderVistaPreviaPanel();
    } catch (e) {
      console.error('renderVistaPreviaPanel', e);
      var inner = $('consPreviewInner');
      if (inner) {
        inner.innerHTML = '<p class="cons-preview-empty">Error al armar la vista previa: ' +
          String((e && e.message) || e).replace(/</g, '') + '</p>';
      }
    }
  }

  function construirHojasVista(modoForzado) {
    enriquecerLineas();
    var fecha = ($('consFecha') || {}).value || new Date().toISOString().slice(0, 10);
    var camiones = {};
    lineas.forEach(function (l) {
      var cam = String(l.camion || 'SIN CAMION').trim() || 'SIN CAMION';
      if (!camiones[cam]) camiones[cam] = [];
      camiones[cam].push(l);
    });
    var listaCam = Object.keys(camiones).sort();
    var hojas = [];
    var camSel = String(($('consCamion') || {}).value || ($('consFiltroCamion') || {}).value || '').trim();
    var modo = modoForzado || (camSel ? 'uno' : 'multi');

    function pushHoja(cam, items, titulo) {
      var itemsCopy = (items || []).map(function (it) {
        return Object.assign({}, it);
      });
      hojas.push({
        camion: cam,
        items: itemsCopy,
        titulo: titulo || 'CONSOLIDADO DE CARGA - MERCADERÍA - GENERAL (R)',
        fecha: fecha
      });
    }

    if (modo === 'uno' && camSel) {
      var hit = listaCam.find(function (c) { return c.toUpperCase() === camSel.toUpperCase(); }) ||
        listaCam.find(function (c) { return c.toUpperCase().indexOf(camSel.toUpperCase()) >= 0; });
      if (hit) {
        pushHoja(hit, camiones[hit]);
        return hojas;
      }
    }

    listaCam.forEach(function (cam) { pushHoja(cam, camiones[cam]); });
    try {
      var cons = consolidadoRows();
      cons.forEach(function (r) {
        var cat = catalogo.find(function (p) { return p.codigo === r.codigo; });
        r._categoria = categoriaDeItem(r);
        if (!r.tipo && cat) r.tipo = cat.tipo;
        if (r.peso == null) r.peso = 0;
      });
      var pesoMap = Object.create(null);
      lineas.forEach(function (l) {
        pesoMap[l.codigo] = (pesoMap[l.codigo] || 0) + (Number(l.peso) || 0);
      });
      cons.forEach(function (r) { r.peso = pesoMap[r.codigo] || 0; });
      pushHoja('TODOS LOS CAMIONES', cons, 'CONSOLIDADO GENERAL (FRÍOS / SECOS)');
    } catch (eCons) {
      console.warn('consolidado hoja', eCons);
    }
    return hojas;
  }

  /** Vista previa EN LA MISMA PÁGINA (sin ventana emergente). */
  var _pdfBlobUrl = null;

  function revokePdfUrl() {
    if (_pdfBlobUrl) {
      try { URL.revokeObjectURL(_pdfBlobUrl); } catch (e) {}
      _pdfBlobUrl = null;
    }
  }

  function setPdfStatus(msg) {
    /* silencioso: no saturar el panel lateral */
    try { if (window.__IEM_DEBUG_PDF) console.log('[pdf]', msg); } catch (e) {}
  }

  /**
   * PDF vectorial con jsPDF + autoTable (texto nítido, no captura de imagen).
   * @param {string|null} filename
   * @param {boolean} autoDownload
   * @param {Array|null} hojasParam
   */
  async function generarPdfDesdeHojas(filename, autoDownload, hojasParam) {
    var frame = $('consPdfFrame');
    var Jspdf = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!Jspdf) throw new Error('jsPDF no cargó');

    var testDoc = new Jspdf({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    if (typeof testDoc.autoTable !== 'function') {
      throw new Error('jsPDF-autoTable no cargó. Revisa internet/CDN.');
    }

    var hojas = hojasParam;
    if (!hojas || !hojas.length) {
      var modo = 'multi';
      try {
        if (String(($('consCamion') || {}).value || '').trim()) modo = 'uno';
      } catch (eM) {}
      hojas = construirHojasVista(modo);
    }
    if (!hojas || !hojas.length) throw new Error('No hay hojas para el PDF');

    var pdf = new Jspdf({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    var pageW = 210;
    var pageH = 297;
    var marginX = 12;
    var marginTop = 12;
    var contentW = pageW - marginX * 2;
    var firstPage = true;
    var TITULO = 'CONSOLIDADO DE CARGA - MERCADERÍA - GENERAL (R)';

    function drawHeader(doc, camion, fecha, numHoja, totalHojas) {
      var y = marginTop;
      try {
        if (typeof LOGO_URL === 'string' && LOGO_URL) {
          doc.addImage(LOGO_URL, 'PNG', marginX, y, 18, 12);
        }
      } catch (eL) {}
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(30, 58, 95);
      doc.text(TITULO, marginX + 22, y + 5);
      var badge = 'Hoja ' + numHoja + ' de ' + totalHojas;
      doc.setFontSize(8);
      var bw = doc.getTextWidth(badge) + 6;
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(pageW - marginX - bw, y + 1, bw, 6, 1.5, 1.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(badge, pageW - marginX - bw + 3, y + 5);

      var camTxt = String(camion || '');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      var camW = Math.max(doc.getTextWidth(camTxt) + 6, 20);
      doc.setFillColor(29, 78, 216);
      doc.roundedRect(marginX + 22, y + 7.5, camW, 5.5, 1.5, 1.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(camTxt, marginX + 25, y + 11.2);

      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Fecha: ' + String(fecha || ''), marginX + 22 + camW + 4, y + 11.2);

      doc.setDrawColor(29, 78, 216);
      doc.setLineWidth(0.6);
      doc.line(marginX, y + 15, pageW - marginX, y + 15);
      return y + 18;
    }

    /**
     * Cuadro de control (1ª hoja de cada camión) — para rellenar a mano.
     * Devuelve Y inferior del bloque.
     */
    function drawVehicleForm(doc, camion, fecha) {
      var y0 = marginTop + 17;
      var boxH = 34;
      var x = marginX;
      var w = contentW;
      var rowH = 7.2;

      // Fondo y borde
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(30, 58, 95);
      doc.setLineWidth(0.45);
      doc.roundedRect(x, y0, w, boxH, 1.5, 1.5, 'FD');

      // Barra lateral azul
      doc.setFillColor(30, 58, 95);
      doc.rect(x, y0, 3.2, boxH, 'F');

      // Parse fecha YYYY-MM-DD o similar
      var dia = '', mes = '', anio = '';
      var fs = String(fecha || '').trim();
      var m = fs.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (m) {
        anio = m[1];
        mes = m[2].length === 1 ? '0' + m[2] : m[2];
        dia = m[3].length === 1 ? '0' + m[3] : m[3];
      } else {
        var m2 = fs.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
        if (m2) {
          dia = m2[1].length === 1 ? '0' + m2[1] : m2[1];
          mes = m2[2].length === 1 ? '0' + m2[2] : m2[2];
          anio = m2[3].length === 2 ? '20' + m2[3] : m2[3];
        }
      }

      // --- Fila 1: CAMIÓN N° + cajas DIA MES AÑO ---
      var y = y0 + 5.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 58, 95);
      doc.text('CAMIÓN N°:', x + 6, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      var camLabel = String(camion || '').replace(/^CAMION\s*/i, '').trim();
      doc.text(camLabel || String(camion || ''), x + 28, y);
      // línea de escritura
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.25);
      doc.line(x + 28, y + 1.2, x + w - 52, y + 1.2);

      // Mini cajas fecha
      var cellW = 12;
      var cellH = 8;
      var fx = x + w - 6 - cellW * 3 - 4;
      var fy = y0 + 2.5;
      var labels = ['DÍA', 'MES', 'AÑO'];
      var vals = [dia, mes, anio];
      for (var i = 0; i < 3; i++) {
        var cx = fx + i * (cellW + 2);
        doc.setDrawColor(30, 58, 95);
        doc.setLineWidth(0.3);
        doc.setFillColor(255, 255, 255);
        doc.rect(cx, fy, cellW, cellH, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(100, 116, 139);
        doc.text(labels[i], cx + cellW / 2, fy + 2.4, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        if (vals[i]) doc.text(String(vals[i]), cx + cellW / 2, fy + 6.2, { align: 'center' });
      }

      // --- Filas de campos ---
      var fields = [
        'PLACA DEL VEHÍCULO:',
        'TRANSPORTISTA / CONDUCTOR:',
        'PICKING — PREPARÓ (CARGA):'
      ];
      for (var fi = 0; fi < fields.length; fi++) {
        y = y0 + 12 + fi * rowH;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 58, 95);
        doc.text(fields[fi], x + 6, y);
        var labelW = doc.getTextWidth(fields[fi]) + 2;
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.3);
        doc.line(x + 6 + labelW, y + 0.8, x + w - 4, y + 0.8);
      }

      return y0 + boxH + 3;
    }

    function drawFooter(doc, camion, numHoja, totalHojas) {
      var y = pageH - 11;
      doc.setDrawColor(29, 78, 216);
      doc.setLineWidth(0.5);
      doc.line(marginX, y - 3, pageW - marginX, y - 3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('IEM Group · Consolidado de carga · ' + String(camion || ''), marginX, y);
      doc.setFont('helvetica', 'bold');
      doc.text('Hoja ' + numHoja + ' de ' + totalHojas, pageW - marginX, y, { align: 'right' });
    }

    function drawTotal(doc, camion, peso, startY) {
      var y = Math.min(Math.max(startY + 4, 40), pageH - 26);
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(29, 78, 216);
      doc.setLineWidth(0.5);
      doc.roundedRect(marginX, y, contentW, 10, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('TOTAL PESO ' + String(camion || ''), marginX + 4, y + 6.5);
      doc.setFontSize(12);
      doc.setTextColor(30, 58, 95);
      doc.text(fmtPesoNum(peso) + ' kg', pageW - marginX - 4, y + 6.5, { align: 'right' });
    }

    function buildTableBody(rows, itemOffset) {
      var body = [];
      var lastTipo = '';
      var lastCat = '';
      var n = itemOffset;
      (rows || []).forEach(function (r) {
        if (r.tipoKey !== lastTipo) {
          lastTipo = r.tipoKey;
          lastCat = '';
          var nom = lastTipo === 'FRIOS' ? 'FRÍOS' : 'SECOS';
          var bg = lastTipo === 'FRIOS' ? [14, 116, 144] : [180, 83, 9];
          body.push([{
            content: nom,
            colSpan: 7,
            styles: {
              fillColor: bg,
              textColor: 255,
              fontStyle: 'bold',
              fontSize: 9,
              halign: 'left',
              cellPadding: 2.2
            }
          }]);
        }
        if (r.categoria !== lastCat) {
          lastCat = r.categoria;
          body.push([{
            content: String(lastCat || 'OTROS'),
            colSpan: 7,
            styles: {
              fillColor: [30, 58, 95],
              textColor: 255,
              fontStyle: 'bold',
              fontSize: 8,
              halign: 'left',
              cellPadding: 1.8
            }
          }]);
        }
        n++;
        var it = r.item || {};
        var fac = Number(it.factor) > 1 ? Number(it.factor) : 1;
        var cu = cantACajasUnd(it.cantidad, fac);
        var cajasVal = (cu.cajas === '' || cu.cajas === 0 || cu.cajas === '0') ? '—' : String(cu.cajas);
        body.push([
          { content: String(n), styles: { halign: 'center' } },
          { content: String(it.codigo || ''), styles: { halign: 'center', fontStyle: 'bold' } },
          { content: String(it.descripcion || ''), styles: { halign: 'left' } },
          { content: String(it.unidad_ref || ''), styles: { halign: 'center', fontSize: 7.5 } },
          {
            content: cajasVal,
            styles: {
              halign: 'center',
              fontStyle: 'bold',
              fontSize: 10,
              fillColor: [254, 243, 199],
              textColor: [146, 64, 14],
              lineColor: [180, 83, 9],
              lineWidth: 0.25
            }
          },
          { content: String(cu.sueltas), styles: { halign: 'center', textColor: [71, 85, 105] } },
          { content: fmtPeso(it.peso), styles: { halign: 'right' } }
        ]);
      });
      return body;
    }

    var head = [[
      { content: 'ITEM', styles: { halign: 'center' } },
      { content: 'Código', styles: { halign: 'center' } },
      { content: 'Producto / Descripción', styles: { halign: 'left' } },
      { content: 'Unidad', styles: { halign: 'center' } },
      { content: 'CAJAS', styles: { halign: 'center', fillColor: [251, 191, 36], textColor: [120, 53, 15], fontStyle: 'bold' } },
      { content: 'Und. sueltas', styles: { halign: 'center', fontSize: 7 } },
      { content: 'Peso', styles: { halign: 'center' } }
    ]];

    for (var hi = 0; hi < hojas.length; hi++) {
      var h = hojas[hi];
      var parts = partirItemsEnPaginas(h.items || []);
      if (!parts.length) parts = [{ rows: [], pesoTotalCamion: 0, esUltima: true }];
      var totalCam = parts.length;
      var offset = 0;
      for (var pi = 0; pi < parts.length; pi++) {
        var part = parts[pi];
        if (!firstPage) pdf.addPage();
        firstPage = false;

        var startY = drawHeader(pdf, h.camion, h.fecha, pi + 1, totalCam);
        // Cuadro vehículo solo en la 1ª hoja de cada camión
        if (pi === 0) {
          startY = drawVehicleForm(pdf, h.camion, h.fecha);
        }
        var body = buildTableBody(part.rows, offset);

        if (!body.length) {
          pdf.setFontSize(10);
          pdf.setTextColor(100, 116, 139);
          pdf.text('Sin ítems en esta hoja.', marginX, startY + 10);
        } else {
          pdf.autoTable({
            startY: startY,
            margin: { left: marginX, right: marginX, bottom: 20 },
            head: head,
            body: body,
            theme: 'grid',
            tableWidth: contentW,
            pageBreak: 'avoid',
            rowPageBreak: 'avoid',
            showHead: 'firstPage',
            styles: {
              font: 'helvetica',
              fontSize: 8,
              cellPadding: 1.25,
              lineColor: [148, 163, 184],
              lineWidth: 0.15,
              textColor: [15, 23, 42],
              overflow: 'linebreak',
              valign: 'middle',
              minCellHeight: 5
            },
            headStyles: {
              fillColor: [226, 232, 240],
              textColor: [15, 23, 42],
              fontStyle: 'bold',
              fontSize: 8,
              cellPadding: 1.4
            },
            columnStyles: {
              0: { cellWidth: 12 },
              1: { cellWidth: 16 },
              2: { cellWidth: 'auto' },
              3: { cellWidth: 20 },
              4: { cellWidth: 16 },
              5: { cellWidth: 20 },
              6: { cellWidth: 16 }
            }
          });
        }

        var finalY = (pdf.lastAutoTable && pdf.lastAutoTable.finalY) || (startY + 20);
        if (part.esUltima) {
          drawTotal(pdf, h.camion, part.pesoTotalCamion, finalY);
        } else {
          pdf.setFontSize(8);
          pdf.setTextColor(100, 116, 139);
          pdf.text(
            '… continúa en hoja ' + (pi + 2) + ' de ' + totalCam + ' · ' + String(h.camion || ''),
            pageW - marginX,
            Math.min(finalY + 6, pageH - 16),
            { align: 'right' }
          );
        }
        drawFooter(pdf, h.camion, pi + 1, totalCam);
        offset += (part.rows && part.rows.length) || 0;
      }
    }

    revokePdfUrl();
    var blob = pdf.output('blob');
    _pdfBlobUrl = URL.createObjectURL(blob);
    if (frame) frame.src = _pdfBlobUrl;
    if (autoDownload) {
      pdf.save(filename || 'consolidado_carga.pdf');
    }
    setPdfStatus('PDF listo' + (autoDownload ? ' (descarga)' : ''));
    return pdf;
  }


  function renderVistaPreviaPanel(modoForzado) {
    var inner = $('consPreviewInner');
    var res = $('consResumen');
    if (!inner) {
      console.warn('Falta #consPreviewInner en el HTML');
      return;
    }

    if (!lineas.length) {
      inner.innerHTML = '';
      revokePdfUrl();
      var frame = $('consPdfFrame');
      if (frame) frame.src = 'about:blank';
      setPdfStatus('Importa el Excel del día para generar el PDF de vista previa.');
      if (res) res.textContent = '0 líneas';
      return;
    }

    var hojas = construirHojasVista(modoForzado);
    if (!hojas || !hojas.length) {
      inner.innerHTML = '';
      setPdfStatus('No hay hojas para mostrar.');
      if (res) res.textContent = lineas.length + ' línea(s)';
      return;
    }

    var html = '';
    try {
      html = htmlDocumento(hojas);
    } catch (eH) {
      console.error(eH);
      setPdfStatus('Error generando documento: ' + ((eH && eH.message) || eH));
      return;
    }
    inner.innerHTML = html || '';

    var nItems = 0;
    var nPaginas = 0;
    var detalleCam = [];
    hojas.forEach(function (h) {
      var n = (h.items && h.items.length) || 0;
      nItems += n;
      var parts = typeof partirItemsEnPaginas === 'function' ? partirItemsEnPaginas(h.items || []) : [{ rows: h.items || [] }];
      nPaginas += parts.length;
      detalleCam.push((h.camion || '?') + ': ' + parts.length + ' pág.');
    });
    var camSel = String(($('consCamion') || {}).value || '').trim();
    if (res) { res.textContent = ""; }

    // Generar PDF (debounced): evita re-renders si el usuario cambia camión rápido
    setPdfStatus('Preparando PDF…');
    schedulePdfPreview();
  }

  var _pdfPreviewTimer = null;
  var _pdfGenToken = 0;
  var _pdfBusy = false;

  function schedulePdfPreview() {
    if (_pdfPreviewTimer) clearTimeout(_pdfPreviewTimer);
    _pdfPreviewTimer = setTimeout(function () {
      _pdfPreviewTimer = null;
      var token = ++_pdfGenToken;
      if (_pdfBusy) {
        // reintentar cuando termine el actual
        setTimeout(function () {
          if (token === _pdfGenToken) schedulePdfPreview();
        }, 200);
        return;
      }
      _pdfBusy = true;
      var hojasPrev = null;
      try {
        var modoP = String(($('consCamion') || {}).value || '').trim() ? 'uno' : 'multi';
        hojasPrev = construirHojasVista(modoP);
      } catch (eH) {}
      generarPdfDesdeHojas(null, false, hojasPrev).catch(function (e) {
        console.error(e);
        setPdfStatus('No se pudo generar PDF: ' + ((e && e.message) || e) + ' — revisa CDN/internet');
      }).then(function () {
        _pdfBusy = false;
      });
    }, 180);
  }



  /** Normaliza código a 4 dígitos cuando aplica (Uniflex / IEM). */
  function normCodigo4(cod) {
    var s = String(cod == null ? '' : cod).trim();
    if (!s) return '';
    if (/^\d+$/.test(s) && s.length <= 4) return ('0000' + s).slice(-4);
    return s;
  }

  /** Busca producto en catálogo Supabase por código (4 dígitos y variantes). */
  function productoPorCodigo(cod) {
    if (!catalogo || !catalogo.length) return null;
    var s = String(cod == null ? '' : cod).trim();
    if (!s) return null;
    var c4 = normCodigo4(s);
    var sin0 = s.replace(/^0+/, '') || s;
    for (var i = 0; i < catalogo.length; i++) {
      var p = catalogo[i];
      var pc = String(p.codigo || '').trim();
      if (!pc) continue;
      if (pc === s || pc === c4 || pc === sin0) return p;
      if (normCodigo4(pc) === c4) return p;
      if (pc.replace(/^0+/, '') === sin0) return p;
    }
    return null;
  }

  function lineaCategoria(desc, lineaCat, codigo) {
    var lin = String(lineaCat || '').trim();

    // Si tenemos código, preferir siempre la línea del catálogo Supabase
    if (codigo) {
      var prod = productoPorCodigo(codigo);
      if (prod) {
        if (prod.linea) lin = String(prod.linea).trim();
        if (!desc && prod.descripcion) desc = prod.descripcion;
      }
    }

    if (lin) {
      var upper = lin.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      // Líneas genéricas poco útiles → caer a nombre
      if (!/^(NUEVO|NUEVOS|OTRO|OTROS|NULL|UNDEFINED|S\/?L|SIN\s*LINEA)$/i.test(upper.trim())) {
        var part = lin.split(':')[0].trim();
        if (part.length >= 2) return part.toUpperCase();
        return lin.toUpperCase();
      }
    }

    // Fallback por nombre / descripción
    var s = String(desc || '').toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/YOGUR|YOG\.|GRIEGO|PROBIOT|BIO DEFENSA/.test(s)) return 'YOGURES';
    if (/QUESO|EDAM|MOZZARELL|PARMESANO|CHEDDAR|CREAM CHEESE/.test(s)) return 'QUESOS';
    if (/MANTEQUILL/.test(s)) return 'MANTEQUILLAS';
    if (/MARGARINA/.test(s)) return 'MARGARINAS';
    if (/SALCHICH|JAMON|JAMONADA|CHORIZ|HOT DOG|CHICHARRON|EMBUTID|MORTADEL|TOCIN/.test(s)) return 'EMBUTIDOS';
    if (/GELATINA|YOPI/.test(s)) return 'GELATINAS';
    if (/SIROPE|MAPLE/.test(s)) return 'SIROPES / BASES';
    if (/BASE DE HELADO|HELADO/.test(s)) return 'BASE DE HELADO';
    if (/MANJAR|FUDGE|DULCE DE LECHE/.test(s)) return 'MANJARES / DULCES';
    if (/EVAPORAD|BOLSITARRO|PRACTITARRO|NUTRILAC|MEZCLA LACT|CHIQUITARRO/.test(s)) return 'EVAPORADAS';
    if (/ALMENDRA|SOYA|COCO|VEGETAL/.test(s)) return 'BEBIDAS VEGETALES';
    if (/WATTS|NARANJADA|REFRESCO|NECTAR/.test(s)) return 'BEBIDAS';
    if (/LECHE|UHT|LACTEA|LACTEO/.test(s)) return 'LECHES';
    if (/CREMA DE LECHE|CREMA DE/.test(s)) return 'CREMAS DE LECHE';
    return 'OTROS';
  }

  /** Fríos / Secos: siempre por código → catálogo Supabase (tipo_almacen). */
  function tipoPorCodigo(cod, desc, linea) {
    var prod = productoPorCodigo(cod);
    if (prod) {
      var t = String(prod.tipo || prod.tipo_almacen || '').toUpperCase();
      if (t.indexOf('FRIO') >= 0) return 'FRIOS';
      if (t.indexOf('SECO') >= 0) return 'SECOS';
      return clasificarProducto(prod);
    }
    return clasificarProducto({ descripcion: desc, linea: linea, codigo: cod });
  }

  /** Categoría final de un ítem de carga (recalcula, no usa OTROS viejo). */
  function categoriaDeItem(it) {
    if (!it) return 'OTROS';
    var prod = productoPorCodigo(it.codigo);
    var lin = (prod && prod.linea) || it.linea || '';
    var desc = (prod && prod.descripcion) || it.descripcion || '';
    return lineaCategoria(desc, lin, it.codigo);
  }


  function cantACajasUnd(cant, factor) {
    var c = Number(cant) || 0;
    var f = Number(factor) > 1 ? Number(factor) : 1;
    if (f <= 1) return { cajas: '', sueltas: c };
    return { cajas: Math.floor(c / f), sueltas: c % f };
  }

  /** Hoja formato macro: título, fecha, REPARTO, FRÍOS/SECOS + grupos, ITEM/... */
  function hojaFormatoCamion(camion, items, fecha) {
    var aoa = [];
    aoa.push(['CONSOLIDADO DE CARGA - MERCADERÍA - GENERAL (R)']);
    aoa.push([]);
    aoa.push(['Fecha:', fecha || '']);
    aoa.push(['REPARTO:', camion || '']);
    aoa.push([]);
    aoa.push([]);
    aoa.push(['ITEM', 'Código', 'Producto / Descripción', 'Unidad', 'Cajas', 'Unidades Sueltas', 'Tipo', 'Peso / Obs']);

    // Separar Fríos y Secos por código → Supabase
    var frios = [];
    var secos = [];
    items.forEach(function (it) {
      it.tipo = tipoPorCodigo(it.codigo, it.descripcion, it.linea);
      it._categoria = categoriaDeItem(it);
      var tt = String(it.tipo || '').toUpperCase();
      if (tt.indexOf('FRIO') >= 0) frios.push(it);
      else secos.push(it);
    });

    function volcarBloque(tituloBloque, lista) {
      if (!lista.length) return;
      aoa.push([tituloBloque]);
      var grupos = Object.create(null);
      var orden = [];
      lista.forEach(function (it) {
        var cat = categoriaDeItem(it);
        if (!grupos[cat]) { grupos[cat] = []; orden.push(cat); }
        grupos[cat].push(it);
      });
      orden.sort();
      orden.forEach(function (cat) {
        aoa.push(['  ' + cat]);
        grupos[cat].forEach(function (it) {
          itemN++;
          var fac = Number(it.factor) > 1 ? Number(it.factor) : 1;
          var cu = cantACajasUnd(it.cantidad, fac);
          aoa.push([
            itemN,
            it.codigo,
            it.descripcion,
            it.unidad_ref || '',
            cu.cajas === '' ? '' : cu.cajas,
            cu.sueltas,
            it.tipo || '',
            fmtPeso(it.peso)
          ]);
        });
      });
    }

    var itemN = 0;
    volcarBloque('❄ FRÍOS', frios);
    if (frios.length && secos.length) aoa.push([]);
    volcarBloque('📦 SECOS', secos);

    return XLSX.utils.aoa_to_sheet(aoa);
  }

  function nombreHojaCamion(camion) {
    var s = String(camion || 'camion').replace(/[\\\/\?\*\[\]]/g, ' ').trim();
    if (s.length > 28) s = s.slice(0, 28);
    return s || 'camion';
  }


  var LOGO_URL = 'data:image/png;base64,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';

  function fmtPeso(p) {
    var n = Number(p);
    if (!isFinite(n) || n === 0) return '';
    return (Math.round(n * 100) / 100).toFixed(2);
  }

  /** Ítems por hoja (A4 con cabecera IEM + grupos). Más denso = menos páginas vacías. */
  // Capacidad: fila=1, header categoría≈1, banner FRIOS/SECOS≈1
  var UNIDADES_POR_HOJA = 32;
  var ITEMS_POR_HOJA = 22; // cabecera + cuadro vehículo + pie

  function pesoVisualFila(it, prevTipo, prevCat) {
    var u = 1;
    var tipo = String((it && it.tipo) || '').toUpperCase();
    var cat = String((it && (it.categoria || it.linea)) || 'OTROS').toUpperCase();
    if (tipo && tipo !== prevTipo) u += 2;
    if (cat && cat !== prevCat) u += 2;
    return u;
  }

  function ordenarItemsParaHojas(items) {
    var list = (items || []).map(function (it) {
      var tipo = String(it.tipo || clasificarProducto(it) || '').toUpperCase();
      if (tipo.indexOf('FRIO') >= 0) tipo = 'FRIOS';
      else if (tipo.indexOf('SECO') >= 0) tipo = 'SECOS';
      else if (tipo !== 'FRIOS' && tipo !== 'SECOS') tipo = tipoDe(it) || 'SECOS';
      var cat = '';
      try { cat = categoriaDeItem(it) || 'OTROS'; } catch (e) { cat = 'OTROS'; }
      return {
        tipoKey: tipo === 'FRIOS' ? 'FRIOS' : 'SECOS',
        categoria: String(cat || 'OTROS').toUpperCase(),
        item: it
      };
    });
    list.sort(function (a, b) {
      if (a.tipoKey !== b.tipoKey) return a.tipoKey === 'FRIOS' ? -1 : 1;
      if (a.categoria !== b.categoria) return a.categoria.localeCompare(b.categoria);
      return String(a.item.codigo || '').localeCompare(String(b.item.codigo || ''));
    });
    return list;
  }

  function partirItemsEnPaginas(items) {
    var seq = ordenarItemsParaHojas(items);
    var pesoTotal = 0;
    seq.forEach(function (r) {
      var n = Number(r.item && r.item.peso);
      if (isFinite(n)) pesoTotal += n;
    });
    var pages = [];
    var cur = [];
    var units = 0;
    var prevTipo = '';
    var prevCat = '';
    seq.forEach(function (r) {
      var tipo = r.tipoKey;
      var cat = r.categoria;
      var need = 1;
      // headers compactos: solo +1 por cambio (antes +1/+2 dejaba huecos grandes)
      if (tipo && tipo !== prevTipo) need += 1;
      if (cat && cat !== prevCat) need += 1;
      if (cur.length && (units + need > UNIDADES_POR_HOJA || cur.length >= ITEMS_POR_HOJA)) {
        pages.push({ rows: cur, pesoTotalCamion: pesoTotal, esUltima: false });
        cur = [];
        units = 0;
        prevTipo = '';
        prevCat = '';
        need = 1 + (tipo ? 1 : 0) + (cat ? 1 : 0);
      }
      cur.push(r);
      units += need;
      prevTipo = tipo;
      prevCat = cat;
    });
    if (cur.length) pages.push({ rows: cur, pesoTotalCamion: pesoTotal, esUltima: false });
    if (!pages.length) pages.push({ rows: [], pesoTotalCamion: pesoTotal, esUltima: true });
    pages.forEach(function (pg, idx) { pg.esUltima = idx === pages.length - 1; });
    // Fusionar última página corta (hasta 6 filas) con la anterior si cabe
    if (pages.length >= 2) {
      var last = pages[pages.length - 1];
      var prev = pages[pages.length - 2];
      if (last.rows.length <= 6 && prev.rows.length + last.rows.length <= ITEMS_POR_HOJA) {
        prev.rows = prev.rows.concat(last.rows);
        prev.esUltima = true;
        pages.pop();
      }
    }
    return pages;
  }


  function fmtPesoNum(n) {
    var x = Number(n) || 0;
    return (Math.round(x * 100) / 100).toFixed(2);
  }

  function renderFilasPagina(rows, itemOffset) {
    if (!rows || !rows.length) {
      return { html: '<p style="color:#64748b;font-size:10pt;">Sin ítems en esta hoja.</p>', lastItem: itemOffset };
    }
    var html = '';
    var lastTipo = '';
    var lastCat = '';
    var tableOpen = false;
    var n = itemOffset;

    function closeTable() {
      if (tableOpen) { html += '</tbody></table>'; tableOpen = false; }
    }

    rows.forEach(function (r) {
      if (r.tipoKey !== lastTipo) {
        closeTable();
        lastTipo = r.tipoKey;
        lastCat = '';
        var nom = lastTipo === 'FRIOS' ? '❄ FRÍOS' : '📦 SECOS';
        var bg = lastTipo === 'FRIOS' ? '#0e7490' : '#b45309';
        html += '<div class="blk-tipo" style="margin:6px 0 3px;padding:4px 8px;border-radius:5px;background:' + bg +
          ';color:#fff;font-weight:800;font-size:9.5pt;' +
          '-webkit-print-color-adjust:exact;print-color-adjust:exact;">' + nom + '</div>';
      }
      if (r.categoria !== lastCat) {
        closeTable();
        lastCat = r.categoria;
        html += '<div style="font-weight:700;margin:5px 0 2px;font-size:8.5pt;background:#1e3a5f;color:#fff;padding:3px 8px;border-radius:5px;' +
          'page-break-after:avoid;break-after:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact;">' +
          esc(lastCat) + '</div>';
        html += '<table class="cons-print-table" style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:8.5pt;margin:0 0 6px 0;page-break-inside:auto;">' +
          '<colgroup>' +
          '<col style="width:6%">' +
          '<col style="width:9%">' +
          '<col style="width:42%">' +
          '<col style="width:11%">' +
          '<col style="width:10%">' +
          '<col style="width:12%">' +
          '<col style="width:10%">' +
          '</colgroup>' +
          '<thead style="display:table-header-group;-webkit-print-color-adjust:exact;print-color-adjust:exact;"><tr style="background:#e2e8f0;-webkit-print-color-adjust:exact;print-color-adjust:exact;">' +
          '<th style="border:1px solid #94a3b8;padding:4px 5px;text-align:center;">ITEM</th>' +
          '<th style="border:1px solid #94a3b8;padding:4px 5px;text-align:center;">Código</th>' +
          '<th style="border:1px solid #94a3b8;padding:4px 5px;text-align:left;">Producto / Descripción</th>' +
          '<th style="border:1px solid #94a3b8;padding:4px 5px;text-align:center;">Unidad</th>' +
          '<th style="border:1px solid #b45309;padding:4px 5px;text-align:center;background:#fbbf24;color:#78350f;font-weight:800;">CAJAS</th>' +
          '<th style="border:1px solid #94a3b8;padding:4px 5px;text-align:center;font-size:8pt;">Und. sueltas</th>' +
          '<th style="border:1px solid #94a3b8;padding:4px 5px;text-align:center;">Peso</th></tr></thead><tbody>';
        tableOpen = true;
      }
      n++;
      var it = r.item;
      var fac = Number(it.factor) > 1 ? Number(it.factor) : 1;
      var cu = cantACajasUnd(it.cantidad, fac);
      html += '<tr style="page-break-inside:avoid;">' +
        '<td style="border:1px solid #cbd5e1;padding:3px 5px;text-align:center;white-space:nowrap;">' + n + '</td>' +
        '<td style="border:1px solid #cbd5e1;padding:3px 5px;text-align:center;font-family:ui-monospace,monospace;font-weight:600;white-space:nowrap;">' + esc(it.codigo) + '</td>' +
        '<td style="border:1px solid #cbd5e1;padding:3px 5px;text-align:left;word-wrap:break-word;overflow-wrap:break-word;">' + esc(it.descripcion) + '</td>' +
        '<td style="border:1px solid #cbd5e1;padding:3px 5px;text-align:center;white-space:nowrap;font-size:8pt;">' + esc(it.unidad_ref || '') + '</td>' +
        '<td style="border:1px solid #b45309;padding:3px 5px;text-align:center;white-space:nowrap;background:#fef3c7;font-weight:800;font-size:10.5pt;color:#92400e;">' +
          (cu.cajas === '' || cu.cajas === 0 || cu.cajas === '0' ? '—' : cu.cajas) + '</td>' +
        '<td style="border:1px solid #cbd5e1;padding:3px 5px;text-align:center;white-space:nowrap;color:#475569;">' + cu.sueltas + '</td>' +
        '<td style="border:1px solid #cbd5e1;padding:3px 5px;text-align:right;white-space:nowrap;">' + fmtPeso(it.peso) + '</td></tr>';
  });
    closeTable();
    return { html: html, lastItem: n };
  }

  function buildPrintHtml(titulo, camion, items, fecha, opts) {
    opts = opts || {};
    var numHoja = opts.numHoja != null ? opts.numHoja : 1;
    var totalHojas = opts.totalHojas != null ? opts.totalHojas : 1;
    var pageRows = opts.pageRows || null;
    var pesoTotalCamion = opts.pesoTotalCamion != null ? opts.pesoTotalCamion : 0;
    var esUltimaHojaCamion = opts.esUltimaHojaCamion !== false;
    var itemOffset = opts.itemOffset || 0;

    if (!pageRows) {
      var parts = partirItemsEnPaginas(items || []);
      pageRows = parts[0] ? parts[0].rows : [];
      pesoTotalCamion = parts[0] ? parts[0].pesoTotalCamion : 0;
      esUltimaHojaCamion = true;
    }

    var tituloFijo = 'CONSOLIDADO DE CARGA - MERCADERÍA - GENERAL (R)';
    // Numeración POR CAMIÓN: Hoja X de N (de este camión)
    var textoHoja = 'Hoja ' + numHoja + ' de ' + totalHojas;
    var badgeHoja = '<span style="background:#0f172a;color:#fff;padding:3px 10px;border-radius:999px;font-weight:700;margin-left:8px;font-size:9pt;">' +
      textoHoja + '</span>';

    var body = renderFilasPagina(pageRows, itemOffset);

    var bloqueTotal = '';
    if (esUltimaHojaCamion) {
      bloqueTotal =
        '<div style="margin-top:12px;padding:10px 12px;background:#f1f5f9;border:2px solid #1d4ed8;border-radius:8px;' +
        'display:flex;justify-content:space-between;align-items:center;font-size:11pt;page-break-inside:avoid;">' +
        '<strong>TOTAL PESO ' + esc(camion || '') + '</strong>' +
        '<strong style="font-size:13pt;color:#1e3a5f;">' + fmtPesoNum(pesoTotalCamion) + ' kg</strong></div>';
    } else {
      bloqueTotal = '<div style="margin-top:10px;font-size:9pt;color:#64748b;text-align:right;">… continúa en hoja ' +
        (numHoja + 1) + ' de ' + totalHojas + ' · ' + esc(camion || '') + '</div>';
    }

    // page-break-after solo si no es la última hoja del documento se controla fuera;
    // cada print-page siempre puede romper después
    // Hoja A4 fija: cabecera + cuerpo (crece) + pie SIEMPRE abajo
    return '<div class="print-page" data-camion="' + esc(camion || '') + '" data-hoja="' + numHoja +
      '" data-total="' + totalHojas + '" style="page-break-after:always;break-after:page;' +
      'font-family:Segoe UI,Arial,sans-serif;color:#0f172a;background:#fff;box-sizing:border-box;' +
      'width:190mm;height:277mm;min-height:277mm;max-height:277mm;overflow:hidden;padding:8mm 10mm;' +
      'padding:0;margin:0 auto 12px auto;' +
      'display:flex;flex-direction:column;' +
      '-webkit-print-color-adjust:exact;print-color-adjust:exact;">' +
      '<div class="print-header" style="flex:0 0 auto;display:flex;align-items:center;gap:14px;border-bottom:3px solid #1d4ed8;' +
      'padding-bottom:8px;margin-bottom:8px;">' +
        '<img src="' + LOGO_URL + '" alt="IEM" style="height:40px;width:auto;object-fit:contain;" onerror=\"this.remove()\" />' +
        '<div style="flex:1;">' +
          '<div style="font-size:11.5pt;font-weight:800;color:#1e3a5f;">' + esc(tituloFijo) + badgeHoja + '</div>' +
          '<div style="margin-top:6px;font-size:10pt;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">' +
            '<span style="background:#1d4ed8;color:#fff;padding:3px 10px;border-radius:999px;font-weight:700;">' + esc(camion || '') + '</span>' +
            '<span><strong>Fecha:</strong> ' + esc(fecha || '') + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="print-body" style="flex:1 1 auto;min-height:0;overflow:hidden;">' +
        body.html +
        (esUltimaHojaCamion ? '' : (
          '<div style="margin-top:8px;font-size:9pt;color:#64748b;text-align:right;">… continúa en hoja ' +
          (numHoja + 1) + ' de ' + totalHojas + ' · ' + esc(camion || '') + '</div>'
        )) +
        (esUltimaHojaCamion ? bloqueTotal : '') +
      '</div>' +
      '<div class="print-footer" style="flex:0 0 auto;margin-top:auto;padding-top:8px;border-top:2px solid #1d4ed8;' +
      'font-size:9pt;color:#475569;display:flex;justify-content:space-between;gap:8px;align-items:center;">' +
        '<span>IEM Group · Consolidado de carga · ' + esc(camion || '') + '</span>' +
        '<span style="font-weight:700;">' + textoHoja + '</span>' +
      '</div>' +
      '</div>';
  }


  function enriquecerLineas() {
    // Siempre por código → Supabase (línea + Fríos/Secos)
    enriquecerDesdeCatalogo();
  }

  function armarHojasDocumento(modo) {
    enriquecerLineas();
    var fecha = ($('consFecha') || {}).value || new Date().toISOString().slice(0, 10);
    var camiones = {};
    lineas.forEach(function (l) {
      if (!camiones[l.camion]) camiones[l.camion] = [];
      camiones[l.camion].push(l);
    });
    var listaCam = Object.keys(camiones).sort();
    var hojas = [];

    function pushHoja(cam, items, titulo) {
      hojas.push({ camion: cam, items: items, titulo: titulo || 'CONSOLIDADO DE CARGA - MERCADERÍA - GENERAL (R)', fecha: fecha });
    }

    if (modo === 'uno') {
      var filtro = String(($('consCamion') || {}).value || ($('consFiltroCamion') || {}).value || '').trim();
      if (!filtro) {
        alert('Selecciona un camión en la lista «Camión».');
        return null;
      }
      var hit = listaCam.find(function (c) { return c.toUpperCase() === filtro.toUpperCase(); }) ||
        listaCam.find(function (c) { return c.toUpperCase().indexOf(filtro.toUpperCase()) >= 0; });
      if (!hit) { alert('Camión no encontrado en los datos.'); return null; }
      pushHoja(hit, camiones[hit]);
    } else {
      listaCam.forEach(function (cam) { pushHoja(cam, camiones[cam]); });
      var cons = consolidadoRows();
      cons.forEach(function (r) {
        var cat = catalogo.find(function (p) { return p.codigo === r.codigo; });
        r._categoria = categoriaDeItem(r);
        if (!r.tipo && cat) r.tipo = cat.tipo;
        if (r.peso == null) r.peso = 0;
      });
      // sumar pesos en consolidado
      var pesoMap = Object.create(null);
      lineas.forEach(function (l) {
        pesoMap[l.codigo] = (pesoMap[l.codigo] || 0) + (Number(l.peso) || 0);
      });
      cons.forEach(function (r) { r.peso = pesoMap[r.codigo] || 0; });
      pushHoja('TODOS LOS CAMIONES', cons, 'CONSOLIDADO GENERAL (FRÍOS / SECOS)');
    }
    return hojas;
  }

  function htmlDocumento(hojas) {
    if (!hojas || !hojas.length) return '';
    var TITULO = 'CONSOLIDADO DE CARGA - MERCADERÍA - GENERAL (R)';
    var html = '';
    // Numeración INDEPENDIENTE por camión: cada uno reinicia en Hoja 1 de N
    hojas.forEach(function (h) {
      var parts = partirItemsEnPaginas(h.items || []);
      var totalCam = parts.length;
      var offset = 0;
      parts.forEach(function (part, pi) {
        html += buildPrintHtml(TITULO, h.camion, [], h.fecha, {
          numHoja: pi + 1,
          totalHojas: totalCam,
          pageRows: part.rows,
          pesoTotalCamion: part.pesoTotalCamion,
          esUltimaHojaCamion: !!part.esUltima,
          itemOffset: offset
        });
        offset += (part.rows && part.rows.length) || 0;
      });
    });
    return html;
  }


  function abrirVistaPrevia(htmlBody, autoPrint) {
    // DEPRECADO: no abrir popups. La vista va en #consPreviewInner.
    if (htmlBody && $('consPreviewInner')) {
      $('consPreviewInner').innerHTML = htmlBody;
    }
    if (autoPrint) {
      setTimeout(function () { window.print(); }, 250);
    }
  }


  function imprimir(modo, autoPrint) {
    if (!lineas.length) {
      alert('No hay líneas para imprimir.');
      return;
    }
    var modoPanel = (modo === 'uno') ? 'uno' : 'multi';
    if (modoPanel === 'uno') {
      var filtro = String(($('consCamion') || {}).value || '').trim();
      if (!filtro) {
        alert('Selecciona un camión en la lista «Camión».');
        return;
      }
    }
    var hojas;
    try {
      hojas = construirHojasVista(modoPanel);
      var host = $('consPreviewInner');
      if (host) {
        try { host.innerHTML = htmlDocumento(hojas); } catch (eH) { host.innerHTML = ''; }
      }
    } catch (e) {
      console.error(e);
      alert('No se pudo armar el documento: ' + ((e && e.message) || e));
      return;
    }
    var fecha = ($('consFecha') || {}).value || new Date().toISOString().slice(0, 10);
    var cam = String(($('consCamion') || {}).value || '').trim() || 'todos';
    var fname = 'consolidado_' + String(cam).replace(/\s+/g, '_') + '_' + fecha + '.pdf';
    setPdfStatus('Generando PDF…');
    generarPdfDesdeHojas(fname, true, hojas).catch(function (e) {
      console.error(e);
      alert('Error PDF: ' + ((e && e.message) || e));
    });
  }


  function exportExcel(modo) {
    if (!window.XLSX) {
      alert('XLSX no cargó. Revisa internet/CDN.');
      return;
    }
    if (!lineas.length) {
      alert('No hay líneas. Importa el Excel de carga o agrega productos.');
      return;
    }
    var fecha = ($('consFecha') || {}).value || new Date().toISOString().slice(0, 10);
    enriquecerLineas();

    var camiones = {};
    lineas.forEach(function (l) {
      if (!camiones[l.camion]) camiones[l.camion] = [];
      camiones[l.camion].push(l);
    });
    var listaCam = Object.keys(camiones).sort();

    var filtroCam = '';
    if (modo === 'un_camion') {
      filtroCam = String(($('consCamion') || {}).value || ($('consFiltroCamion') || {}).value || '').trim();
      if (!filtroCam) {
        alert('Selecciona un camión en la lista «Camión / ruta».');
        return;
      }
      var hit = listaCam.find(function (c) { return c.toUpperCase() === filtroCam.toUpperCase(); });
      if (!hit) {
        hit = listaCam.find(function (c) { return c.toUpperCase().indexOf(filtroCam.toUpperCase()) >= 0; });
      }
      if (!hit) {
        alert('Ese camión no está en los datos importados.\nDisponibles: ' + listaCam.join(', '));
        return;
      }
      filtroCam = hit;
    }

    var wb = XLSX.utils.book_new();

    if (modo === 'un_camion') {
      var ws = hojaFormatoCamion(filtroCam, camiones[filtroCam], fecha);
      XLSX.utils.book_append_sheet(wb, ws, nombreHojaCamion(filtroCam));
      XLSX.writeFile(wb, 'consolidado_' + nombreHojaCamion(filtroCam).replace(/\s+/g, '_') + '_' + fecha + '.xlsx');
      toast('Excel generado: ' + filtroCam);
      return;
    }

    // todos los camiones: una hoja cada uno + hoja consolidado
    if (modo === 'todos' || modo === 'ambos' || modo === 'detalle' || !modo) {
      listaCam.forEach(function (cam) {
        var ws = hojaFormatoCamion(cam, camiones[cam], fecha);
        var nm = nombreHojaCamion(cam);
        // evitar duplicados de nombre de hoja
        var base = nm, n = 1;
        while (wb.SheetNames.indexOf(nm) >= 0) { nm = base.slice(0, 25) + '_' + n; n++; }
        XLSX.utils.book_append_sheet(wb, ws, nm);
      });
    }

    // Hoja consolidado total Fríos/Secos (formato similar)
    if (modo === 'consolidado' || modo === 'ambos' || modo === 'todos' || !modo) {
      var consItems = consolidadoRows();
      consItems.forEach(function (r) {
        var cat = catalogo.find(function (p) { return p.codigo === r.codigo; });
        r.tipo = tipoPorCodigo(r.codigo, r.descripcion, cat && cat.linea);
        r._categoria = (r.tipo === 'FRIOS' ? 'FRÍOS · ' : 'SECOS · ') + categoriaDeItem(r);
      });
      var wsC = hojaFormatoCamion('CONSOLIDADO GENERAL', consItems, fecha);
      XLSX.utils.book_append_sheet(wb, wsC, 'Consolidado');
    }

    XLSX.writeFile(wb, 'consolidado_carga_' + fecha + '.xlsx');
    toast('Excel generado: ' + listaCam.length + ' camión(es)' + (modo === 'consolidado' ? ' + consolidado' : ''));
  }

  async function descontarInventario() {
    if (!supabase) {
      alert('Sin Supabase.');
      return;
    }
    var rows = consolidadoRows();
    if (!rows.length) {
      alert('No hay productos para descontar.');
      return;
    }
    if (!window.confirm(
      '¿Descontar del stock teórico ' + rows.length + ' producto(s) según este consolidado?\n\n' +
      'Se resta la cantidad consolidada de cada código en Supabase.\n' +
      'Fríos/Secos y el catálogo no se borran.'
    )) return;

    toast('Descontando stock…');
    var ok = 0, fail = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      try {
        var cur = await supabase.from('productos')
          .select('codigo,stock_teorico')
          .eq('codigo', r.codigo)
          .maybeSingle();
        if (cur.error) throw cur.error;
        var stock = Number(cur.data && cur.data.stock_teorico) || 0;
        var nuevo = Math.max(0, stock - (Number(r.cantidad) || 0));
        var up = await supabase.from('productos')
          .update({ stock_teorico: nuevo, actualizado_en: new Date().toISOString() })
          .eq('codigo', r.codigo);
        if (up.error) throw up.error;
        ok++;
      } catch (e) {
        fail++;
        console.warn(r.codigo, e);
      }
    }
    toast('Descuento listo: ' + ok + ' ok' + (fail ? ' · ' + fail + ' error' : '') + '. Recarga inventario principal si está abierto.');
    await cargarCatalogo();
  }


  function isLightTheme() {
    return document.body.classList.contains('light-theme');
  }

  function aplicarTema(modo) {
    var light = (modo === 'light');
    document.body.classList.toggle('light-theme', light);
    try { localStorage.setItem('iem_cons_theme', light ? 'light' : 'dark'); } catch (e) {}
    // Actualizar title de botones
    document.querySelectorAll('#chooserTema, #btnConsTema').forEach(function (btn) {
      if (!btn) return;
      btn.title = light ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro';
      btn.setAttribute('aria-label', btn.title);
    });
  }

  function toggleTema() {
    var next = isLightTheme() ? 'dark' : 'light';
    console.log('[IEM] toggleTema →', next);
    aplicarTema(next);
  }

  var _temaBound = false;
  function bindTemaOnce() {
    if (_temaBound) return;
    _temaBound = true;
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t) return;
      var btn = t.closest ? t.closest('#chooserTema, #btnConsTema') : null;
      if (!btn && (t.id === 'chooserTema' || t.id === 'btnConsTema')) btn = t;
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      toggleTema();
    }, true);
  }

  function restaurarTema() {
    var saved = null;
    try { saved = localStorage.getItem('iem_cons_theme'); } catch (e) {}
    if (saved === 'light') aplicarTema('light');
    else aplicarTema('dark');
  }

  function bind() {
    // Atajos del menú inicial (por si bindRuta falla)
    try {
      var c1 = $('chooserCarga');
      var c2 = $('chooserRuta');
      var ct = $('chooserTema');
      console.log('[IEM] bind chooser els', { carga: !!c1, ruta: !!c2, tema: !!ct });
      if (c1) c1.onclick = function (ev) {
        console.log('[IEM] click Consolidado de carga', ev && ev.type);
        abrirModulo('carga');
      };
      if (c2) c2.onclick = function (ev) {
        console.log('[IEM] click Geolocalización', ev && ev.type);
        abrirModulo('ruta');
      };
      // tema: bindTemaOnce() (delegación)

    } catch (eCh) { console.warn(eCh); }

    aplicarFechaReparto();
    var buscarEl = $('consBuscar');
    if (buscarEl) {
      buscarEl.addEventListener('input', renderBusqueda);
      buscarEl.addEventListener('focus', renderBusqueda);
    }
    document.addEventListener('click', function (e) {
      var box = $('consResultados');
      if (!box) return;
      if (e.target && (e.target.id === 'consBuscar' || box.contains(e.target))) return;
      box.classList.remove('open');
    });
    if ($('btnConsAgregar')) try { $('btnConsAgregar').addEventListener('click', agregarLinea); } catch (eA) {}
    if ($('btnConsLimpiar')) $('btnConsLimpiar').addEventListener('click', function () {
      if (!lineas.length) return;
      if (!window.confirm('¿Vaciar todo el consolidado de hoy?')) return;
      lineas = [];
      saveLocal();
      renderTabla();
    });
    document.querySelectorAll('[data-cons-vista]').forEach(function (b) {
      b.addEventListener('click', function () {
        vista = b.getAttribute('data-cons-vista') || 'detalle';
        renderTabla();
      });
    });
    /* Excel export removido de la UI */
    if ($('btnConsExcelUno')) $('btnConsExcelUno').addEventListener('click', function () { exportExcel('un_camion'); });
    if ($('btnConsExcel')) $('btnConsExcel').addEventListener('click', function () { exportExcel('consolidado'); });
    // Vista previa tipo Acrobat (hojas con diseño). El botón de la barra de la ventana permite imprimir o guardar PDF.
    if ($('btnConsPrintMulti')) $('btnConsPrintMulti').addEventListener('click', function () { imprimir('multi', true); });
    if ($('btnConsPrintUno')) $('btnConsPrintUno').addEventListener('click', function () { imprimir('uno', true); });
    if ($('btnConsPreviewUno')) $('btnConsPreviewUno').addEventListener('click', function () { imprimir('uno', false); });
    if ($('btnConsPreviewMulti')) $('btnConsPreviewMulti').addEventListener('click', function () { imprimir('multi', false); });
    if ($('btnConsDescontar')) $('btnConsDescontar').addEventListener('click', function () { descontarInventario(); });
    // tema lateral: bindTemaOnce()

    if ($('consFiltroTipo')) $('consFiltroTipo').addEventListener('change', renderTabla);
    if ($('consFiltroCamion')) $('consFiltroCamion').addEventListener('change', function () {
      var v = $('consFiltroCamion').value;
      if ($('consCamion') && v) $('consCamion').value = v;
      renderTabla();
    });
    if ($('consCamion')) $('consCamion').addEventListener('change', function () {
      var v = $('consCamion').value;
      if ($('consFiltroCamion')) $('consFiltroCamion').value = v || '';
      renderTabla();
    });
    ['consFecha'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', saveLocal);
    });
    var f1 = $('consFile');
    if (f1) f1.addEventListener('change', function () {
      if (f1.files && f1.files.length) importarArchivos(f1.files);
      f1.value = '';
    });
    var f2 = $('consFolder');
    if (f2) f2.addEventListener('change', function () {
      if (f2.files && f2.files.length) importarArchivos(f2.files);
      f2.value = '';
    });
    var btnRef = $('btnConsRefrescarCarpeta');
    if (btnRef) btnRef.addEventListener('click', function () {
      if (dirHandleCarga) {
        escanearCarpetaCarga(true);
      } else if (lastImportFiles && lastImportFiles.length) {
        importarArchivos(lastImportFiles);
      } else {
        alert('Vincula una carpeta o elige un Excel primero.');
      }
    });
    var btnVin = $('btnVincularCarpeta');
    if (btnVin) btnVin.addEventListener('click', function () { vincularCarpetaCarga(); });
    var cbAuto = $('consAutoPdf');
    if (cbAuto) {
      try {
        var saved = localStorage.getItem('iem_auto_pdf');
        if (saved === '0') cbAuto.checked = false;
        if (saved === '1') cbAuto.checked = true;
      } catch (eA) {}
      cbAuto.addEventListener('change', function () {
        try { localStorage.setItem('iem_auto_pdf', cbAuto.checked ? '1' : '0'); } catch (e) {}
      });
    }
    // Al volver a la pestaña: re-escanear carpeta vinculada o última importación
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      if (dirHandleCarga) {
        escanearCarpetaCarga(false);
      } else if (lastImportFiles && lastImportFiles.length) {
        try { importarArchivos(lastImportFiles); } catch (eR) {}
      }
    });
    // Panel config (+) solo admin — doble clic o pulsación larga
    (function () {
      var btn = $('btnAdminConfig');
      var panel = $('consAdminPanel');
      var btnClose = $('btnAdminCerrar');
      if (!btn || !panel) return;
      var pressTimer = null;
      function openAdmin() {
        panel.hidden = false;
        btn.style.opacity = '0.85';
      }
      function closeAdmin() {
        panel.hidden = true;
        btn.style.opacity = '';
      }
      btn.addEventListener('dblclick', function (ev) {
        ev.preventDefault();
        openAdmin();
      });
      btn.addEventListener('click', function (ev) {
        // un clic solo no abre (evita toques accidentales)
        ev.preventDefault();
      });
      btn.addEventListener('pointerdown', function () {
        pressTimer = setTimeout(function () { openAdmin(); }, 650);
      });
      btn.addEventListener('pointerup', function () {
        if (pressTimer) clearTimeout(pressTimer);
        pressTimer = null;
      });
      btn.addEventListener('pointerleave', function () {
        if (pressTimer) clearTimeout(pressTimer);
        pressTimer = null;
      });
      if (btnClose) btnClose.addEventListener('click', closeAdmin);
    })();

  }


  // ============================================================
  // RUTA / GEO — Liquidación de reparto (cobranza)
  // ============================================================
  var rutaParadas = []; // { vendedor, camion, cliente, nombre, direccion, lat, lng, numCp, saldo, placa, fecha }
  var clientesGeo = []; // cache from supabase
  var _geoCache = Object.create(null); // dirección normalizada → {lat,lng} o null
  var _geoQueueBusy = false;

  var miUbicacion = null; // { lat, lng }

  /** GPS válido: no null/NaN y no el punto (0,0) / Null Island */
  function esGpsValido(lat, lng) {
    var la = Number(lat), lo = Number(lng);
    if (!isFinite(la) || !isFinite(lo)) return false;
    // 0,0 o valores residuales muy cercanos a cero se consideran inválidos
    if (Math.abs(la) < 0.01 && Math.abs(lo) < 0.01) return false;
    // Perú aprox. (lat -18..-0, lng -82..-68) — fuera de rango amplio = sospechoso pero se acepta
    return true;
  }

  function mapsLink(lat, lng) {
    if (!esGpsValido(lat, lng)) return '';
    // destination only = el usuario elige cómo llegar; con origin = navegación directa
    var url = 'https://www.google.com/maps/dir/?api=1&destination=' +
      encodeURIComponent(Number(lat) + ',' + Number(lng)) + '&travelmode=driving';
    if (miUbicacion) {
      url += '&origin=' + encodeURIComponent(miUbicacion.lat + ',' + miUbicacion.lng);
    }
    return url;
  }

  /**
   * Geocodifica una dirección con Nominatim (OSM). Sin API key.
   * Bias a Perú. Respeta rate-limit (~1 req/s). Cache en memoria.
   */
  async function geocodeDireccion(direccion, opts) {
    opts = opts || {};
    var q = String(direccion || '').trim();
    if (!q || q.length < 5) return null;
    var key = normTxt(q);
    if (_geoCache[key] !== undefined) return _geoCache[key];

    // Añadir contexto Perú / Cusco si no lo tiene
    var query = q;
    if (!/peru|perú|cusco|cuzco|lima/i.test(query)) {
      query = q + ', Cusco, Peru';
    }

    try {
      var url = 'https://nominatim.openstreetmap.org/search?' +
        'q=' + encodeURIComponent(query) +
        '&format=json&limit=1&countrycodes=pe&addressdetails=0';
      var res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          // Nominatim pide User-Agent identificable
          'User-Agent': 'IEM-ConsolidadoCarga/1.3 (reparto; contacto@local)'
        }
      });
      if (!res.ok) {
        _geoCache[key] = null;
        return null;
      }
      var data = await res.json();
      if (data && data[0] && data[0].lat && data[0].lon) {
        var la = parseFloat(data[0].lat);
        var lo = parseFloat(data[0].lon);
        if (esGpsValido(la, lo)) {
          var hit = { lat: la, lng: lo, source: 'nominatim', display: data[0].display_name || '' };
          _geoCache[key] = hit;
          return hit;
        }
      }
      _geoCache[key] = null;
      return null;
    } catch (e) {
      console.warn('[IEM] geocode', e);
      return null; // no cachear error de red para reintentar
    }
  }

  /**
   * Guarda lat/lng en Supabase (clientes_ubicaciones) para reutilizar la próxima vez.
   * También actualiza el cache en memoria. Si falla RLS, no rompe el flujo.
   */
  async function guardarUbicacionCliente(codigo, direccion, lat, lng) {
    var cod = String(codigo || '').trim();
    var dir = String(direccion || '').trim();
    if (!cod || !dir || !esGpsValido(lat, lng)) return { ok: false, reason: 'datos' };

    // Actualizar cache en memoria de inmediato
    if (!clientesGeo._ubs) clientesGeo._ubs = [];
    var found = false;
    for (var i = 0; i < clientesGeo._ubs.length; i++) {
      var u = clientesGeo._ubs[i];
      if (String(u.cliente_codigo || '').trim() === cod && normTxt(u.direccion) === normTxt(dir)) {
        u.latitud = lat;
        u.longitud = lng;
        found = true;
        break;
      }
    }
    if (!found) {
      clientesGeo._ubs.push({
        cliente_codigo: cod,
        direccion: dir,
        latitud: lat,
        longitud: lng,
        codigo_zona: null
      });
    }
    // Si el cliente principal no tiene GPS, también rellenar el cache principal
    for (var j = 0; j < clientesGeo.length; j++) {
      if (String(clientesGeo[j].codigo || '').trim() === cod) {
        if (!esGpsValido(clientesGeo[j].latitud, clientesGeo[j].longitud)) {
          clientesGeo[j].latitud = lat;
          clientesGeo[j].longitud = lng;
          if (!clientesGeo[j].direccion) clientesGeo[j].direccion = dir;
        }
        break;
      }
    }

    if (!supabase) return { ok: false, reason: 'sin-supabase' };

    try {
      // 1) Intentar upsert en clientes_ubicaciones (varias direcciones por cliente)
      var rowUb = {
        cliente_codigo: cod,
        direccion: dir,
        latitud: lat,
        longitud: lng
      };
      var up = await supabase.from('clientes_ubicaciones').upsert(rowUb, {
        onConflict: 'cliente_codigo,direccion',
        ignoreDuplicates: false
      });
      if (!up.error) {
        return { ok: true, where: 'clientes_ubicaciones' };
      }
      // Si no hay constraint único, intentar insert simple
      var ins = await supabase.from('clientes_ubicaciones').insert(rowUb);
      if (!ins.error) {
        return { ok: true, where: 'clientes_ubicaciones-insert' };
      }
      console.warn('[IEM] guardar ubicacion (tabla ubicaciones):', up.error || ins.error);

      // 2) Fallback: actualizar lat/lng del cliente principal si la dirección es parecida o no tiene GPS
      var cRes = await supabase.from('clientes')
        .select('codigo,direccion,latitud,longitud')
        .eq('codigo', cod)
        .maybeSingle();
      if (cRes.data) {
        var c = cRes.data;
        var sinGps = !esGpsValido(c.latitud, c.longitud);
        var mismaDir = !c.direccion || scoreDirMatch(c.direccion, dir) >= 0.55;
        if (sinGps || mismaDir) {
          var patch = { latitud: lat, longitud: lng };
          if (!c.direccion && dir) patch.direccion = dir;
          var upd = await supabase.from('clientes').update(patch).eq('codigo', cod);
          if (!upd.error) {
            return { ok: true, where: 'clientes' };
          }
          console.warn('[IEM] guardar ubicacion (clientes):', upd.error);
        }
      }
      return { ok: false, reason: (up.error && up.error.message) || (ins.error && ins.error.message) || 'rls' };
    } catch (e) {
      console.warn('[IEM] guardar ubicacion', e);
      return { ok: false, reason: e.message || String(e) };
    }
  }

  /**
   * Rellena GPS faltantes de las paradas actuales usando Nominatim.
   * Solo las que tienen dirección y no tienen GPS válido.
   * Rate-limit ~1.1 s entre llamadas. Guarda en Supabase lo que se resuelva.
   */
  async function geocodeParadasFaltantes(paradas, onProgress) {
    if (_geoQueueBusy) return;
    var lista = (paradas || rutaParadas).filter(function (p) {
      return p && p.direccion && String(p.direccion).trim().length >= 5 && !esGpsValido(p.lat, p.lng);
    });
    if (!lista.length) {
      if (onProgress) onProgress(0, 0, 'Nada que geocodificar');
      return;
    }
    _geoQueueBusy = true;
    var ok = 0;
    var saved = 0;
    try {
      for (var i = 0; i < lista.length; i++) {
        var p = lista[i];
        if (onProgress) onProgress(i + 1, lista.length, p.direccion);
        var g = await geocodeDireccion(p.direccion);
        if (g && esGpsValido(g.lat, g.lng)) {
          p.lat = g.lat;
          p.lng = g.lng;
          p._geoSource = 'nominatim';
          ok++;
          // Guardar en Supabase + cache
          var r = await guardarUbicacionCliente(p.cliente, p.direccion, g.lat, g.lng);
          if (r && r.ok) saved++;
        }
        // rate limit Nominatim
        if (i < lista.length - 1) await new Promise(function (r) { setTimeout(r, 1100); });
      }
    } finally {
      _geoQueueBusy = false;
    }
    try {
      localStorage.setItem('iem_ruta_reparto', JSON.stringify({ ts: Date.now(), paradas: rutaParadas }));
    } catch (e) {}
    if (onProgress) {
      onProgress(lista.length, lista.length,
        'Listo · ' + ok + ' geocodificadas' + (saved ? ' · ' + saved + ' guardadas en catálogo' : ''));
    }
    actualizarSelectRuta();
    renderRutaLista();
    try { actualizarMapaRuta(); } catch (e) {}
  }

  /** Distancia aproximada en km (Haversine rápida). */
  function distKm(aLat, aLng, bLat, bLng) {
    var R = 6371;
    var dLat = (bLat - aLat) * Math.PI / 180;
    var dLng = (bLng - aLng) * Math.PI / 180;
    var la1 = aLat * Math.PI / 180;
    var la2 = bLat * Math.PI / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /**
   * Orden nearest-neighbor desde origen (mi ubicación o primer punto).
   * Mejora el orden de visita respecto al Excel.
   */
  function ordenarPorCercania(puntos) {
    var con = (puntos || []).filter(function (p) {
      return esGpsValido(p.lat, p.lng);
    }).map(function (p) {
      return {
        lat: Number(p.lat),
        lng: Number(p.lng),
        nombre: p.nombre || p.cliente || '',
        cliente: p.cliente || '',
        direccion: p.direccion || '',
        camion: p.camion || '',
        placa: p.placa || '',
        raw: p
      };
    });
    if (con.length <= 1) return con;
    var startLat = miUbicacion ? miUbicacion.lat : con[0].lat;
    var startLng = miUbicacion ? miUbicacion.lng : con[0].lng;
    var left = con.slice();
    var ordered = [];
    var curLat = startLat;
    var curLng = startLng;
    while (left.length) {
      var bestI = 0;
      var bestD = Infinity;
      for (var i = 0; i < left.length; i++) {
        var d = distKm(curLat, curLng, left[i].lat, left[i].lng);
        if (d < bestD) { bestD = d; bestI = i; }
      }
      var next = left.splice(bestI, 1)[0];
      ordered.push(next);
      curLat = next.lat;
      curLng = next.lng;
    }
    return ordered;
  }

  /**
   * Google Maps URL (modo direcciones) soporta ~1 origen + ~9 waypoints + destino.
   * Con más paradas hay que partir en tramos.
   * MAX_WP = waypoints intermedios (sin contar destino).
   */
  var MAPS_MAX_WAYPOINTS = 8;

  function mapsUrlTramo(pts, usarOrigen) {
    if (!pts || !pts.length) return '';
    if (pts.length === 1) {
      var u = 'https://www.google.com/maps/dir/?api=1&destination=' +
        encodeURIComponent(pts[0].lat + ',' + pts[0].lng) + '&travelmode=driving';
      if (usarOrigen && miUbicacion) {
        u += '&origin=' + encodeURIComponent(miUbicacion.lat + ',' + miUbicacion.lng);
      }
      return u;
    }
    var dest = pts[pts.length - 1];
    var mids = pts.slice(0, -1);
    var wps = mids.map(function (p) { return p.lat + ',' + p.lng; }).join('|');
    var url = 'https://www.google.com/maps/dir/?api=1&destination=' +
      encodeURIComponent(dest.lat + ',' + dest.lng) +
      (wps ? ('&waypoints=' + encodeURIComponent(wps)) : '') +
      '&travelmode=driving';
    if (usarOrigen && miUbicacion) {
      url += '&origin=' + encodeURIComponent(miUbicacion.lat + ',' + miUbicacion.lng);
    }
    return url;
  }

  /** Devuelve [{ label, url, count, pts }] tramos listos para abrir en Maps. */
  function mapsTramos(puntos) {
    var ordered = ordenarPorCercania(puntos);
    if (!ordered.length) return [];
    // tamaño de tramo = waypoints + destino ≈ 9 puntos
    var size = MAPS_MAX_WAYPOINTS + 1;
    var tramos = [];
    for (var i = 0; i < ordered.length; i += size) {
      var chunk = ordered.slice(i, i + size);
      // Continuidad: el destino del tramo anterior puede ser origen visual del siguiente
      // (Google no permite fijar origen arbitrario sin ser "mi ubicación", solo 1er tramo usa GPS)
      tramos.push({
        label: 'Tramo ' + (tramos.length + 1),
        url: mapsUrlTramo(chunk, tramos.length === 0),
        count: chunk.length,
        pts: chunk
      });
    }
    // renumerar labels con total
    tramos.forEach(function (t, idx) {
      t.label = 'Tramo ' + (idx + 1) + ' de ' + tramos.length + ' (' + t.count + ' paradas)';
    });
    return tramos;
  }

  /** Compat: un solo link (primer tramo). Preferir mapsTramos + UI. */
  function mapsLinkMulti(puntos) {
    var t = mapsTramos(puntos);
    return t.length ? t[0].url : '';
  }

  /** KML con todos los pines — se importa en Google My Maps / Earth y se ven TODOS. */
  function generarKml(puntos, nombre) {
    var ordered = ordenarPorCercania(puntos);
    var nombreDoc = nombre || 'Ruta reparto';
    var placemarks = ordered.map(function (p, i) {
      var nom = (i + 1) + '. ' + (p.nombre || p.cliente || 'Parada');
      var desc = (p.direccion || '') + (p.cliente ? ('\\nCódigo: ' + p.cliente) : '');
      return '<Placemark>' +
        '<name>' + escXml(nom) + '</name>' +
        '<description>' + escXml(desc) + '</description>' +
        '<Point><coordinates>' + p.lng + ',' + p.lat + ',0</coordinates></Point>' +
        '</Placemark>';
    }).join('');
    return '<?xml version="1.0" encoding="UTF-8"?>' +
      '<kml xmlns="http://www.opengis.net/kml/2.2">' +
      '<Document><name>' + escXml(nombreDoc) + '</name>' + placemarks + '</Document></kml>';
  }

  function escXml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function descargarKml(puntos, filename) {
    var kml = generarKml(puntos, filename || 'ruta');
    var blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (filename || 'ruta_reparto') + '.kml';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  function generarGpx(puntos, nombre) {
    var ordered = ordenarPorCercania(puntos);
    var nombreDoc = nombre || 'Ruta reparto';
    var wpts = ordered.map(function (p, i) {
      return '<wpt lat="' + p.lat + '" lon="' + p.lng + '">' +
        '<name>' + escXml((i + 1) + '. ' + (p.nombre || p.cliente || 'Parada')) + '</name>' +
        '<desc>' + escXml(p.direccion || '') + '</desc></wpt>';
    }).join('');
    var trkpts = ordered.map(function (p) {
      return '<trkpt lat="' + p.lat + '" lon="' + p.lng + '"></trkpt>';
    }).join('');
    return '<?xml version="1.0" encoding="UTF-8"?>' +
      '<gpx version="1.1" creator="IEM Consolidado" xmlns="http://www.topografix.com/GPX/1/1">' +
      '<metadata><name>' + escXml(nombreDoc) + '</name></metadata>' +
      wpts +
      '<trk><name>' + escXml(nombreDoc) + '</name><trkseg>' + trkpts + '</trkseg></trk></gpx>';
  }

  function descargarGpx(puntos, filename) {
    var gpx = generarGpx(puntos, filename || 'ruta');
    var blob = new Blob([gpx], { type: 'application/gpx+xml' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (filename || 'ruta_reparto') + '.gpx';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  /**
   * Abre panel de tramos + opciones: ir a una parada, tramo en Maps, o KML (todos los pines).
   */
  function abrirPanelMaps(puntos, titulo) {
    var con = (puntos || []).filter(function (p) {
      return esGpsValido(p.lat, p.lng);
    });
    if (!con.length) {
      alert('No hay paradas con GPS para este transporte.');
      return;
    }
    var tramos = mapsTramos(con);
    var ordered = ordenarPorCercania(con);

    var overlay = document.getElementById('rutaMapsOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'rutaMapsOverlay';
      overlay.innerHTML =
        '<div class="ruta-maps-modal" role="dialog" aria-modal="true">' +
        '<div class="ruta-maps-head">' +
        '<strong id="rutaMapsTitulo">Google Maps</strong>' +
        '<button type="button" class="btn btn-outline btn-sm" id="rutaMapsCerrar">Cerrar</button>' +
        '</div>' +
        '<p class="ruta-maps-hint" id="rutaMapsHint"></p>' +
        '<div class="ruta-maps-actions" id="rutaMapsActions"></div>' +
        '<div class="ruta-maps-list" id="rutaMapsList"></div>' +
        '</div>';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', function (ev) {
        if (ev.target === overlay) overlay.classList.remove('open');
      });
      document.getElementById('rutaMapsCerrar').addEventListener('click', function () {
        overlay.classList.remove('open');
      });
    }

    document.getElementById('rutaMapsTitulo').textContent = titulo || 'Ruta en Google Maps';
    document.getElementById('rutaMapsHint').textContent =
      con.length + ' paradas con GPS. Google Maps solo permite ~10 por ruta: ' +
      'elige un tramo, una parada suelta, o descarga KML para ver TODOS los pines en My Maps.';

    var actions = document.getElementById('rutaMapsActions');
    var htmlAct = '';
    tramos.forEach(function (t, idx) {
      htmlAct += '<a class="btn btn-primary btn-sm" href="' + t.url +
        '" target="_blank" rel="noopener">' + esc(t.label) + '</a>';
    });
        htmlAct += '<button type="button" class="btn btn-outline btn-sm" id="rutaMapsKml">📥 KML (My Maps)</button>';
    htmlAct += '<button type="button" class="btn btn-outline btn-sm" id="rutaMapsGpx">📥 GPX (OsmAnd / Organic)</button>';
    actions.innerHTML = htmlAct;
    var fnameSafe = (titulo || 'ruta').replace(/\s+/g, '_');
    var btnKml = document.getElementById('rutaMapsKml');
    if (btnKml) {
      btnKml.onclick = function () { descargarKml(con, fnameSafe); };
    }
    var btnGpx = document.getElementById('rutaMapsGpx');
    if (btnGpx) {
      btnGpx.onclick = function () { descargarGpx(con, fnameSafe); };
    }


    var list = document.getElementById('rutaMapsList');
    list.innerHTML = ordered.map(function (p, i) {
      var href = mapsLink(p.lat, p.lng);
      return '<a class="ruta-maps-item" href="' + href + '" target="_blank" rel="noopener">' +
        '<span class="n">' + (i + 1) + '</span>' +
        '<span class="txt"><b>' + esc(p.nombre || p.cliente) + '</b>' +
        '<small>' + esc(p.direccion || '') + '</small></span>' +
        '<span class="go">Ir →</span></a>';
    }).join('');

    overlay.classList.add('open');
  }

  function capturarMiUbicacion() {
    var el = $('rutaGeoYo');
    if (!navigator.geolocation) {
      if (el) el.textContent = 'GPS no disponible en este dispositivo';
      return Promise.resolve(null);
    }
    if (el) el.textContent = 'Obteniendo ubicación…';
    return new Promise(function (resolve) {
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          miUbicacion = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (el) {
            el.textContent = 'Origen: ' + miUbicacion.lat.toFixed(5) + ', ' + miUbicacion.lng.toFixed(5) +
              ' (±' + Math.round(pos.coords.accuracy || 0) + ' m)';
          }
          resolve(miUbicacion);
        },
        function (err) {
          console.warn(err);
          if (el) el.textContent = 'No se pudo obtener GPS. Maps abrirá sin origen.';
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
      );
    });
  }

  async function cargarClientesGeo() {
    if (!supabase) return;
    clientesGeo = [];
    try {
      var PAGE = 1000, from = 0, all = [];
      for (;;) {
        var res = await supabase.from('clientes')
          .select('codigo,nombre,direccion,latitud,longitud')
          .range(from, from + PAGE - 1);
        if (res.error) throw res.error;
        if (!res.data || !res.data.length) break;
        all = all.concat(res.data);
        if (res.data.length < PAGE) break;
        from += PAGE;
        if (from > 60000) break;
      }
      clientesGeo = all;
      // ubicaciones extra
      try {
        var u = await supabase.from('clientes_ubicaciones')
          .select('cliente_codigo,direccion,latitud,longitud,codigo_zona')
          .limit(20000);
        if (u.data) clientesGeo._ubs = u.data;
      } catch (e2) { clientesGeo._ubs = []; }
    } catch (e) {
      console.warn('clientes geo', e);
    }
  }

  function normTxt(s) {
    return String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ').trim();
  }

  /** Tokens alfanuméricos de una dirección (para match fuzzy entre catálogo y liquidación). */
  function dirTokens(s) {
    return normTxt(s).replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
      .split(' ').filter(function (t) { return t.length >= 2; });
  }

  /**
   * Puntuación 0..1 de similitud entre dos direcciones.
   * Prioriza solapamiento de tokens y subcadena larga.
   */
  function scoreDirMatch(a, b) {
    var na = normTxt(a), nb = normTxt(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    if (na.indexOf(nb) >= 0 || nb.indexOf(na) >= 0) {
      var shorter = Math.min(na.length, nb.length);
      var longer = Math.max(na.length, nb.length);
      return 0.75 + 0.25 * (shorter / longer);
    }
    var ta = dirTokens(a), tb = dirTokens(b);
    if (!ta.length || !tb.length) return 0;
    var setB = {};
    tb.forEach(function (t) { setB[t] = true; });
    var inter = 0;
    ta.forEach(function (t) { if (setB[t]) inter++; });
    var union = ta.length + tb.length - inter;
    var jaccard = union ? inter / union : 0;
    // bonus si los primeros tokens coinciden (calle / urbanización)
    var prefixBonus = 0;
    var nPref = Math.min(3, ta.length, tb.length);
    for (var i = 0; i < nPref; i++) {
      if (ta[i] === tb[i]) prefixBonus += 0.08;
    }
    return Math.min(1, jaccard * 0.85 + prefixBonus);
  }

  /**
   * Resuelve lat/lng del cliente según la dirección de entrega usada.
   * Un cliente puede tener varias ubicaciones en clientes_ubicaciones;
   * se elige la que mejor coincida con la dirección de la liquidación.
   */
  function matchClienteGeo(codigo, direccion) {
    var cod = String(codigo || '').trim();
    var dirN = normTxt(direccion);
    var c = null;
    for (var i = 0; i < clientesGeo.length; i++) {
      if (String(clientesGeo[i].codigo || '').trim() === cod) { c = clientesGeo[i]; break; }
    }
    var candidates = [];
    // ubicación principal del catálogo clientes
    if (c && c.latitud != null && c.longitud != null && esGpsValido(c.latitud, c.longitud)) {
      candidates.push({
        lat: Number(c.latitud),
        lng: Number(c.longitud),
        dir: c.direccion || '',
        source: 'principal'
      });
    }
    // ubicaciones adicionales
    var ubs = clientesGeo._ubs || [];
    for (var j = 0; j < ubs.length; j++) {
      if (String(ubs[j].cliente_codigo || '').trim() !== cod) continue;
      if (!esGpsValido(ubs[j].latitud, ubs[j].longitud)) continue;
      candidates.push({
        lat: Number(ubs[j].latitud),
        lng: Number(ubs[j].longitud),
        dir: ubs[j].direccion || '',
        source: 'ubicacion'
      });
    }
    if (!candidates.length) {
      return { lat: null, lng: null, nombreCat: c && c.nombre };
    }
    // sin dirección en liquidación → primera con GPS válido
    if (!dirN) {
      var first = candidates[0];
      return { lat: first.lat, lng: first.lng, nombreCat: c && c.nombre };
    }
    // elegir mejor match por dirección
    var best = null;
    var bestScore = -1;
    for (var k = 0; k < candidates.length; k++) {
      var sc = scoreDirMatch(dirN, candidates[k].dir);
      if (sc > bestScore) {
        bestScore = sc;
        best = candidates[k];
      }
    }
    // umbral mínimo: si el mejor score es muy bajo, aún usamos el mejor disponible
    // (mejor un GPS aproximado del cliente que ninguno)
    if (best && esGpsValido(best.lat, best.lng)) {
      return { lat: best.lat, lng: best.lng, nombreCat: c && c.nombre, matchScore: bestScore };
    }
    return { lat: null, lng: null, nombreCat: c && c.nombre };
  }

  /** Normaliza fecha de Excel (DD/MM/YYYY, D/M/YYYY, YYYY-MM-DD, etc.) a YYYY-MM-DD */
  function normalizeFechaStr(f) {
    var s = String(f == null ? '' : f).trim();
    if (!s) return '';
    // ya ISO (con o sin hora)
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    // DD/MM/YYYY o D/M/YYYY o DD-MM-YYYY
    var m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (m) {
      return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    }
    // DD/MM/YY (año 2 dígitos → 2000+)
    m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
    if (m) {
      var yy = parseInt(m[3], 10);
      var yyyy = yy < 50 ? 2000 + yy : 1900 + yy;
      return yyyy + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    }
    // Excel serial number (días desde 1899-12-30)
    var n = Number(s);
    if (!isNaN(n) && n > 20000 && n < 60000) {
      var epoch = new Date(Date.UTC(1899, 11, 30));
      epoch.setUTCDate(epoch.getUTCDate() + Math.floor(n));
      var y = epoch.getUTCFullYear();
      var mo = String(epoch.getUTCMonth() + 1).padStart(2, '0');
      var d = String(epoch.getUTCDate()).padStart(2, '0');
      return y + '-' + mo + '-' + d;
    }
    return s.slice(0, 10);
  }

  function filaLiquidacionAParada(row) {
    var tipo = String(valRow(row, [
      'Tipo', 'tipo', 'TipoDocumento', 'Tipo Documento', 'TipoDoc', 'Tipo Doc',
      'ClaseDocumento', 'Clase Documento'
    ])).toUpperCase();
    // solo ventas con entrega (omitir notas crédito sin dirección útil si se desea)
    var codCli = String(valRow(row, [
      'CodigoCliente', 'CódigoCliente', 'ClienteCodigo', 'Codigo Cliente',
      'CodCliente', 'CODIGOCLIENTE', 'Cliente', 'codigo_cliente', 'Cod. Cliente'
    ])).trim();
    if (!codCli) {
      // fallback: buscar cualquier key que parezca código cliente
      Object.keys(row || {}).forEach(function (k) {
        if (codCli) return;
        if (normKey(k).indexOf('CODIGOCLIENTE') >= 0 || normKey(k) === 'CODCLIENTE' ||
            normKey(k) === 'CLIENTE' || normKey(k).indexOf('CODCLIENTE') >= 0) {
          var v = String(row[k] || '').trim();
          if (v && /^\d+$/.test(v.replace(/\s/g, ''))) codCli = v;
        }
      });
    }
    if (!codCli) return null;
    var dir = String(valRow(row, [
      'DireccionEntrega', 'Direccion', 'Dirección', 'Direccion Entrega',
      'Dir. Entrega', 'Direccion de Entrega', 'Domicilio'
    ])).trim();
    var vend = String(valRow(row, [
      'CodigoVendedor', 'CódigoVendedor', 'VendedorCodigo', 'Cod. Vendedor',
      'Vendedor', 'CodVendedor'
    ])).trim();
    var camion = String(valRow(row, [
      'NombreVehiculo', 'Camion', 'Camión', 'Vehiculo', 'Vehículo',
      'Transporte', 'Nombre Transporte'
    ])).trim();
    var latLng = matchClienteGeo(codCli, dir);
    return {
      vendedor: vend,
      camion: camion,
      placa: String(valRow(row, ['Placa', 'placa', 'PlacaVehiculo'])).trim(),
      cliente: codCli,
      nombre: String(valRow(row, [
        'NombreCliente', 'ClienteNombre', 'Nombre', 'RazonSocial', 'Razón Social'
      ])).trim() || (latLng.nombreCat || ''),
      direccion: dir,
      lat: latLng.lat,
      lng: latLng.lng,
      numCp: String(valRow(row, ['NumCp', 'NumCP', 'Documento', 'NumDocumento', 'Nro Documento', 'Serie'])).trim(),
      saldo: Number(String(valRow(row, ['Saldo', 'saldo', 'Importe', 'Total'])).replace(',', '.')) || 0,
      fecha: String(valRow(row, [
        'Fecha', 'fecha', 'FechaDocumento', 'Fecha Documento', 'FecDocumento',
        'FechaEmision', 'Fecha Emision', 'Fec. Doc.', 'FechaContable'
      ])).trim(),
      consolidado: String(valRow(row, [
        'NumeroConsolidado', 'Consolidado', 'NroConsolidado', 'NumConsolidado'
      ])).trim(),
      tipo: tipo
    };
  }

  function actualizarSelectRuta() {
    var sel = $('rutaFiltro');
    if (!sel) return;
    // Usar las mismas paradas que la vista (filtradas por fecha de reparto)
    var base = paradasFiltradasBase(); // sin filtro de camión
    var keys = {};
    base.forEach(function (p) {
      var k = p.camion || 'SIN TRANSPORTE';
      keys[k] = true;
    });
    var prev = sel.value;
    sel.innerHTML = '<option value="">Todos los transportes</option>';
    Object.keys(keys).sort().forEach(function (k) {
      var n = base.filter(function (p) { return (p.camion || 'SIN TRANSPORTE') === k; }).length;
      var o = document.createElement('option');
      o.value = k;
      o.textContent = k + ' (' + n + ')';
      sel.appendChild(o);
    });
    if (prev && keys[prev]) sel.value = prev;
  }

  /** Paradas del día (fecha de reparto), sin filtrar por camión */
  function paradasFiltradasBase() {
    var fechaSel = '';
    try { fechaSel = String(($('consFecha') || {}).value || '').trim(); } catch (e) {}
    var list = rutaParadas.slice();
    if (!fechaSel || !/^\d{4}-\d{2}-\d{2}$/.test(fechaSel) || !list.length) {
      return list;
    }
    var filtradas = list.filter(function (p) {
      var pf = normalizeFechaStr(p.fecha);
      // Sin fecha en la fila → se incluye (Excel a veces no trae columna Fecha)
      if (!pf || pf.length < 8) return true;
      return pf === fechaSel;
    });
    // Si el filtro por día deja 0 paradas pero sí hay datos importados,
    // no ocultar todo (fechas del Excel con formato distinto o de otro día).
    // Mejor mostrar todas y que el usuario vea la lista.
    if (!filtradas.length && list.length) {
      console.warn('[IEM] Ninguna parada coincide con fecha', fechaSel,
        '· ejemplos fecha Excel:', list.slice(0, 5).map(function (p) { return p.fecha; }));
      return list;
    }
    return filtradas;
  }

  function paradasFiltradas() {
    var f = String(($('rutaFiltro') || {}).value || '');
    var list = paradasFiltradasBase();
    if (!f) return list;
    return list.filter(function (p) {
      return (p.camion || 'SIN TRANSPORTE') === f;
    });
  }

  function renderRutaLista() {
    var box = $('rutaList');
    var st = $('rutaStats');
    if (!box) return;
    var list = paradasFiltradas();
    // dedupe cliente+dir dentro del filtro para vista
    var seen = Object.create(null);
    var uniq = [];
    list.forEach(function (p) {
      var k = p.cliente + '|' + normTxt(p.direccion);
      if (seen[k]) return;
      seen[k] = true;
      uniq.push(p);
    });
    var conGeo = uniq.filter(function (p) { return esGpsValido(p.lat, p.lng); }).length;
    if (st) {
      st.textContent = uniq.length + ' paradas · ' + conGeo + ' con GPS · ' +
        (uniq.length - conGeo) + ' sin ubicar';
    }
    if (!uniq.length) {
      box.innerHTML = '<div class="ruta-empty"><strong>Ruta / Geolocalización</strong>' +
        '<ol><li>Pulsa <strong>Liquidación / reparto</strong> y elige el Excel de cobranza.</li>' +
        '<li>Elige un <strong>transporte</strong> (camión).</li>' +
        '<li><strong>Usar mi ubicación</strong> (origen) y <strong>Maps · transporte</strong>.</li>' +
        '<li>Opcional: <strong>Publicar a vendedores</strong>.</li></ol>' +
        '<p style="margin:.6rem 0 0">Si no hay GPS, importa antes clientes con lat/long en Inventario.</p></div>';
      try { actualizarMapaRuta(); } catch (e0) {}
      return;
    }
    // agrupar por camión
    var grupos = {};
    uniq.forEach(function (p) {
      var g = p.camion || 'SIN CAMIÓN';
      if (!grupos[g]) grupos[g] = [];
      grupos[g].push(p);
    });
    var html = '';
    Object.keys(grupos).sort().forEach(function (g) {
      var arr = grupos[g];
      var linkAll = mapsLinkMulti(arr);
      var placas = {};
      arr.forEach(function (p) { if (p.placa) placas[p.placa] = true; });
      var placaTxt = Object.keys(placas).join(', ');
      html += '<div class="ruta-transport-head">' +
        '<div><strong>🚛 ' + esc(g) + '</strong>' +
        (placaTxt ? ' · Placa ' + esc(placaTxt) : '') +
        '<div class="meta">' + arr.length + ' paradas' +
        (miUbicacion ? ' · desde tu ubicación' : '') + '</div></div>' +
        (linkAll
          ? '<button type="button" class="btn btn-primary btn-sm maps-link" data-maps-camion="' + esc(g) + '">Maps / elegir parada</button>'
          : '<span class="geo-miss">Sin GPS</span>') +
        '</div>';
      // Primero las SIN GPS (para verlas al toque), luego el resto ordenado por cercanía
      var sinGps = arr.filter(function (p) { return !esGpsValido(p.lat, p.lng); });
      var conGps = arr.filter(function (p) { return esGpsValido(p.lat, p.lng); });
      var arrOrden = ordenarPorCercania(conGps);
      if (!arrOrden.length) {
        arrOrden = conGps.map(function (p) {
          return { raw: p, lat: p.lat, lng: p.lng, nombre: p.nombre, cliente: p.cliente, direccion: p.direccion };
        });
      }
      // Prefijo: bloque destacado de faltantes
      if (sinGps.length) {
        html += '<div class="ruta-missing-box" style="margin:.5rem 0 .75rem;padding:.65rem .8rem;border:1px solid #f59e0b;border-radius:10px;background:rgba(245,158,11,.12)">' +
          '<div style="font-weight:700;color:#fbbf24;margin-bottom:.4rem">⚠ ' + sinGps.length + ' sin GPS — completa lat,lng abajo</div>';
        sinGps.forEach(function (p, idx) {
          var searchUrl = p.direccion
            ? ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.direccion + ', Cusco, Peru'))
            : '';
          html += '<div class="ruta-card ruta-card-missing" data-cliente="' + esc(p.cliente) + '" style="border-color:#f59e0b;margin-bottom:.45rem">' +
            '<h4>⚠ ' + esc(p.nombre || p.cliente) + ' <span class="meta">(' + esc(p.cliente) + ')</span></h4>' +
            '<div class="meta">' + esc(p.direccion || '—') + '</div>' +
            '<div class="meta">Vend ' + esc(p.vendedor || '-') +
            (p.placa ? ' · Placa ' + esc(p.placa) : '') +
            (p.numCp ? ' · ' + esc(p.numCp) : '') + '</div>' +
            '<div class="geo-miss">Sin GPS válido</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:.4rem;align-items:center;margin-top:.45rem">' +
            (searchUrl ? '<a class="maps-link" href="' + searchUrl + '" target="_blank" rel="noopener">Buscar en Google</a>' : '') +
            (p.direccion
              ? '<button type="button" class="btn btn-sm btn-outline btn-geocode" data-dir="' + esc(p.direccion) + '" data-cli="' + esc(p.cliente) + '">📍 Auto</button>'
              : '') +
            '</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:.4rem;align-items:center;margin-top:.45rem">' +
            '<input type="text" class="inp-manual-gps" data-cli="' + esc(p.cliente) + '" data-dir="' + esc(p.direccion || '') + '" ' +
            'placeholder="-13.52, -71.97" style="flex:1;min-width:140px;padding:.4rem .55rem;border-radius:8px;border:1px solid var(--c-border);background:var(--c-bg);color:var(--c-text);font:inherit;font-size:.85rem" />' +
            '<button type="button" class="btn btn-sm btn-primary btn-manual-gps" data-cli="' + esc(p.cliente) + '" data-dir="' + esc(p.direccion || '') + '">Guardar GPS</button>' +
            '</div>' +
            '<div class="meta" style="margin-top:.25rem;opacity:.8">Copia lat,lng de Google (clic derecho → ¿Qué hay aquí?)</div>' +
            '</div>';
        });
        html += '</div>';
      }
      arrOrden.forEach(function (po, idx) {
        var p = po.raw || po;
        var tieneGps = esGpsValido(p.lat, p.lng);
        var geoCls = tieneGps ? 'geo-ok' : 'geo-miss';
        var geoTxt = tieneGps
          ? ('📍 ' + Number(p.lat).toFixed(5) + ', ' + Number(p.lng).toFixed(5) +
            (p._geoSource === 'nominatim' ? ' · OSM' : '') +
            (p._geoSource === 'manual' ? ' · manual' : ''))
          : '⚠ Sin GPS válido';
        var one = mapsLink(p.lat, p.lng);
        html += '<div class="ruta-card" data-cliente="' + esc(p.cliente) + '">' +
          '<h4>' + (idx + 1) + '. ' + esc(p.nombre || p.cliente) + ' <span class="meta">(' + esc(p.cliente) + ')</span></h4>' +
          '<div class="meta">' + esc(p.direccion || '—') + '</div>' +
          '<div class="meta">Vend ' + esc(p.vendedor || '-') +
          (p.placa ? ' · Placa ' + esc(p.placa) : '') +
          (p.numCp ? ' · ' + esc(p.numCp) : '') + '</div>' +
          '<div class="' + geoCls + '">' + geoTxt + '</div>' +
          (one ? '<a class="maps-link" href="' + one + '" target="_blank" rel="noopener">Abrir en Google Maps</a>' : '') +
          '</div>';
      });
    });
    box.innerHTML = html;
    box.querySelectorAll('[data-maps-camion]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cam = btn.getAttribute('data-maps-camion');
        var pts = (grupos[cam] || []).filter(function (p) {
          return esGpsValido(p.lat, p.lng);
        });
        abrirPanelMaps(pts, cam);
      });
    });
    box.querySelectorAll('.btn-geocode').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var dir = btn.getAttribute('data-dir');
        var cli = btn.getAttribute('data-cli');
        btn.disabled = true;
        btn.textContent = 'Buscando…';
        var g = await geocodeDireccion(dir);
        if (g && esGpsValido(g.lat, g.lng)) {
          rutaParadas.forEach(function (p) {
            if (String(p.cliente) === String(cli) && normTxt(p.direccion) === normTxt(dir)) {
              p.lat = g.lat;
              p.lng = g.lng;
              p._geoSource = 'nominatim';
            }
          });
          btn.textContent = 'Guardando…';
          await guardarUbicacionCliente(cli, dir, g.lat, g.lng);
          try {
            localStorage.setItem('iem_ruta_reparto', JSON.stringify({ ts: Date.now(), paradas: rutaParadas }));
          } catch (e) {}
          renderRutaLista();
        } else {
          btn.disabled = false;
          btn.textContent = '📍 Auto';
          alert('No se encontró automáticamente.\nUsa “Buscar en Google”, copia lat,lng y pégalas en el campo de abajo.');
        }
      });
    });
    // Guardar GPS manual (pegar -13.52, -71.97)
    box.querySelectorAll('.btn-manual-gps').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var cli = btn.getAttribute('data-cli');
        var dir = btn.getAttribute('data-dir') || '';
        var inp = box.querySelector('.inp-manual-gps[data-cli="' + cssEscape(cli) + '"][data-dir="' + cssEscape(dir) + '"]') ||
          btn.parentElement.querySelector('.inp-manual-gps');
        var raw = inp ? String(inp.value || '').trim() : '';
        var m = raw.match(/(-?\d+[.,]\d+)\s*[,;\s]\s*(-?\d+[.,]\d+)/);
        if (!m) {
          alert('Pega coordenadas como: -13.52364, -71.97196');
          if (inp) inp.focus();
          return;
        }
        var la = parseFloat(m[1].replace(',', '.'));
        var lo = parseFloat(m[2].replace(',', '.'));
        if (!esGpsValido(la, lo)) {
          alert('Coordenadas no válidas para Cusco/Perú.');
          return;
        }
        btn.disabled = true;
        btn.textContent = 'Guardando…';
        rutaParadas.forEach(function (p) {
          if (String(p.cliente) === String(cli) && normTxt(p.direccion) === normTxt(dir)) {
            p.lat = la;
            p.lng = lo;
            p._geoSource = 'manual';
          }
        });
        await guardarUbicacionCliente(cli, dir, la, lo);
        try {
          localStorage.setItem('iem_ruta_reparto', JSON.stringify({ ts: Date.now(), paradas: rutaParadas }));
        } catch (e) {}
        renderRutaLista();
      });
    });
    try { actualizarMapaRuta(); } catch (eM) {}
  }

  function cssEscape(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  async function importarLiquidacion(file) {
    if (!file) return;
    var st = $('rutaImportStatus');
    if (st) st.textContent = 'Leyendo ' + file.name + '…';
    if (typeof XLSX === 'undefined') {
      if (st) st.textContent = 'Falta librería Excel (XLSX). Recarga la página.';
      return;
    }
    try {
      var buf = await file.arrayBuffer();
      var wb = XLSX.read(buf, { type: 'array' });
      var filas = [];
      var sheetUs = '';
      // Probar todas las hojas hasta encontrar filas con CódigoCliente
      for (var si = 0; si < wb.SheetNames.length; si++) {
        var sh = wb.Sheets[wb.SheetNames[si]];
        var rows = XLSX.utils.sheet_to_json(sh, { defval: '', raw: false });
        if (!rows.length) continue;
        var sample = rows[0];
        var keys = Object.keys(sample || {});
        console.log('[IEM] hoja', wb.SheetNames[si], 'cols', keys.slice(0, 12));
        var tieneCli = keys.some(function (k) {
          var n = normKey(k);
          return n.indexOf('CODIGOCLIENTE') >= 0 || n === 'CLIENTECODIGO' || n === 'CODCLIENTE';
        });
        if (tieneCli || rows.length > filas.length) {
          filas = rows;
          sheetUs = wb.SheetNames[si];
          if (tieneCli) break;
        }
      }
      if (!filas.length) {
        if (st) st.textContent = 'Excel vacío o sin filas legibles.';
        return;
      }
      var out = [];
      var skip = 0;
      filas.forEach(function (row) {
        var p = filaLiquidacionAParada(row);
        if (!p) { skip++; return; }
        if (/NOTA/.test(p.tipo || '') && !p.direccion) { skip++; return; }
        out.push(p);
      });
      console.log('[IEM] liquidación', sheetUs, 'ok=', out.length, 'skip=', skip);
      rutaParadas = out;
      // GPS en segundo plano (no bloquea la lista)
      if (st) st.textContent = 'Importadas ' + out.length + ' paradas. Buscando GPS…';
      actualizarSelectRuta();
      renderRutaLista();
      try {
        localStorage.setItem('iem_ruta_reparto', JSON.stringify({ ts: Date.now(), paradas: rutaParadas }));
      } catch (eL) {}

      (async function () {
        try {
          if (!clientesGeo.length) await cargarClientesGeo();
          // re-match geo
          rutaParadas.forEach(function (p) {
            var g = matchClienteGeo(p.cliente, p.direccion);
            p.lat = g.lat;
            p.lng = g.lng;
            if (!p.nombre && g.nombreCat) p.nombre = g.nombreCat;
          });
          var con = rutaParadas.filter(function (p) { return esGpsValido(p.lat, p.lng); }).length;
          try {
            localStorage.setItem('iem_ruta_reparto', JSON.stringify({ ts: Date.now(), paradas: rutaParadas }));
          } catch (e2) {}
          actualizarSelectRuta();
          renderRutaLista();
          if (st) {
            st.textContent = out.length + ' paradas · ' + con + ' con GPS · hoja «' + sheetUs + '»';
          }
        } catch (eG) {
          console.warn('[IEM] geo match', eG);
          if (st) st.textContent = out.length + ' paradas (sin match GPS: ' + (eG.message || eG) + ')';
        }
      })();
    } catch (e) {
      console.error(e);
      if (st) st.textContent = 'Error: ' + (e.message || e);
    }
  }

  async function publicarRutaVendedores() {
    if (!rutaParadas.length) {
      alert('Primero importa el Excel de liquidación.');
      return;
    }
    if (!supabase) {
      alert('Sin Supabase.');
      return;
    }
    var st = $('rutaStats');
    // dedupe paradas por cliente+dir+vendedor
    var by = Object.create(null);
    rutaParadas.forEach(function (p) {
      var k = p.vendedor + '|' + p.cliente + '|' + normTxt(p.direccion);
      by[k] = p;
    });
    var rows = Object.keys(by).map(function (k) {
      var p = by[k];
      var fecha = (p.fecha || '').slice(0, 10);
      if (fecha && fecha.indexOf('/') >= 0) {
        // dd/mm/yyyy?
        var m = fecha.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (m) fecha = m[3] + '-' + m[2].padStart(2,'0') + '-' + m[1].padStart(2,'0');
      }
      if (!fecha || fecha.length < 8) {
        try { fecha = ($('consFecha') || {}).value || new Date().toISOString().slice(0, 10); } catch (e) {
          fecha = new Date().toISOString().slice(0, 10);
        }
      }
      return {
        fecha: fecha,
        vendedor_codigo: p.vendedor || '',
        camion: p.camion || null,
        placa: p.placa || null,
        cliente_codigo: p.cliente,
        cliente_nombre: p.nombre || null,
        direccion: p.direccion || null,
        latitud: p.lat,
        longitud: p.lng,
        num_cp: p.numCp || null,
        saldo: p.saldo || null,
        consolidado: p.consolidado || null,
        actualizado_en: new Date().toISOString()
      };
    });
    if (st) st.textContent = 'Publicando ' + rows.length + ' paradas…';
    // borrar ruta del mismo día+vendedor y reinsertar (simple)
    var fechas = {};
    rows.forEach(function (r) { fechas[r.fecha] = true; });
    try {
      for (var f in fechas) {
        await supabase.from('rutas_entrega').delete().eq('fecha', f);
      }
      var TAM = 100;
      for (var i = 0; i < rows.length; i += TAM) {
        var lote = rows.slice(i, i + TAM);
        var res = await supabase.from('rutas_entrega').insert(lote);
        if (res.error) throw res.error;
      }
      if (st) st.textContent = '✅ Publicadas ' + rows.length + ' paradas. Los vendedores verán solo las suyas.';
      alert('Ruta publicada. Cada vendedor verá sus clientes en la app de ventas.');
    } catch (e) {
      console.error(e);
      var msg = (e && e.message) || String(e);
      if (/relation.*does not exist|schema cache/i.test(msg)) {
        alert('Falta crear la tabla. Ejecuta SQL_rutas_entrega.sql en Supabase.\n\n' + msg);
      } else {
        alert('Error al publicar: ' + msg);
      }
      if (st) st.textContent = 'Error: ' + msg;
    }
  }


  var _rutaLeafletMap = null;
  var _rutaLeafletLayer = null;
  var _rutaLeafletMarkers = [];

  var CAMION_COLORS = {
    'CAMION 102': '#ef4444',
    'CAMION 103': '#3b82f6',
    'CAMION 104': '#22c55e',
    'CAMION 105': '#a855f7',
    'CAMION 106': '#f97316',
    'CAMION 107': '#b91c1c',
    'CAMION 109': '#0e7490',
    'SIN CAMIÓN': '#64748b',
    'SIN TRANSPORTE': '#64748b'
  };
  var CAMION_COLOR_FALLBACK = ['#e11d48', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#db2777', '#4f46e5'];

  function colorCamion(camion) {
    var k = String(camion || 'SIN CAMIÓN');
    if (CAMION_COLORS[k]) return CAMION_COLORS[k];
    // hash estable
    var h = 0;
    for (var i = 0; i < k.length; i++) h = ((h << 5) - h) + k.charCodeAt(i);
    return CAMION_COLOR_FALLBACK[Math.abs(h) % CAMION_COLOR_FALLBACK.length];
  }

  function markerIcon(color, num) {
    var n = (num != null && num !== '') ? String(num) : '';
    var label = n
      ? ('<text x="14" y="18" text-anchor="middle" font-size="11" font-weight="700" font-family="system-ui,Arial,sans-serif" fill="#0f172a">' + n + '</text>')
      : '<circle cx="14" cy="14" r="5.5" fill="#fff"/>';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">' +
      '<path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="' + color + '" stroke="#fff" stroke-width="1.5"/>' +
      '<circle cx="14" cy="14" r="8" fill="#fff"/>' + label + '</svg>';
    return L.divIcon({
      className: 'ruta-pin',
      html: svg,
      iconSize: [28, 40],
      iconAnchor: [14, 40],
      popupAnchor: [0, -36]
    });
  }

  var _rutaPolyline = null;
  var _rutaOsrmLine = null;
  var _rutaOsrmToken = 0;

  function dibujarRutaEnMapa(ordered) {
    if (!_rutaLeafletMap || !_rutaLeafletLayer) return;
    if (_rutaPolyline) {
      try { _rutaLeafletLayer.removeLayer(_rutaPolyline); } catch (e) {}
      _rutaPolyline = null;
    }
    if (_rutaOsrmLine) {
      try { _rutaLeafletLayer.removeLayer(_rutaOsrmLine); } catch (e) {}
      _rutaOsrmLine = null;
    }
    if (!ordered || ordered.length < 2) return;

    var latlngs = ordered.map(function (p) { return [p.lat, p.lng]; });
    _rutaPolyline = L.polyline(latlngs, {
      color: '#38bdf8',
      weight: 3,
      opacity: 0.55,
      dashArray: '6 8'
    }).addTo(_rutaLeafletLayer);

    if (ordered.length > 60) return;
    var token = ++_rutaOsrmToken;
    var coords = ordered.map(function (p) { return p.lng + ',' + p.lat; }).join(';');
    var url = 'https://router.project-osrm.org/route/v1/driving/' + coords +
      '?overview=full&geometries=geojson&steps=false';
    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      if (token !== _rutaOsrmToken) return;
      if (!data || data.code !== 'Ok' || !data.routes || !data.routes[0]) return;
      var geom = data.routes[0].geometry;
      if (!geom || !geom.coordinates) return;
      var path = geom.coordinates.map(function (c) { return [c[1], c[0]]; });
      if (_rutaOsrmLine) {
        try { _rutaLeafletLayer.removeLayer(_rutaOsrmLine); } catch (e2) {}
      }
      _rutaOsrmLine = L.polyline(path, {
        color: '#2563eb',
        weight: 5,
        opacity: 0.75
      }).addTo(_rutaLeafletLayer);
    }).catch(function () {});
  }

  function actualizarMapaRuta() {
    var wrap = $('rutaMapWrap');
    var hint = $('rutaMapHint');
    var el = $('rutaMap');
    var legend = $('rutaMapLegend');
    if (!el) return;

    if (typeof L === 'undefined') {
      if (hint) {
        hint.style.display = '';
        hint.textContent = 'Mapa no disponible (Leaflet no cargó). Recarga la página.';
      }
      return;
    }

    var list = paradasFiltradas();
    var seen = Object.create(null);
    var pts = [];
    var countsByTruck = Object.create(null);

    list.forEach(function (p) {
      if (!esGpsValido(p.lat, p.lng)) return;
      var k = Number(p.lat).toFixed(5) + ',' + Number(p.lng).toFixed(5) + '|' + String(p.cliente || '') + '|' + String(p.camion || '');
      if (seen[k]) return;
      seen[k] = true;
      var camion = p.camion || 'SIN CAMIÓN';
      countsByTruck[camion] = (countsByTruck[camion] || 0) + 1;
      pts.push({
        lat: Number(p.lat),
        lng: Number(p.lng),
        nom: p.nombre || p.cliente || '',
        cliente: p.cliente || '',
        direccion: p.direccion || '',
        camion: camion,
        placa: p.placa || '',
        vendedor: p.vendedor || '',
        saldo: p.saldo,
        numCp: p.numCp || ''
      });
    });

    if (!pts.length) {
      if (_rutaLeafletMap && _rutaLeafletLayer) {
        _rutaLeafletLayer.clearLayers();
        _rutaPolyline = null;
        _rutaOsrmLine = null;
      }
      if (wrap) wrap.classList.remove('has-map');
      if (hint) {
        hint.style.display = '';
        hint.textContent = rutaParadas.length
          ? 'Hay paradas pero sin GPS en catálogo. Verifica lat/long en clientes (Supabase).'
          : '1) Sube Liquidación de reparto  2) Elige transporte  3) Verás el mapa';
      }
      if (legend) { legend.hidden = true; legend.innerHTML = ''; }
      return;
    }

    if (wrap) wrap.classList.add('has-map');
    if (hint) hint.style.display = 'none';

    if (!_rutaLeafletMap) {
      _rutaLeafletMap = L.map(el, {
        zoomControl: true,
        attributionControl: true
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(_rutaLeafletMap);
      _rutaLeafletLayer = L.layerGroup().addTo(_rutaLeafletMap);
      setTimeout(function () { try { _rutaLeafletMap.invalidateSize(); } catch (e) {} }, 120);
    } else {
      setTimeout(function () { try { _rutaLeafletMap.invalidateSize(); } catch (e) {} }, 60);
    }

    _rutaLeafletLayer.clearLayers();
    _rutaPolyline = null;
    _rutaOsrmLine = null;
    _rutaLeafletMarkers = [];

    var soloUnCamion = Object.keys(countsByTruck).length === 1;
    var ordered = soloUnCamion ? ordenarPorCercania(pts) : pts.slice();
    var numerar = soloUnCamion;

    var bounds = [];
    ordered.forEach(function (p, idx) {
      var color = colorCamion(p.camion);
      var num = numerar ? (idx + 1) : '';
      var saldoTxt = (p.saldo != null && isFinite(Number(p.saldo)))
        ? ('S/ ' + Number(p.saldo).toFixed(2))
        : '—';
      var popup =
        '<div style="min-width:180px;max-width:260px;font-family:system-ui,sans-serif">' +
        (num ? ('<span style="background:#0f172a;color:#fff;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:700;">#' + num + '</span> ') : '') +
        '<b>' + esc(p.nom) + '</b><br>' +
        '<span style="color:#64748b">Código: ' + esc(p.cliente) + '</span><br>' +
        '<hr style="margin:6px 0;border:none;border-top:1px solid #e2e8f0">' +
        '<b>Camión:</b> ' + esc(p.camion) +
        (p.placa ? ' (' + esc(p.placa) + ')' : '') + '<br>' +
        (p.vendedor ? '<b>Vendedor:</b> ' + esc(p.vendedor) + '<br>' : '') +
        '<b>Saldo:</b> ' + saldoTxt + '<br>' +
        (p.numCp ? '<b>Doc:</b> ' + esc(p.numCp) + '<br>' : '') +
        '<b>Dirección:</b><br><small>' + esc(p.direccion || '—') + '</small><br>' +
        '<small style="color:#94a3b8">' + p.lat.toFixed(6) + ', ' + p.lng.toFixed(6) + '</small><br>' +
        '<a href="' + mapsLink(p.lat, p.lng) + '" target="_blank" rel="noopener" style="color:#2563eb;font-weight:600;">Navegar aquí (Maps)</a>' +
        '</div>';
      var m = L.marker([p.lat, p.lng], { icon: markerIcon(color, num) })
        .bindPopup(popup)
        .bindTooltip((num ? ('#' + num + ' ') : '') + (p.nom || p.cliente).slice(0, 36), {
          direction: 'top',
          offset: [0, -30],
          opacity: 0.9
        });
      m.addTo(_rutaLeafletLayer);
      _rutaLeafletMarkers.push(m);
      bounds.push([p.lat, p.lng]);
    });

    if (numerar && ordered.length >= 2) {
      dibujarRutaEnMapa(ordered);
    }

    if (miUbicacion && isFinite(miUbicacion.lat)) {
      L.circleMarker([miUbicacion.lat, miUbicacion.lng], {
        radius: 8, color: '#16a34a', fillColor: '#4ade80', fillOpacity: 0.9, weight: 2
      }).bindTooltip('Tu ubicación').addTo(_rutaLeafletLayer);
      bounds.push([miUbicacion.lat, miUbicacion.lng]);
    }

    try {
      if (bounds.length === 1) {
        _rutaLeafletMap.setView(bounds[0], 15);
      } else {
        _rutaLeafletMap.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
      }
    } catch (eFit) {
      console.warn('[IEM] fitBounds', eFit);
    }

    if (legend) {
      var keys = Object.keys(countsByTruck).sort();
      var htmlLeg = '<b>Camiones · ' + pts.length + ' pts</b>';
      if (numerar) htmlLeg += '<div style="opacity:.85;margin-top:2px">Ruta ordenada + guía</div>';
      keys.forEach(function (k) {
        htmlLeg += '<div class="leg-row"><span class="leg-dot" style="background:' +
          colorCamion(k) + '"></span>' + esc(k) + ' (' + countsByTruck[k] + ')</div>';
      });
      legend.innerHTML = htmlLeg;
      legend.hidden = false;
    }
  }

  function mostrarChooser() {
    console.log('[IEM] mostrarChooser()');
    var ch = $('consChooser');
    var ws = $('consWorkspace');
    if (ws) {
      ws.classList.add('ui-fade-out');
      setTimeout(function () {
        ws.hidden = true;
        ws.classList.remove('ui-fade-out');
        if (ch) {
          ch.hidden = false;
          ch.classList.add('ui-fade-in');
          setTimeout(function () { ch.classList.remove('ui-fade-in'); }, 280);
        }
      }, 160);
    } else if (ch) {
      ch.hidden = false;
    }
    document.body.classList.remove('mode-carga', 'mode-ruta');
    try { localStorage.setItem('iem_cons_mode', ''); } catch (e) {}
  }

  function abrirModulo(mode) {
    console.log('[IEM] abrirModulo(', mode, ')');
    var ch = $('consChooser');
    var ws = $('consWorkspace');
    if (ch) {
      ch.classList.add('ui-fade-out');
      setTimeout(function () {
        ch.hidden = true;
        ch.classList.remove('ui-fade-out');
        if (ws) {
          ws.hidden = false;
          ws.classList.add('ui-fade-in');
          setTimeout(function () { ws.classList.remove('ui-fade-in'); }, 280);
        }
        setMode(mode === 'ruta' ? 'ruta' : 'carga');
      }, 160);
    } else {
      if (ws) ws.hidden = false;
      setMode(mode === 'ruta' ? 'ruta' : 'carga');
    }
  }

  function setMode(mode) {
    console.log('[IEM] setMode(', mode, ')');
    var carga = mode !== 'ruta';
    document.body.classList.toggle('mode-carga', carga);
    document.body.classList.toggle('mode-ruta', !carga);
    document.querySelectorAll('.panel-carga').forEach(function (el) {
      el.hidden = !carga;
      el.style.display = carga ? '' : 'none';
    });
    document.querySelectorAll('.panel-ruta').forEach(function (el) {
      el.hidden = carga;
      el.style.display = carga ? 'none' : '';
    });
    var mc = $('panelMainCarga');
    var mr = $('panelMainRuta');
    if (mc) {
      mc.hidden = !carga;
      mc.style.display = carga ? 'flex' : 'none';
    }
    if (mr) {
      mr.hidden = carga;
      mr.style.display = carga ? 'none' : 'flex';
    }
    // Ocultar texto de estado de ruta en modo carga
    var rs = $('rutaStats');
    if (rs && carga) rs.textContent = '';
    var title = $('consSideTitle');
    if (title) title.textContent = carga ? 'Consolidado' : 'Rutas';
    try { localStorage.setItem('iem_cons_mode', carga ? 'carga' : 'ruta'); } catch (e) {}
    console.log('[IEM] body classes', document.body.className);
    if (!carga) {
      renderRutaLista();
      try { actualizarMapaRuta(); } catch (eM) { console.warn('[IEM] mapa', eM); }
      setTimeout(function () {
        try { if (_rutaLeafletMap) _rutaLeafletMap.invalidateSize(); } catch (eZ) {}
      }, 200);
      if (!clientesGeo.length) cargarClientesGeo();
    } else {
      // UI primero; PDF en el siguiente tick (menos demora al entrar)
      setTimeout(function () {
        try {
          if (dirHandleCarga) {
            escanearCarpetaCarga(true);
          } else if (typeof lineas !== 'undefined' && lineas.length && typeof renderVistaPreviaPanel === 'function') {
            renderVistaPreviaPanel();
          }
        } catch (eP) { console.warn('[IEM] pdf', eP); }
      }, 50);
    }
  }

  function bindRuta() {

    console.log('[IEM] bindRuta() start');
    if ($('chooserCarga')) {
      $('chooserCarga').addEventListener('click', function (ev) {
        console.log('[IEM] addEventListener click carga', ev && ev.type);
        abrirModulo('carga');
      });
    } else console.warn('[IEM] #chooserCarga no existe');
    if ($('chooserRuta')) {
      $('chooserRuta').addEventListener('click', function (ev) {
        console.log('[IEM] addEventListener click ruta', ev && ev.type);
        abrirModulo('ruta');
      });
    } else console.warn('[IEM] #chooserRuta no existe');
    if ($('btnVolverChooser')) {
      $('btnVolverChooser').addEventListener('click', function () {
        console.log('[IEM] click Volver menú');
        mostrarChooser();
      });
    }
    // Tema solo en bind() — evita doble toggle


    if ($('btnModeCarga')) $('btnModeCarga').addEventListener('click', function () { setMode('carga'); });
    if ($('btnModeRuta')) $('btnModeRuta').addEventListener('click', function () { setMode('ruta'); });
    var rf = $('rutaFile');
    if (rf) rf.addEventListener('change', function () {
      if (rf.files && rf.files[0]) importarLiquidacion(rf.files[0]);
      rf.value = '';
    });
    if ($('rutaFiltro')) $('rutaFiltro').addEventListener('change', function () { renderRutaLista(); actualizarMapaRuta(); });
    if ($('btnRutaPublicar')) $('btnRutaPublicar').addEventListener('click', publicarRutaVendedores);
    if ($('btnRutaMiUbicacion')) {
      $('btnRutaMiUbicacion').addEventListener('click', function () {
        capturarMiUbicacion().then(function () { renderRutaLista(); });
      });
    }
    if ($('btnRutaMaps')) $('btnRutaMaps').addEventListener('click', function () {
      var go = function () {
        var list = paradasFiltradas();
        var con = list.filter(function (p) {
          return esGpsValido(p.lat, p.lng);
        });
        if (!con.length) {
          var n = list.length;
          alert(n
            ? ('Hay ' + n + ' paradas pero ninguna con GPS válido.\nUsa «Geocodificar» en cada tarjeta o importa clientes con lat/long en Inventario.')
            : 'No hay paradas. Sube el Excel de liquidación y espera a que termine de importar.');
          return;
        }
        var filtro = String(($('rutaFiltro') || {}).value || '') || 'Transporte';
        abrirPanelMaps(con, filtro === '' ? 'Todos los transportes' : filtro);
      };
      if (!miUbicacion) {
        capturarMiUbicacion().then(go);
      } else go();
    });
    if ($('btnRutaGeocode')) {
      $('btnRutaGeocode').addEventListener('click', function () {
        var st = $('rutaGeoStatus');
        var list = paradasFiltradas();
        var faltan = list.filter(function (p) {
          return p.direccion && String(p.direccion).trim().length >= 5 && !esGpsValido(p.lat, p.lng);
        });
        if (!faltan.length) {
          alert('Todas las paradas del filtro actual ya tienen GPS válido (o no tienen dirección para buscar).');
          return;
        }
        if (!confirm('Se buscarán coordenadas para ' + faltan.length + ' parada(s) sin GPS usando OpenStreetMap.\nPuede tardar ~' + Math.ceil(faltan.length * 1.2) + ' s.\n¿Continuar?')) return;
        if (st) { st.hidden = false; st.textContent = 'Geocodificando…'; }
        geocodeParadasFaltantes(list, function (i, total, msg) {
          if (st) st.textContent = (i < total ? (i + '/' + total + ' · ') : '') + (msg || '');
        }).then(function () {
          if (st) setTimeout(function () { st.hidden = true; }, 4000);
        });
      });
    }
    // Siempre menú principal al entrar; no saltar directo al módulo
    try { mostrarChooser(); } catch (eM0) {}
    try {
      var raw = localStorage.getItem('iem_ruta_reparto');
      if (raw) {
        var o = JSON.parse(raw);
        if (o && Array.isArray(o.paradas)) {
          rutaParadas = o.paradas;
          actualizarSelectRuta();
        }
      }
    } catch (e) {}
  }

  async function main() {
    try { restaurarTema(); } catch (eT) { console.warn('tema', eT); }
    try { bindTemaOnce(); } catch (eTb) { console.warn('bindTema', eTb); }
    try { bind(); } catch (eB) { console.error('bind', eB); }
    try { restaurarCarpetaVinculada(); } catch (eF) { console.warn('carpeta', eF); }
    try { bindRuta(); } catch (eR) { console.error('bindRuta', eR); }
    try { mostrarChooser(); } catch (eC) {}
    try { loadLocal(); } catch (eL) {}
    // No generar PDF hasta entrar al módulo carga
    try {
      var ok = await initSupabase();
      if (ok) {
        try { await cargarCatalogo(); } catch (e) {
          status('Error catálogo: ' + (e.message || e));
        }
      }
    } catch (eS) {
      console.warn('supabase', eS);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
