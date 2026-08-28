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

  function $(id) { return document.getElementById(id); }
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
    var t = String(p.tipo_almacen || p.tipo || '').toUpperCase();
    if (t.indexOf('FRIO') !== -1) return 'FRIOS';
    if (t.indexOf('SECO') !== -1) return 'SECOS';
    return t || 'SECOS';
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

      var cat = catalogo.find(function (p) { return p.codigo === codigo; });
      var tipo = cat ? cat.tipo : 'SECOS';
      var fab = cat ? cat.codigo_fabrica : '';
      if (!desc && cat) desc = cat.descripcion;
      if (!uref && cat) uref = cat.unidad_ref;
      if (!(factor > 1) && cat && cat.factor > 1) factor = cat.factor;

      out.push({
        camion: camion,
        codigo: codigo,
        descripcion: desc || codigo,
        tipo: tipo,
        unidad_ref: uref || und || '',
        factor: factor,
        cantidad: cant,
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
    // Reemplazar lista actual con lo importado (como el macro: filtra y arma)
    lineas = todas;
    // Fecha desde nombre si posible
    saveLocal();
    vista = 'consolidado';
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
    if (!url || !key || !window.supabase) {
      status('Sin config Supabase (config.js).');
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
        var tipo = String(p.tipo_almacen || '').toUpperCase();
        if (!tipo || (tipo.indexOf('FRIO') < 0 && tipo.indexOf('SECO') < 0)) {
          var lin = String(p.linea || '').toUpperCase();
          if (/FRIO|YOGUR|QUESO|MANTEQ|CREMA|LECHE FRES|SALCH|JAMON|CHORIZ|HOT DOG|TOCIN|JAMONADA/.test(lin + ' ' + (p.descripcion || ''))) {
            tipo = 'FRIOS';
          } else {
            tipo = 'SECOS';
          }
        } else if (tipo.indexOf('FRIO') >= 0) tipo = 'FRIOS';
        else tipo = 'SECOS';
        catalogo.push({
          codigo: String(p.codigo || '').trim(),
          codigo_fabrica: String(p.codigo_fabrica || '').trim(),
          descripcion: String(p.descripcion || '').trim(),
          unidad_ref: String(p.unidad_ref || '').trim(),
          factor: Number(p.factor_empaque) || 1,
          stock: Number(p.stock_teorico) || 0,
          tipo: tipo,
          marca: String(p.marca || '').trim()
        });
      });
      if (res.data.length < PAGE) break;
      from += PAGE;
    }
    status('Catálogo: ' + catalogo.length + ' productos activos · listos para consolidado');
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

  function renderTabla() {
    var thead = $('consThead');
    var tbody = $('consTbody');
    var res = $('consResumen');
    if (!thead || !tbody) return;

    document.querySelectorAll('[data-cons-vista]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-cons-vista') === vista);
    });

    if (vista === 'detalle') {
      thead.innerHTML = '<tr><th></th><th>Camión</th><th>Tipo</th><th>Código</th><th>Descripción</th><th>Fábrica</th><th>Und.ref</th><th>Cant. und</th></tr>';
      var sorted = lineas.slice().sort(function (a, b) {
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
      var rows = consolidadoRows();
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
            ''
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


  function buildPrintHtml(titulo, camion, items, fecha) {
    var frios = items.filter(function (it) { return String(it.tipo || '').toUpperCase().indexOf('FRIO') >= 0; });
    var secos = items.filter(function (it) { return String(it.tipo || '').toUpperCase().indexOf('FRIO') < 0; });
    function tablaBloque(nombre, lista) {
      if (!lista.length) return '';
      var grupos = Object.create(null);
      var orden = [];
      lista.forEach(function (it) {
        var cat = it._categoria || lineaCategoria(it.descripcion);
        if (!grupos[cat]) { grupos[cat] = []; orden.push(cat); }
        grupos[cat].push(it);
      });
      orden.sort();
      var h = '<h2 style="margin:12px 0 6px;font-size:13pt;">' + esc(nombre) + '</h2>';
      var n = 0;
      orden.forEach(function (cat) {
        h += '<div style="font-weight:700;margin:8px 0 4px;font-size:10pt;background:#e2e8f0;padding:3px 6px;">' + esc(cat) + '</div>';
        h += '<table style="width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:6px;"><thead><tr>' +
          '<th style="border:1px solid #333;padding:3px;">ITEM</th>' +
          '<th style="border:1px solid #333;padding:3px;">Código</th>' +
          '<th style="border:1px solid #333;padding:3px;">Producto / Descripción</th>' +
          '<th style="border:1px solid #333;padding:3px;">Unidad</th>' +
          '<th style="border:1px solid #333;padding:3px;">Cajas</th>' +
          '<th style="border:1px solid #333;padding:3px;">Und. sueltas</th></tr></thead><tbody>';
        grupos[cat].forEach(function (it) {
          n++;
          var fac = Number(it.factor) > 1 ? Number(it.factor) : 1;
          var cu = cantACajasUnd(it.cantidad, fac);
          h += '<tr><td style="border:1px solid #333;padding:3px;text-align:center;">' + n +
            '</td><td style="border:1px solid #333;padding:3px;">' + esc(it.codigo) +
            '</td><td style="border:1px solid #333;padding:3px;">' + esc(it.descripcion) +
            '</td><td style="border:1px solid #333;padding:3px;">' + esc(it.unidad_ref || '') +
            '</td><td style="border:1px solid #333;padding:3px;text-align:center;">' + (cu.cajas === '' ? '' : cu.cajas) +
            '</td><td style="border:1px solid #333;padding:3px;text-align:center;">' + cu.sueltas + '</td></tr>';
        });
        h += '</tbody></table>';
      });
      return h;
    }
    return '<div class="print-page" style="page-break-after:always;font-family:Arial,sans-serif;color:#000;">' +
      '<h1 style="text-align:center;font-size:14pt;margin:0 0 8px;">' + esc(titulo) + '</h1>' +
      '<div style="margin-bottom:6px;"><strong>Fecha:</strong> ' + esc(fecha || '') +
      ' &nbsp; <strong>REPARTO:</strong> ' + esc(camion || '') + '</div>' +
      tablaBloque('❄ FRÍOS', frios) +
      tablaBloque('📦 SECOS', secos) +
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

  function imprimir(modo) {
    if (!lineas.length) {
      alert('No hay líneas para imprimir.');
      return;
    }
    enriquecerLineas();
    var fecha = ($('consFecha') || {}).value || new Date().toISOString().slice(0, 10);
    var camiones = {};
    lineas.forEach(function (l) {
      if (!camiones[l.camion]) camiones[l.camion] = [];
      camiones[l.camion].push(l);
    });
    var listaCam = Object.keys(camiones).sort();
    var htmlBody = '';

    if (modo === 'uno') {
      var filtro = String(($('consCamion') || {}).value || '').trim();
      if (!filtro) {
        filtro = window.prompt('¿Qué camión imprimir?\n' + listaCam.join('\n'), listaCam[0] || '');
      }
      if (!filtro) return;
      var hit = listaCam.find(function (c) { return c.toUpperCase() === filtro.toUpperCase(); }) ||
        listaCam.find(function (c) { return c.toUpperCase().indexOf(filtro.toUpperCase()) >= 0; });
      if (!hit) { alert('Camión no encontrado.'); return; }
      htmlBody = buildPrintHtml('CONSOLIDADO DE CARGA - MERCADERÍA - GENERAL (R)', hit, camiones[hit], fecha);
    } else {
      // multiple: todos los camiones, cada uno en página
      listaCam.forEach(function (cam) {
        htmlBody += buildPrintHtml('CONSOLIDADO DE CARGA - MERCADERÍA - GENERAL (R)', cam, camiones[cam], fecha);
      });
      // consolidado general al final
      var cons = consolidadoRows();
      cons.forEach(function (r) {
        var cat = catalogo.find(function (p) { return p.codigo === r.codigo; });
        r._categoria = lineaCategoria(r.descripcion, cat && (cat.linea || cat.marca));
        if (!r.tipo && cat) r.tipo = cat.tipo;
      });
      htmlBody += buildPrintHtml('CONSOLIDADO GENERAL (FRÍOS / SECOS)', 'TODOS LOS CAMIONES', cons, fecha);
    }

    var w = window.open('', '_blank');
    if (!w) {
      alert('Permite ventanas emergentes para imprimir.');
      return;
    }
    w.document.write('<!DOCTYPE html><html><head><title>Imprimir consolidado</title>' +
      '<style>@media print { .print-page { page-break-after: always; } .print-page:last-child { page-break-after: auto; } }' +
      'body{margin:12mm;}</style></head><body>' + htmlBody +
      '<script>window.onload=function(){window.print();}</script></body></html>');
    w.document.close();
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
      filtroCam = String(($('consCamion') || {}).value || '').trim();
      if (!filtroCam) {
        // pedir
        filtroCam = window.prompt('¿Qué camión exportar?\nDisponibles:\n' + listaCam.join('\n'), listaCam[0] || '');
      }
      if (!filtroCam) return;
      // match flexible
      var hit = listaCam.find(function (c) { return c.toUpperCase() === filtroCam.toUpperCase(); });
      if (!hit) {
        hit = listaCam.find(function (c) { return c.toUpperCase().indexOf(filtroCam.toUpperCase()) >= 0; });
      }
      if (!hit) {
        alert('Camión no encontrado: ' + filtroCam);
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
    if ($('consFecha') && !$('consFecha').value) {
      $('consFecha').value = new Date().toISOString().slice(0, 10);
    }
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
    if ($('btnConsAgregar')) $('btnConsAgregar').addEventListener('click', agregarLinea);
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
