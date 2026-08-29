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
    if (!catalogo.length || !lineas.length) return;
    var byCod = Object.create(null);
    catalogo.forEach(function (p) { byCod[p.codigo] = p; });
    lineas.forEach(function (l) {
      var cod = String(l.codigo || '').trim();
      if (/^\d{1,3}$/.test(cod)) cod = ('0000' + cod).slice(-4);
      l.codigo = cod;
      var cat = byCod[cod];
      if (cat) {
        l.tipo = cat.tipo || clasificarProducto(cat);
        l.linea = cat.linea || l.linea || '';
        l.descripcion = cat.descripcion || l.descripcion;
        l.codigo_fabrica = cat.codigo_fabrica || l.codigo_fabrica || '';
        if (cat.factor > 1 && !(l.factor > 1)) l.factor = cat.factor;
        if (!l.unidad_ref && cat.unidad_ref) l.unidad_ref = cat.unidad_ref;
      } else {
        l.tipo = clasificarProducto({ descripcion: l.descripcion, linea: l.linea, tipo: l.tipo });
      }
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
    var thead = $('consThead');
    var tbody = $('consTbody');
    var res = $('consResumen');
    if (!thead || !tbody) return;

    document.querySelectorAll('[data-cons-vista]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-cons-vista') === vista);
    });

    var data = lineasFiltradas();

    if (vista === 'detalle') {
      thead.innerHTML = '<tr><th></th><th>Camión</th><th>Tipo</th><th>Código</th><th>Descripción</th><th>Fábrica</th><th>Und.ref</th><th>Cant. und</th></tr>';
      var sorted = data.slice().sort(function (a, b) {
        if (a.camion !== b.camion) return String(a.camion).localeCompare(String(b.camion));
        if (a.tipo !== b.tipo) return a.tipo === 'FRIOS' ? -1 : 1;
        return String(a.codigo).localeCompare(String(b.codigo));
      });
      tbody.innerHTML = sorted.map(function (l, i) {
        var tipCls = l.tipo === 'FRIOS' ? 'badge-frio' : 'badge-seco';
        return '<tr data-i="' + i + '">' +
          '<td><button type="button" class="cons-del" data-idx="' + lineas.indexOf(l) + '" title="Quitar">✕</button></td>' +
          '<td>' + esc(l.camion) + '</td>' +
          '<td class="' + tipCls + '">' + esc(l.tipo) + '</td>' +
          '<td>' + esc(l.codigo) + '</td>' +
          '<td>' + esc(l.descripcion) + '</td>' +
          '<td>' + esc(l.codigo_fabrica) + '</td>' +
          '<td>' + esc(l.unidad_ref) + '</td>' +
          '<td><strong>' + l.cantidad + '</strong></td></tr>';
      }).join('');
      tbody.querySelectorAll('.cons-del').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = parseInt(btn.getAttribute('data-idx'), 10);
          if (isNaN(idx)) return;
          if (!window.confirm('¿Quitar esta línea del consolidado?')) return;
          lineas.splice(idx, 1);
          saveLocal();
          renderTabla();
        });
      });
      if (res) res.textContent = lineas.length + ' línea(s) · ' + sorted.length + ' en vista detalle';
    } else {
      var prevLineas = lineas;
      lineas = data;
      var rows = consolidadoRows();
      lineas = prevLineas;
      thead.innerHTML = '<tr><th>Tipo</th><th>Código</th><th>Descripción</th><th>Fábrica</th><th>Und.ref</th><th>Factor</th><th>Total und</th><th>Cajas≈</th></tr>';
      var html = '';
      var lastTipo = '';
      rows.forEach(function (r) {
        if (r.tipo !== lastTipo) {
          html += '<tr><td colspan="8" class="cons-sec-title">' +
            (r.tipo === 'FRIOS' ? '❄️ FRÍOS' : '📦 SECOS') + '</td></tr>';
          lastTipo = r.tipo;
        }
        var fac = r.factor > 1 ? r.factor : 1;
        var cajas = fac > 1 ? (Math.floor(r.cantidad / fac) + ' cj + ' + (r.cantidad % fac) + ' und') : '—';
        var tipCls = r.tipo === 'FRIOS' ? 'badge-frio' : 'badge-seco';
        html += '<tr><td class="' + tipCls + '">' + esc(r.tipo) + '</td><td>' + esc(r.codigo) +
          '</td><td>' + esc(r.descripcion) + '</td><td>' + esc(r.codigo_fabrica) +
          '</td><td>' + esc(r.unidad_ref) + '</td><td>' + fac +
          '</td><td><strong>' + r.cantidad + '</strong></td><td>' + cajas + '</td></tr>';
      });
      tbody.innerHTML = html || '<tr><td colspan="8">Sin líneas. Agrega productos arriba.</td></tr>';
      if (res) {
        var frios = rows.filter(function (r) { return r.tipo === 'FRIOS'; }).length;
        var secos = rows.filter(function (r) { return r.tipo === 'SECOS'; }).length;
        res.textContent = rows.length + ' productos consolidados · Fríos ' + frios + ' · Secos ' + secos;
      }
    }
  }

  function lineaCategoria(desc, lineaCat) {
    var s = String(lineaCat || desc || '').toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/BASE DE HELADO|HELADO/.test(s) && /BASE|VAINILLA|CHOCOLATE/.test(s)) return 'BASE DE HELADO';
    if (/BEBIDA|WATTS|REFRESCO|NARANJADA/.test(s)) return 'BEBIDAS: BEBIDAS';
    if (/CHICHARRON/.test(s)) return 'CARNICOS: CHICHARRON';
    if (/CHORIZO/.test(s)) return 'CARNICOS: CHORIZO';
    if (/HOT DOG|SALCHICHA/.test(s)) return 'CARNICOS: HOT DOG';
    if (/JAMON\b|JAMÓN/.test(s) && !/JAMONADA/.test(s)) return 'CARNICOS: JAMÓN';
    if (/JAMONADA|MORTADELA/.test(s)) return 'CARNICOS: JAMONADA / MORTADELA';
    if (/EVAPORAD|BOLSITARRO|PRACTITARRO|NUTRILAC/.test(s)) return 'EVAPORADAS: ENTERO (A)';
    if (/YOGUR|YOG\.|BIO DEFENSA|GRIEGO/.test(s)) return 'YOGURES';
    if (/QUESO|CREMA DE QUESO|MOZZARELLA|EDAM|PARMESANO|CHEDDAR|CREAM CHEESE/.test(s)) return 'QUESOS';
    if (/MANTEQUILLA|MARGARINA/.test(s)) return 'MANTEQUILLAS / MARGARINAS';
    if (/MANJAR|FUDGE|DULCE DE LECHE|SIROPE/.test(s)) return 'MANJARES / DULCES';
    if (/LECHE|UHT|ALMENDRA|SOYA|COCO/.test(s)) return 'LECHES / BEBIDAS LÁCTEAS';
    if (/CREMA DE LECHE/.test(s)) return 'CREMAS DE LECHE';
    // del catálogo si viene tipo
    return 'OTROS';
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

    // Separar Fríos y Secos
    var frios = [];
    var secos = [];
    items.forEach(function (it) {
      var t = String(it.tipo || '').toUpperCase();
      if (t.indexOf('FRIO') >= 0) frios.push(it);
      else secos.push(it);
    });

    function volcarBloque(tituloBloque, lista) {
      if (!lista.length) return;
      aoa.push([tituloBloque]);
      var grupos = Object.create(null);
      var orden = [];
      lista.forEach(function (it) {
        var cat = it._categoria || lineaCategoria(it.descripcion);
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


  var LOGO_URL = 'logo-iem.png';

  function fmtPeso(p) {
    var n = Number(p);
    if (!isFinite(n) || n === 0) return '';
    return (Math.round(n * 100) / 100).toFixed(2);
  }

  function buildPrintHtml(titulo, camion, items, fecha, opts) {
    opts = opts || {};
    var numHoja = opts.numHoja != null ? opts.numHoja : '';
    var totalHojas = opts.totalHojas != null ? opts.totalHojas : '';
    var frios = items.filter(function (it) { return String(it.tipo || '').toUpperCase().indexOf('FRIO') >= 0; });
    var secos = items.filter(function (it) { return String(it.tipo || '').toUpperCase().indexOf('FRIO') < 0; });

    function tablaBloque(nombre, colorBg, lista) {
      if (!lista.length) return '';
      var grupos = Object.create(null);
      var orden = [];
      lista.forEach(function (it) {
        var cat = it._categoria || lineaCategoria(it.descripcion, it.linea);
        if (!grupos[cat]) { grupos[cat] = []; orden.push(cat); }
        grupos[cat].push(it);
      });
      orden.sort();
      var h = '<div class="blk-tipo" style="margin:14px 0 6px;padding:8px 12px;border-radius:8px;background:' + colorBg + ';color:#fff;font-weight:800;font-size:12pt;letter-spacing:.04em;">' + esc(nombre) + '</div>';
      var n = 0;
      orden.forEach(function (cat) {
        h += '<div style="font-weight:700;margin:10px 0 4px;font-size:10pt;background:#1e3a5f;color:#fff;padding:5px 10px;border-radius:6px;">' + esc(cat) + '</div>';
        h += '<table style="width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:8px;"><thead><tr style="background:#e2e8f0;">' +
          '<th style="border:1px solid #94a3b8;padding:5px 4px;width:40px;">ITEM</th>' +
          '<th style="border:1px solid #94a3b8;padding:5px 4px;width:56px;">Código</th>' +
          '<th style="border:1px solid #94a3b8;padding:5px 4px;">Producto / Descripción</th>' +
          '<th style="border:1px solid #94a3b8;padding:5px 4px;width:60px;">Unidad</th>' +
          '<th style="border:1px solid #94a3b8;padding:5px 4px;width:48px;">Cajas</th>' +
          '<th style="border:1px solid #94a3b8;padding:5px 4px;width:56px;">Und. sueltas</th>' +
          '<th style="border:1px solid #94a3b8;padding:5px 4px;width:56px;">Peso</th></tr></thead><tbody>';
        grupos[cat].forEach(function (it) {
          n++;
          var fac = Number(it.factor) > 1 ? Number(it.factor) : 1;
          var cu = cantACajasUnd(it.cantidad, fac);
          var pesoTxt = fmtPeso(it.peso);
          h += '<tr><td style="border:1px solid #cbd5e1;padding:4px;text-align:center;">' + n +
            '</td><td style="border:1px solid #cbd5e1;padding:4px;font-family:monospace;font-weight:600;">' + esc(it.codigo) +
            '</td><td style="border:1px solid #cbd5e1;padding:4px;">' + esc(it.descripcion) +
            '</td><td style="border:1px solid #cbd5e1;padding:4px;">' + esc(it.unidad_ref || '') +
            '</td><td style="border:1px solid #cbd5e1;padding:4px;text-align:center;">' + (cu.cajas === '' ? '' : cu.cajas) +
            '</td><td style="border:1px solid #cbd5e1;padding:4px;text-align:center;">' + cu.sueltas +
            '</td><td style="border:1px solid #cbd5e1;padding:4px;text-align:right;">' + pesoTxt + '</td></tr>';
        });
        h += '</tbody></table>';
      });
      return h;
    }

    var piePag = (numHoja !== '' && totalHojas !== '')
      ? (' · Hoja ' + numHoja + ' de ' + totalHojas)
      : '';

    return '<div class="print-page" style="page-break-after:always;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;background:#fff;">' +
      '<div style="display:flex;align-items:center;gap:14px;border-bottom:3px solid #1d4ed8;padding-bottom:10px;margin-bottom:12px;">' +
        '<img src="' + LOGO_URL + '" alt="IEM" style="height:48px;width:auto;object-fit:contain;" onerror="this.style.display=\'none\'" />' +
        '<div style="flex:1;">' +
          '<div style="font-size:14pt;font-weight:800;color:#1e3a5f;letter-spacing:.02em;">' + esc(titulo) + '</div>' +
          '<div style="margin-top:4px;font-size:10pt;">' +
            '<span style="background:#1d4ed8;color:#fff;padding:3px 10px;border-radius:999px;font-weight:700;">' + esc(camion || '') + '</span>' +
            ' &nbsp; <strong>Fecha:</strong> ' + esc(fecha || '') + esc(piePag) +
          '</div>' +
        '</div>' +
      '</div>' +
      tablaBloque('❄ FRÍOS', '#0e7490', frios) +
      tablaBloque('📦 SECOS', '#b45309', secos) +
      '<div style="margin-top:14px;padding-top:8px;border-top:2px solid #1d4ed8;font-size:9pt;color:#475569;">IEM Group · Consolidado de carga' + esc(piePag) + '</div>' +
      '</div>';
  }

  function enriquecerLineas() {
    lineas.forEach(function (l) {
      var cat = catalogo.find(function (p) { return p.codigo === l.codigo; });
      if (cat) {
        if (!l.tipo) l.tipo = cat.tipo;
        if (cat.factor > 1 && !(l.factor > 1)) l.factor = cat.factor;
        if (!l.unidad_ref) l.unidad_ref = cat.unidad_ref;
        l._categoria = lineaCategoria(l.descripcion, cat.linea || cat.marca);
      } else {
        l._categoria = lineaCategoria(l.descripcion);
        if (!l.tipo) l.tipo = 'SECOS';
      }
    });
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
        r._categoria = lineaCategoria(r.descripcion, cat && (cat.linea || cat.marca));
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
    var total = hojas.length;
    return hojas.map(function (h, i) {
      return buildPrintHtml(h.titulo, h.camion, h.items, h.fecha, { numHoja: i + 1, totalHojas: total });
    }).join('');
  }

  function imprimirDesdeHtml(htmlBody) {
    // Iframe oculto: imprime sin abrir otra pestaña
    var id = 'consPrintFrame';
    var old = document.getElementById(id);
    if (old) old.remove();
    var iframe = document.createElement('iframe');
    iframe.id = id;
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write('<!DOCTYPE html><html><head><title>Imprimir consolidado</title>' +
      '<style>@page{margin:12mm} body{margin:0;background:#fff;}' +
      '@media print{.print-page{page-break-after:always}.print-page:last-child{page-break-after:auto}}</style></head><body>' +
      htmlBody + '</body></html>');
    doc.close();
    setTimeout(function () {
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) {}
    }, 300);
  }

  function imprimir(modo) {
    if (!lineas.length) {
      alert('No hay líneas para imprimir.');
      return;
    }
    var hojas = armarHojasDocumento(modo);
    if (!hojas) return;
    var htmlBody = htmlDocumento(hojas);
    imprimirDesdeHtml(htmlBody);
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
        r._categoria = (r.tipo === 'FRIOS' ? 'FRÍOS · ' : 'SECOS · ') + lineaCategoria(r.descripcion, cat && cat.linea);
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

  function bind() {
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
    if ($('btnConsExcelTodos')) $('btnConsExcelTodos').addEventListener('click', function () { exportExcel('todos'); });
    if ($('btnConsExcelUno')) $('btnConsExcelUno').addEventListener('click', function () { exportExcel('un_camion'); });
    if ($('btnConsExcel')) $('btnConsExcel').addEventListener('click', function () { exportExcel('consolidado'); });
    if ($('btnConsPrintMulti')) $('btnConsPrintMulti').addEventListener('click', function () { imprimir('multi'); });
    if ($('btnConsPrintUno')) $('btnConsPrintUno').addEventListener('click', function () { imprimir('uno'); });
    if ($('btnConsDescontar')) $('btnConsDescontar').addEventListener('click', function () { descontarInventario(); });
    if ($('btnConsTema')) $('btnConsTema').addEventListener('click', function () {
      document.body.classList.toggle('light-theme');
    });
    if ($('consFiltroTipo')) $('consFiltroTipo').addEventListener('change', renderTabla);
    if ($('consFiltroCamion')) $('consFiltroCamion').addEventListener('change', function () {
      var v = $('consFiltroCamion').value;
      if ($('consCamion') && v) $('consCamion').value = v;
      renderTabla();
    });
    if ($('consCamion')) $('consCamion').addEventListener('change', function () {
      var v = $('consCamion').value;
      if ($('consFiltroCamion') && v) $('consFiltroCamion').value = v;
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
      if (lastImportFiles && lastImportFiles.length) {
        importarArchivos(lastImportFiles);
      } else {
        alert('Primero elige un Excel o una carpeta.');
      }
    });
    // Al volver a la pestaña, re-leer última importación (carpeta del día)
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      if (lastImportFiles && lastImportFiles.length) {
        try { importarArchivos(lastImportFiles); } catch (eR) {}
      }
    });
  }

  async function main() {
    bind();
    loadLocal();
    renderTabla();
    var ok = await initSupabase();
    if (!ok) return;
    try {
      await cargarCatalogo();
    } catch (e) {
      status('Error catálogo: ' + (e.message || e));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
