    (function() {

        // Tab admin: función global (disponible desde el primer instante)
        
        // Admin: colapsar pestañas + deslizar entre secciones
        (function initAdminNavSwipe() {
            var TAB_ORDER = ['subir','catalogo','barras','descargas','respaldos','vista','reporte','pedidos','vencimientos','clientes','sesiones'];
            function tabActual() {
                var a = document.querySelector('.admin-nav-btn.active');
                return a ? (a.getAttribute('data-admin-tab') || 'subir') : 'subir';
            }
            function irTabRelativo(dir) {
                var cur = tabActual();
                var i = TAB_ORDER.indexOf(cur);
                if (i < 0) i = 0;
                var n = (i + dir + TAB_ORDER.length) % TAB_ORDER.length;
                if (typeof window.cambiarTabAdmin === 'function') window.cambiarTabAdmin(TAB_ORDER[n]);
            }
            function bind() {
                var toggle = document.getElementById('adminNavToggle');
                var wrap = document.getElementById('adminNavWrap');
                if (toggle && wrap && !toggle._bound) {
                    toggle._bound = true;
                    toggle.addEventListener('click', function () {
                        var col = wrap.classList.toggle('nav-collapsed');
                        toggle.setAttribute('aria-expanded', col ? 'false' : 'true');
                        try { localStorage.setItem('iem_admin_nav_collapsed', col ? '1' : '0'); } catch (e) {}
                    });
                    // Móvil: pestañas ocultas por defecto (más espacio; solo swipe)
                    try {
                        var isMobile = window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
                        var pref = localStorage.getItem('iem_admin_nav_collapsed');
                        if (isMobile && pref !== '0') {
                            wrap.classList.add('nav-collapsed');
                            toggle.setAttribute('aria-expanded', 'false');
                        } else if (pref === '1') {
                            wrap.classList.add('nav-collapsed');
                            toggle.setAttribute('aria-expanded', 'false');
                        }
                    } catch (e) {
                        try {
                            if (window.innerWidth <= 900) {
                                wrap.classList.add('nav-collapsed');
                                toggle.setAttribute('aria-expanded', 'false');
                            }
                        } catch (e2) {}
                    }
                }
                var body = document.querySelector('.admin-panel-body');
                if (body && !body._swipeBound) {
                    body._swipeBound = true;
                    var x0 = 0, y0 = 0, t0 = 0;
                    body.addEventListener('touchstart', function (e) {
                        if (!e.touches || !e.touches[0]) return;
                        x0 = e.touches[0].clientX;
                        y0 = e.touches[0].clientY;
                        t0 = Date.now();
                    }, { passive: true });
                    body.addEventListener('touchend', function (e) {
                        if (!e.changedTouches || !e.changedTouches[0]) return;
                        var dx = e.changedTouches[0].clientX - x0;
                        var dy = e.changedTouches[0].clientY - y0;
                        var dt = Date.now() - t0;
                        if (dt > 600) return;
                        if (Math.abs(dx) < 55) return;
                        if (Math.abs(dx) < Math.abs(dy) * 1.2) return; // más vertical = scroll
                        if (dx < 0) irTabRelativo(1);  // swipe izq → siguiente
                        else irTabRelativo(-1);       // swipe der → anterior
                    }, { passive: true });
                }
            }
            document.addEventListener('DOMContentLoaded', bind);
            // por si el DOM ya cargó
            if (document.readyState !== 'loading') setTimeout(bind, 0);
        })();

        window.cambiarTabAdmin = function (tabId) {
            try {
                if (!tabId) return false;
                var titulos = {
                    subir: '📤 Subir Excel',
                    catalogo: '🔎 Catálogo',
                    barras: 'Barras / QR',
                    descargas: '📊 Descargas',
                    respaldos: '📦 Respaldos',
                    vista: '👁️ Vista previa',
                    reporte: '📋 Reporte sistema',
                    pedidos: '🛒 Pedidos sugeridos',
                    vencimientos: '⚠ Por vencer',
                    clientes: '👤 Clientes',
                    sesiones: '👥 Sesiones'
                };
                var titleEl = document.getElementById('adminPanelTitle');
                if (titleEl) titleEl.textContent = titulos[tabId] || '⚙️ Administración';
                var swipeTitle = document.getElementById('adminSwipeTitle');
                if (swipeTitle) {
                    var t = titulos[tabId] || tabId;
                    swipeTitle.textContent = t.replace(/^[^\wÀ-ɏ]+/, '').trim() || t;
                }
                var activeBtn = null;
                document.querySelectorAll('.admin-nav-btn').forEach(function (b) {
                    var on = b.getAttribute('data-admin-tab') === tabId;
                    b.classList.toggle('active', on);
                    b.setAttribute('aria-selected', on ? 'true' : 'false');
                    if (on) activeBtn = b;
                });
                // En móvil: centrar la pestaña activa en la barra horizontal
                if (activeBtn && activeBtn.scrollIntoView) {
                    try {
                        activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    } catch (e) {}
                }
                document.querySelectorAll('.admin-tab').forEach(function (panel) {
                    var on = panel.getAttribute('data-admin-panel') === tabId;
                    if (on) {
                        panel.removeAttribute('hidden');
                        panel.hidden = false;
                        panel.style.setProperty('display', 'block', 'important');
                        panel.classList.add('active');
                        panel.setAttribute('role', 'tabpanel');
                    } else {
                        panel.setAttribute('hidden', 'hidden');
                        panel.hidden = true;
                        panel.style.setProperty('display', 'none', 'important');
                        panel.classList.remove('active');
                    }
                });
                // Mantener panel abierto al cambiar de sección
                try {
                    var _ovKeep = document.getElementById('adminOverlay');
                    if (_ovKeep) {
                        _ovKeep.classList.add('visible');
                        _ovKeep.style.display = 'flex';
                        _ovKeep.setAttribute('aria-hidden', 'false');
                    }
                    document.body.classList.add('admin-open');
                } catch (eKeep) {}
                if (tabId === 'sesiones' && typeof window.__cargarSesionesActivas === 'function') {
                    window.__cargarSesionesActivas();
                }
                // En móvil no forzar focus (abre el teclado y tapa la UI)
                var esEscritorio = window.matchMedia && window.matchMedia('(min-width: 901px)').matches;
                if (tabId === 'catalogo') {
                    var inp = document.getElementById('adminCatalogInput');
                    if (inp && esEscritorio) { setTimeout(function () { inp.focus(); }, 50); }
                    if (typeof buscarCatalogoAdmin === 'function') buscarCatalogoAdmin(inp && inp.value);
                }
                if (tabId === 'barras') {
                    var binp = document.getElementById('adminBarrasInput');
                    if (binp && esEscritorio) { setTimeout(function () { binp.focus(); }, 80); }
                    if (typeof buscarBarrasAdmin === 'function') buscarBarrasAdmin(binp && binp.value);
                    if (typeof renderBarrasAdminSeleccionado === 'function') renderBarrasAdminSeleccionado();
                }
                if (tabId === 'vista' && typeof renderVistaPreviaInventario === 'function') {
                    renderVistaPreviaInventario();
                }
                if (tabId === 'reporte' && typeof renderReporteSistema === 'function') {
                    renderReporteSistema();
                }
                if (tabId === 'vencimientos' && typeof cargarAdminVencimientos === 'function') {
                    try { cargarAdminVencimientos(); } catch (e) { console.warn(e); }
                }
                if (tabId === 'pedidos' && typeof cargarPedidosSugeridos === 'function') {
                    cargarPedidosSugeridos();
                }
                if (tabId === 'clientes') {
                    if (typeof cargarClientesDesdeNube === 'function') cargarClientesDesdeNube();
                    var cin = document.getElementById('adminClienteInput');
                    if (cin && esEscritorio) setTimeout(function () { cin.focus(); }, 50);
                }
            } catch (err) {
                console.error('cambiarTabAdmin', err);
            }
            return false;
        };


        // ============================================================
        // CONFIGURACIÓN
        // ============================================================
        // NOTA DE SEGURIDAD: esta URL queda visible para cualquiera que vea el
        // código fuente de la página (no hay forma de ocultarla en una app 100%
        // cliente). Cualquiera con la URL puede hacer POST a este Apps Script.
        // Esto NO se puede arreglar desde este archivo: la validación debe
        // hacerse del lado del Apps Script, por ejemplo exigiendo un token
        // secreto en el body/cabecera y rechazando la petición si no coincide,
        // y/o limitando el rango de escritura de la hoja de cálculo.
        // ============================================================
        // SUPABASE
        // ============================================================
        const SUPABASE_URL = (window.IEM_CONFIG && window.IEM_CONFIG.SUPABASE_URL) || '';
        const SUPABASE_ANON_KEY = (window.IEM_CONFIG && window.IEM_CONFIG.SUPABASE_ANON_KEY) || '';
        // Detección instantánea: si el script externo de Supabase no cargó (red
        // inestable, bloqueador, CDN caído), window.supabase no existe. Antes esto
        // lanzaba un error sin capturar aquí mismo que detenía en silencio TODO el
        // resto de app.js (login, buscador, sesión), dejando el spinner girando
        // para siempre sin ningún aviso. Ahora se avisa de inmediato y se detiene
        // la inicialización de forma controlada.
        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            try {
                if (typeof window.__iemShowBootError === 'function') {
                    window.__iemShowBootError(
                        'No se pudo conectar con el servidor (falló la carga de una ' +
                        'librería externa). Revisa tu conexión a internet e inténtalo de nuevo.'
                    );
                }
            } catch (eBootMsg) {}
            return;
        }
        let supabaseClient;
        try {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                    storage: window.localStorage
                }
            });
            window.__iemAppBooted = true;
        } catch (eSupa) {
            try {
                if (typeof window.__iemShowBootError === 'function') {
                    window.__iemShowBootError(
                        'No se pudo iniciar la conexión con el servidor. ' +
                        'Revisa tu conexión a internet e inténtalo de nuevo.'
                    );
                }
            } catch (eBootMsg2) {}
            return;
        }

        // ---- Carga diferida de librerías pesadas (Excel / ZIP / escáner) ----
        var _iemLibPromises = Object.create(null);
        function loadScriptOnce(url) {
            if (!url) return Promise.reject(new Error('URL de script vacía'));
            if (_iemLibPromises[url]) return _iemLibPromises[url];
            _iemLibPromises[url] = new Promise(function (resolve, reject) {
                var s = document.createElement('script');
                s.src = url;
                s.async = true;
                s.onload = function () { resolve(); };
                s.onerror = function () {
                    delete _iemLibPromises[url];
                    reject(new Error('No se pudo cargar: ' + url));
                };
                document.head.appendChild(s);
            });
            return _iemLibPromises[url];
        }
        function cfgCdn(key, fallback) {
            try {
                var c = window.IEM_CONFIG || {};
                return c[key] || fallback;
            } catch (e) { return fallback; }
        }
        async function ensureXlsx() {
            if (typeof XLSX !== 'undefined') return true;
            await loadScriptOnce(cfgCdn('CDN_XLSX', 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'));
            if (typeof XLSX === 'undefined') throw new Error('XLSX no disponible');
            return true;
        }
        async function ensureJSZip() {
            if (typeof JSZip !== 'undefined') return true;
            await loadScriptOnce(cfgCdn('CDN_JSZIP', 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'));
            if (typeof JSZip === 'undefined') throw new Error('JSZip no disponible');
            return true;
        }
        async function ensureHtml5Qrcode() {
            if (typeof Html5Qrcode !== 'undefined') return true;
            await loadScriptOnce(cfgCdn('CDN_HTML5_QRCODE', 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'));
            if (typeof Html5Qrcode === 'undefined') throw new Error('Html5Qrcode no disponible');
            return true;
        }
        try {
            window.ensureXlsx = ensureXlsx;
            window.ensureJSZip = ensureJSZip;
            window.ensureHtml5Qrcode = ensureHtml5Qrcode;
        } catch (eW) {}

        const GOOGLE_SHEETS_CSV_URL = '';
        const SCRIPT_URL = '';

        const sampleData = [
            {"Producto":"MANJAR ESPECIAL BAZO VELARDE BALDE X 20 KG","Codigo":"9010","CodigoFabrica":"50000111","Unidad Ref":"BAL/BAL","Cantidad":"15","FactorEmpaque":"1","Linea":"MANJARES: ESPECIAL","Marca":"BAZO VELARDE"},
            {"Producto":"LECHE UHT LAIVE ENTERA CAJA 946ML","Codigo":"2136","CodigoFabrica":"50001059","Unidad Ref":"CJ*12","Cantidad":"16459","FactorEmpaque":"12","Linea":"LECHES FRESCAS: ENTERO (A)","Marca":"LAIVE"}
        ];

        // ============================================================
        // ESTADO
        // ============================================================
        let currentData = [];
        function debounce(fn, ms) {
            let t;
            return function () {
                const ctx = this, args = arguments;
                clearTimeout(t);
                t = setTimeout(function () { fn.apply(ctx, args); }, ms);
            };
        }
        let filteredData = [];
        let selectedIndex = -1;
        /** true = Guardar reemplaza lotes del producto (lápiz editar), no suma */
        let iemModoEdicion = false;
        let pedido = [];
        let inventarioFisico = [];
        let currentFactor = 1;
        let autoRefreshTimer = null;
        let syncTimer = null;
        let sincronizando = false;

        // Identificador anónimo de este celular/navegador (no es un nombre de
        // usuario, solo sirve para que cada lote tenga un ID único al
        // combinarse con lo que cuentan otros celulares).
        const DEVICE_ID_KEY = 'iem_device_id';
        function obtenerDeviceId() {
            let id = null;
            try { id = localStorage.getItem(DEVICE_ID_KEY); } catch (e) {}
            if (!id) {
                id = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
                try { localStorage.setItem(DEVICE_ID_KEY, id); } catch (e) {}
            }
            return id;
        }
        const deviceId = obtenerDeviceId();

        // Sesión en nube (admin ve conectados y puede forzar cierre)
        // Importante: en Supabase la tabla sesiones_activas debe permitir que
        // cualquier usuario autenticado haga UPDATE de forzar_cierre (RLS abierta
        // para authenticated, o policy que permita update a todos). Si RLS bloquea
        // el update de filas ajenas, el admin no podrá cerrar sesiones de otros.
        let idSesionActual = null;
        let canalSesionActual = null;

        async function registrarSesionActiva() {
            if (!usuarioActual) return;
            idSesionActual = (String(usuarioActual) + '_' + deviceId).slice(0, 120);
            try {
                await supabaseClient.from('sesiones_activas').upsert({
                    id: idSesionActual,
                    usuario: usuarioActual,
                    device_id: deviceId,
                    nombre_dispositivo: (navigator.userAgent || '').slice(0, 80),
                    ultimo_ping: new Date().toISOString(),
                    conectado_en: new Date().toISOString(),
                    forzar_cierre: false
                });
                suscribirCierreForzado();
            } catch (e) {
                console.warn('No se pudo registrar sesión (¿falta tabla sesiones_activas?)', e);
            }
        }

        function suscribirCierreForzado() {
            if (!idSesionActual || !supabaseClient) return;
            try {
                if (canalSesionActual) {
                    try { supabaseClient.removeChannel(canalSesionActual); } catch (e) {}
                    canalSesionActual = null;
                }
                canalSesionActual = supabaseClient
                    .channel('sesion-' + idSesionActual)
                    .on('postgres_changes', {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'sesiones_activas',
                        filter: 'id=eq.' + idSesionActual
                    }, function (payload) {
                        var row = payload && payload.new;
                        if (row && row.forzar_cierre) {
                            forzarLogoutLocal('El administrador cerró tu sesión.');
                        }
                    })
                    .subscribe();
            } catch (e) {
                console.warn('Realtime sesión no disponible', e);
            }
        }

        async function borrarSesionActiva() {
            if (canalSesionActual) {
                try { supabaseClient.removeChannel(canalSesionActual); } catch (e) {}
                canalSesionActual = null;
            }
            if (!idSesionActual) return;
            try {
                await supabaseClient.from('sesiones_activas').delete().eq('id', idSesionActual);
            } catch (e) {}
            idSesionActual = null;
        }

        function forzarLogoutLocal(mensaje) {
            showToast(mensaje || 'Sesión cerrada.', 'error');
            try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
            const idBorrar = idSesionActual;
            if (canalSesionActual) {
                try { supabaseClient.removeChannel(canalSesionActual); } catch (e) {}
                canalSesionActual = null;
            }
            usuarioActual = '';
            rolUsuario = '';
            idSesionActual = null;
            if (idBorrar) {
                supabaseClient.from('sesiones_activas').delete().eq('id', idBorrar).then(function () {});
            }
            try { supabaseClient.auth.signOut(); } catch (e) {}
            document.body.style.overflow = '';
            const ov = document.getElementById('adminOverlay');
            if (ov) {
                ov.classList.remove('visible');
                ov.setAttribute('aria-hidden', 'true');
            }
            mostrarLogin();
        }

        // Comprueba si el admin marcó forzar_cierre y actualiza el ping.
        // Se llama por intervalo y al volver a primer plano (móvil pausa los timers).
        async function comprobarSesionActiva() {
            if (!usuarioActual || !idSesionActual) return;
            if (appContainer && appContainer.classList.contains('oculto')) return;
            try {
                const { data } = await supabaseClient
                    .from('sesiones_activas')
                    .select('forzar_cierre')
                    .eq('id', idSesionActual)
                    .maybeSingle();
                if (data && data.forzar_cierre) {
                    // Releer una vez para evitar falso positivo de red/caché
                    try {
                        var chk = await supabaseClient.from('sesiones_activas').select('forzar_cierre').eq('id', idSesionActual).maybeSingle();
                        if (!(chk && chk.data && chk.data.forzar_cierre)) return;
                    } catch (eChk) {}
                    forzarLogoutLocal('El administrador cerró tu sesión.');
                    return;
                }
                // Solo actualiza el ping; no toca forzar_cierre
                await supabaseClient
                    .from('sesiones_activas')
                    .update({ ultimo_ping: new Date().toISOString() })
                    .eq('id', idSesionActual)
                    .eq('forzar_cierre', false);
            } catch (e) {}
        }

        setInterval(comprobarSesionActiva, 8000);

        // En móvil el intervalo se pausa en segundo plano: al abrir de nuevo, cerrar al instante
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') comprobarSesionActiva();
        });
        window.addEventListener('focus', function () {
            comprobarSesionActiva();
        });

        function escapeHtmlSes(s) {
            return String(s == null ? '' : s)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }
        // Alias global de escape (XSS en listados / HTML dinámico)
        function escapeHtml(s) { return escapeHtmlSes(s); }

        /** Solo permite http(s) o rutas relativas para src de imágenes. */
        function safeImageUrl(url) {
            var u = String(url || '').trim();
            if (!u) return '';
            if (/^https?:\/\//i.test(u)) return u;
            if (/^\//.test(u) || /^\.\//.test(u)) return u;
            return '';
        }

        /** URLs que fallaron: no reintentar en esta sesión. */
        var _iemImgBroken = Object.create(null);
        function markImageBroken(url) {
            if (url) _iemImgBroken[String(url)] = 1;
        }
        try { window.markImageBroken = markImageBroken; } catch (eW) {}
        function isImageBroken(url) {
            return !!(url && _iemImgBroken[String(url)]);
        }

        /**
         * HTML de <img> optimizado: lazy, async decode, tamaño fijo (menos CLS),
         * fetchpriority bajo salvo las primeras filas visibles.
         */
        function buildProductImgHtml(url, className, idx) {
            var safe = safeImageUrl(url);
            if (!safe || isImageBroken(safe)) {
                return '<span class="' + className + ' prod-img-placeholder" aria-hidden="true">📦</span>';
            }
            var eager = (typeof idx === 'number' && idx < 4);
            var loading = eager ? 'eager' : 'lazy';
            var prio = eager ? 'high' : 'low';
            var esc = escapeHtml(safe);
            return '<img class="' + className + '" src="' + esc + '" alt="" width="72" height="72"'
                + ' loading="' + loading + '" decoding="async" fetchpriority="' + prio + '"'
                + ' referrerpolicy="no-referrer"'
                + ' onerror="window.__iemImgErr&&window.__iemImgErr(this)">'
                ;
        }
        window.__iemImgErr = function (el) {
            try {
                if (!el) return;
                markImageBroken(el.getAttribute('src') || el.src);
                el.onerror = null;
                var ph = document.createElement('span');
                ph.className = (el.className || 'prod-img') + ' prod-img-placeholder';
                ph.setAttribute('aria-hidden', 'true');
                ph.textContent = '📦';
                if (el.parentNode) el.parentNode.replaceChild(ph, el);
            } catch (e) {}
        };

        /** Precarga la imagen del producto seleccionado (panel). */
        function setProductActiveImage(url) {
            if (!paImg) return;
            var safe = safeImageUrl(url);
            if (!safe || isImageBroken(safe)) {
                paImg.removeAttribute('src');
                paImg.style.display = 'none';
                return;
            }
            paImg.loading = 'eager';
            try { paImg.fetchPriority = 'high'; } catch (e) {}
            paImg.decoding = 'async';
            paImg.referrerPolicy = 'no-referrer';
            paImg.onerror = function () {
                markImageBroken(safe);
                paImg.style.display = 'none';
                paImg.removeAttribute('src');
            };
            if (paImg.src === safe) {
                paImg.style.display = '';
                return;
            }
            paImg.src = safe;
            paImg.style.display = '';
        }

        async function cargarSesionesActivas() {
            window.__cargarSesionesActivas = cargarSesionesActivas;
            const cont = document.getElementById('adminListaSesiones');
            if (!cont) return;
            cont.innerHTML = '<p class="admin-sesiones-empty">Cargando...</p>';
            const desde = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            try {
                const { data, error } = await supabaseClient
                    .from('sesiones_activas')
                    .select('*')
                    .gte('ultimo_ping', desde)
                    .order('ultimo_ping', { ascending: false });
                if (error) throw error;
                if (!data || !data.length) {
                    cont.innerHTML = '<p class="admin-sesiones-empty">Nadie conectado ahora.</p>';
                    return;
                }
                cont.innerHTML = data.map(function (s) {
                    const hace = Math.max(0, Math.round((Date.now() - new Date(s.ultimo_ping).getTime()) / 1000));
                    const esEsta = (s.id === idSesionActual);
                    const etiqueta = esEsta ? ' (este dispositivo)' : '';
                    const forzada = s.forzar_cierre ? ' · cierre pendiente' : '';
                    const btnLabel = s.forzar_cierre && !esEsta ? 'Reintentar cierre' : 'Cerrar sesión';
                    return (
                        '<div class="admin-sesion-item">' +
                          '<div><div class="ses-user">' + escapeHtmlSes(s.usuario) + escapeHtmlSes(etiqueta) + '</div>' +
                          '<div class="ses-meta">Hace ' + hace + 's · ' + escapeHtmlSes((s.device_id || '').slice(0, 18)) + escapeHtmlSes(forzada) + '</div></div>' +
                          '<button type="button" class="btn btn-danger btn-sm btn-forzar-cierre" data-id="' + escapeHtmlSes(s.id) + '" data-self="' + (esEsta ? '1' : '0') + '">' + btnLabel + '</button>' +
                        '</div>'
                    );
                }).join('');
                cont.querySelectorAll('.btn-forzar-cierre').forEach(function (btn) {
                    btn.addEventListener('click', async function () {
                        const id = btn.getAttribute('data-id');
                        const esSelf = btn.getAttribute('data-self') === '1';
                        // Confirmación solo al admin (no pide permiso al otro usuario).
                        // El otro dispositivo se cierra solo al detectar forzar_cierre.
                        const ok = await confirmarAccion(
                            esSelf
                                ? '¿Cerrar tu sesión en este dispositivo?'
                                : '¿Forzar cierre de esa sesión? Se cerrará en ese dispositivo sin pedirles permiso (en unos segundos).',
                            'Cerrar sesión',
                            'danger'
                        );
                        if (!ok) return;
                        btn.disabled = true;
                        // Marcar forzar_cierre = true. El otro dispositivo lo detecta por Realtime o por ping.
                        const { data: updated, error } = await supabaseClient
                            .from('sesiones_activas')
                            .update({ forzar_cierre: true })
                            .eq('id', id)
                            .select('id');
                        if (error) {
                            var msg = (error.message || String(error));
                            if (/policy|permission|RLS|row-level|403|42501/i.test(msg)) {
                                showToast('No se pudo cerrar: falta permiso en Supabase (RLS). Ejecuta el SQL de políticas de sesiones_activas (update abierto a authenticated).', 'error');
                            } else {
                                showToast('No se pudo cerrar: ' + msg, 'error');
                            }
                            btn.disabled = false;
                            return;
                        }
                        if (!updated || !updated.length) {
                            // RLS a veces devuelve 0 filas sin error
                            showToast('No se pudo cerrar: la fila no se actualizó (revisa políticas RLS de sesiones_activas: debe permitir UPDATE a authenticated).', 'error');
                            btn.disabled = false;
                            return;
                        }
                        if (esSelf) {
                            forzarLogoutLocal('Sesión cerrada.');
                            return;
                        }
                        showToast('Sesión forzada. Se cerrará sola en ese dispositivo (Realtime o en menos de ~8 s).', 'success');
                        cargarSesionesActivas();
                    });
                });
            } catch (e) {
                cont.innerHTML = '<p class="admin-sesiones-empty" style="color:var(--danger);">Error: ' +
                    escapeHtmlSes(e.message || e) +
                    '<br><small>¿Ejecutaste el SQL de sesiones_activas?</small></p>';
            }
        }

        /** Borra sesiones con ping > 5 min o con cierre forzado pendiente (excepto la de este dispositivo). */
        async function limpiarSesionesInactivas() {
            if (typeof esAdmin === 'function' && !esAdmin()) {
                showToast('Solo administrador.', 'error');
                return;
            }
            const ok = await confirmarAccion(
                '¿Eliminar de la lista las sesiones inactivas (sin ping en 5 min) y las que ya tienen cierre pendiente? No cierra la tuya.',
                'Limpiar',
                'danger'
            );
            if (!ok) return;
            try {
                const limite = new Date(Date.now() - 5 * 60 * 1000).toISOString();
                var q1 = supabaseClient.from('sesiones_activas').delete().lt('ultimo_ping', limite);
                if (idSesionActual) q1 = q1.neq('id', idSesionActual);
                const r1 = await q1;
                var q2 = supabaseClient.from('sesiones_activas').delete().eq('forzar_cierre', true);
                if (idSesionActual) q2 = q2.neq('id', idSesionActual);
                const r2 = await q2;
                if (r1.error || r2.error) {
                    showToast('Error al limpiar: ' + ((r1.error || r2.error).message || ''), 'error');
                } else {
                    showToast('Sesiones inactivas limpiadas.', 'success');
                }
                cargarSesionesActivas();
            } catch (e) {
                showToast('Error al limpiar: ' + (e.message || e), 'error');
            }
        }
        try { window.__limpiarSesionesInactivas = limpiarSesionesInactivas; } catch (eW) {}

        // DOM
        const searchInput = document.getElementById('searchInput');
        const searchButton = document.getElementById('searchButton');
        const resultList = document.getElementById('resultList');
        const resultCount = document.getElementById('resultCount');
        const cajasCount = document.getElementById('cajasCount');
        const unidadesCount = document.getElementById('unidadesCount');
        const txtCajas = document.getElementById('txtCajas');
        const txtUnidades = document.getElementById('txtUnidades');
        const cajasGroup = document.getElementById('cajasGroup');
        const infoFactor = document.getElementById('infoFactor');
        const btnAgregar = document.getElementById('btnAgregar');
        const btnRegistrarFisico = document.getElementById('btnRegistrarFisico');
        const pedidoBody = document.getElementById('pedidoBody');
        const pedidoFoot = document.getElementById('pedidoFoot');
        const pedidoMobileList = document.getElementById('pedidoMobileList');
        const totalCajasFoot = document.getElementById('totalCajasFoot');
        const totalUnidadesFoot = document.getElementById('totalUnidadesFoot');
        const totalCajasPedido = document.getElementById('totalCajasPedido');
        const totalUnidadesPedido = document.getElementById('totalUnidadesPedido');
        const pedidoCount = document.getElementById('pedidoCount');
        const fileStatus = document.getElementById('fileStatus');
        const refreshBtn = document.getElementById('refreshDriveBtn');

        const productoActivoCard = document.getElementById('productoActivoCard');
        const paDescripcion = document.getElementById('paDescripcion');
        const paCodigo = document.getElementById('paCodigo');
        const paUnidad = document.getElementById('paUnidad');
        const paFactor = document.getElementById('paFactor');
        const paStock = document.getElementById('paStock');
        const paTotalValor = document.getElementById('paTotalValor');
        const paTotalUnidad = document.getElementById('paTotalUnidad');
        const paImg = document.getElementById('paImg');
        const conversionHint = document.getElementById('conversionHint');
        const btnCambiarProducto = document.getElementById('btnCambiarProducto');

        const vencBlock = document.getElementById('vencBlock');
        const vencChips = document.getElementById('vencChips');
        const selDia = document.getElementById('selDia');
        const selMes = document.getElementById('selMes');
        const yearTabs = document.getElementById('yearTabs');
        let anioSeleccionado = new Date().getFullYear();

        const diffBody = document.getElementById('diffBody');
        const diffFoot = document.getElementById('diffFoot');
        const diffMobileList = document.getElementById('diffMobileList');
        const diffCount = document.getElementById('diffCount');
        const diffTotalTeorico = document.getElementById('diffTotalTeorico');
        const diffTotalFisico = document.getElementById('diffTotalFisico');
        const diffTotalDiferencia = document.getElementById('diffTotalDiferencia');
        const diffResumen = document.getElementById('diffResumen');
        const resTeorico = document.getElementById('resTeorico');
        const resFisico = document.getElementById('resFisico');
        const resDiferencia = document.getElementById('resDiferencia');
        const resContados = document.getElementById('resContados');
        const exportDiffBtn = document.getElementById('exportDiffBtn');
        const clearDiffBtn = document.getElementById('clearDiffBtn');
        const guardarDriveBtn = document.getElementById('guardarDriveBtn');

        const exportPedidoBtn = document.getElementById('exportPedidoBtn');
        const guardarPedidoDriveBtn = document.getElementById('guardarPedidoDriveBtn');
        const limpiarPedidoBtn = document.getElementById('limpiarPedidoBtn');

        // ============================================================
        // TOAST
        // ============================================================
                function showToast(message, type = 'info') {
            const existing = document.querySelector('.toast');
            if (existing) existing.remove();
            const toast = document.createElement('div');
            toast.className = 'toast ' + (type || 'info');
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(function () {
                toast.style.opacity = '0';
                setTimeout(function () { toast.remove(); }, 400);
            }, 4500);
            // También en el panel admin (si está abierto el toast a veces no se veía)
            try {
                const st = document.getElementById('adminStatus');
                if (st) {
                    st.textContent = message;
                    st.className = 'admin-status admin-status-' + (type || 'info');
                }
            } catch (e) {}
        }

        function setGlobalLoading(on, mode) {
            var el = document.getElementById('globalLoading');
            if (!el) return;
            if (on) {
                window.__iemLoadShownAt = Date.now();
                // mode: 'boot' = logo al iniciar | 'dots' = puntos tras login
                var m = mode || 'dots';
                el.classList.remove('gl-mode-boot', 'gl-mode-dots');
                el.classList.add(m === 'boot' ? 'gl-mode-boot' : 'gl-mode-dots');
                el.classList.remove('gl-hide');
                el.setAttribute('aria-busy', 'true');
            } else {
                el.classList.add('gl-hide');
                el.setAttribute('aria-busy', 'false');
            }
        }
        // Mínimo visible para que se note la animación de puntos
        window.__iemHideLoading = function (minMs) {
            minMs = (minMs == null) ? 900 : minMs;
            var waited = Date.now() - (window.__iemLoadShownAt || Date.now());
            var delay = Math.max(0, minMs - waited);
            setTimeout(function () {
                try { setGlobalLoading(false); } catch (e) {
                    var el = document.getElementById('globalLoading');
                    if (el) el.classList.add('gl-hide');
                }
            }, delay);
        };
        // Arranque: puntos visibles hasta el login (o app si hay sesión)
        window.__iemLoadShownAt = Date.now();
        try {
            var _gl0 = document.getElementById('globalLoading');
            if (_gl0) {
                _gl0.classList.remove('gl-hide', 'gl-mode-dots');
                _gl0.classList.add('gl-mode-boot');
                _gl0.setAttribute('aria-busy', 'true');
            }
        } catch (e0) {}
        // Fail-safe
        setTimeout(function () {
            try { setGlobalLoading(false); } catch (e) {}
        }, 12000);

        // RESPALDOS MENSUALES: IndexedDB + ZIP (último Excel del día)
        var IEM_BACKUP_DB = 'iem_respaldos_v1';
        var IEM_BACKUP_STORE = 'archivos';

        function iemFechaParts(d) {
            d = d || new Date();
            var y = d.getFullYear();
            var m = String(d.getMonth() + 1).padStart(2, '0');
            var day = String(d.getDate()).padStart(2, '0');
            var hh = String(d.getHours()).padStart(2, '0');
            var mm = String(d.getMinutes()).padStart(2, '0');
            return { y: y, m: m, day: day, hh: hh, mm: mm, mesKey: y + '-' + m, diaKey: y + '-' + m + '-' + day };
        }

        function iemOpenBackupDb() {
            return new Promise(function (resolve, reject) {
                if (!window.indexedDB) { reject(new Error('Sin IndexedDB')); return; }
                var req = indexedDB.open(IEM_BACKUP_DB, 1);
                req.onupgradeneeded = function () {
                    var db = req.result;
                    if (!db.objectStoreNames.contains(IEM_BACKUP_STORE)) {
                        var st = db.createObjectStore(IEM_BACKUP_STORE, { keyPath: 'id' });
                        st.createIndex('mes', 'mes', { unique: false });
                        st.createIndex('tipo', 'tipo', { unique: false });
                        st.createIndex('dia', 'dia', { unique: false });
                    }
                };
                req.onsuccess = function () { resolve(req.result); };
                req.onerror = function () { reject(req.error || new Error('IDB')); };
            });
        }

        function iemIdbPut(rec) {
            return iemOpenBackupDb().then(function (db) {
                return new Promise(function (resolve, reject) {
                    var tx = db.transaction(IEM_BACKUP_STORE, 'readwrite');
                    tx.objectStore(IEM_BACKUP_STORE).put(rec);
                    tx.oncomplete = function () { resolve(); };
                    tx.onerror = function () { reject(tx.error); };
                });
            });
        }

        function iemIdbGetByMes(mesKey) {
            return iemOpenBackupDb().then(function (db) {
                return new Promise(function (resolve, reject) {
                    var tx = db.transaction(IEM_BACKUP_STORE, 'readonly');
                    var idx = tx.objectStore(IEM_BACKUP_STORE).index('mes');
                    var req = idx.getAll(mesKey);
                    req.onsuccess = function () { resolve(req.result || []); };
                    req.onerror = function () { reject(req.error); };
                });
            });
        }

        function iemIdbDelete(id) {
            return iemOpenBackupDb().then(function (db) {
                return new Promise(function (resolve, reject) {
                    var tx = db.transaction(IEM_BACKUP_STORE, 'readwrite');
                    tx.objectStore(IEM_BACKUP_STORE).delete(id);
                    tx.oncomplete = function () { resolve(); };
                    tx.onerror = function () { reject(tx.error); };
                });
            });
        }

        async function guardarRespaldoMensual(tipo, blobOrArrayBuffer, nombreBase, opts) {
            opts = opts || {};
            var autoDescargar = opts.descargar === true; // por defecto NO descarga al subir
            try {
                var fp = iemFechaParts();
                var blob = blobOrArrayBuffer instanceof Blob
                    ? blobOrArrayBuffer
                    : new Blob([blobOrArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                var safeTipo = String(tipo || 'archivo').replace(/[^\w\-]+/g, '_');
                var nombre = (nombreBase || safeTipo) + '_' + fp.diaKey + '_' + fp.hh + fp.mm + '.xlsx';

                if (safeTipo === 'excel_subido') {
                    var existentes = await iemIdbGetByMes(fp.mesKey);
                    for (var i = 0; i < existentes.length; i++) {
                        var e = existentes[i];
                        if (e.tipo === 'excel_subido' && e.dia === fp.diaKey) {
                            await iemIdbDelete(e.id);
                        }
                    }
                }

                var rec = {
                    id: safeTipo + '_' + fp.diaKey + '_' + Date.now(),
                    tipo: safeTipo,
                    mes: fp.mesKey,
                    dia: fp.diaKey,
                    nombre: nombre,
                    blob: blob,
                    ts: Date.now()
                };
                await iemIdbPut(rec);

                // Solo descarga si se pide explícitamente (menú Respaldos), no al terminar de subir
                if (autoDescargar) {
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = nombre;
                    a.click();
                    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
                    await descargarZipMes(fp.mesKey, true);
                    showToast('📦 Respaldo ' + nombre + ' descargado.', 'success');
                }
            } catch (err) {
                console.warn('Respaldo mensual', err);
            }
        }

        async function descargarZipMes(mesKey, silencioso) {
            var lista = await iemIdbGetByMes(mesKey);
            if (!lista.length) {
                if (!silencioso) showToast('No hay respaldos de ' + mesKey, 'info');
                return;
            }
            var byDayExcel = {};
            var otros = [];
            lista.forEach(function (r) {
                if (r.tipo === 'excel_subido') {
                    var prev = byDayExcel[r.dia];
                    if (!prev || (r.ts || 0) > (prev.ts || 0)) byDayExcel[r.dia] = r;
                } else {
                    otros.push(r);
                }
            });
            var finalList = otros.concat(Object.keys(byDayExcel).map(function (k) { return byDayExcel[k]; }));

            try {
                await ensureJSZip();
            } catch (eZip) {
                if (!silencioso) showToast('JSZip no cargó; usa los Excel sueltos descargados.', 'info');
                return;
            }
            var zip = new JSZip();
            var folderExcel = zip.folder('excel_actualizacion');
            var folderConteo = zip.folder('conteo_fisico');
            finalList.forEach(function (r) {
                var folder = (r.tipo === 'excel_subido') ? folderExcel : folderConteo;
                folder.file(r.nombre || (r.id + '.xlsx'), r.blob);
            });
            var out = await zip.generateAsync({ type: 'blob' });
            var url = URL.createObjectURL(out);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'IEM_respaldos_' + mesKey + '.zip';
            a.click();
            setTimeout(function () { URL.revokeObjectURL(url); }, 2500);
        }

        // ============================================================
        // CONFIRMACIÓN PROPIA (reemplaza confirm() nativo, que en
        // algunos WebViews/apps embebidas no se llega a mostrar)
        // ============================================================
        const confirmOverlay = document.getElementById('confirmOverlay');
        const confirmMensaje = document.getElementById('confirmMensaje');
        const confirmCancelar = document.getElementById('confirmCancelar');
        const confirmAceptar = document.getElementById('confirmAceptar');
        let confirmResolver = null;

        function confirmarAccion(mensaje, textoAceptar, tipoAceptar) {
            confirmMensaje.textContent = mensaje;
            confirmAceptar.textContent = textoAceptar || 'Eliminar';
            confirmAceptar.classList.remove('btn-danger', 'btn-primary');
            confirmAceptar.classList.add(tipoAceptar === 'primary' ? 'btn-primary' : 'btn-danger');
            confirmOverlay.classList.add('visible');
            return new Promise(resolve => { confirmResolver = resolve; });
        }
        function cerrarConfirmacion(resultado) {
            confirmOverlay.classList.remove('visible');
            if (confirmResolver) {
                confirmResolver(resultado);
                confirmResolver = null;
            }
        }
        confirmCancelar.addEventListener('click', () => cerrarConfirmacion(false));
        confirmAceptar.addEventListener('click', () => cerrarConfirmacion(true));
        confirmOverlay.addEventListener('click', (e) => {
            if (e.target === confirmOverlay) cerrarConfirmacion(false);
        });

        // ============================================================
        // MAPEO DE CAMPOS
        // ============================================================
        function getField(item, ...aliases) {
            for (let alias of aliases) {
                if (item.hasOwnProperty(alias) && item[alias] !== undefined && item[alias] !== '') return item[alias];
            }
            const keys = Object.keys(item);
            for (let alias of aliases) {
                const lowerAlias = alias.toLowerCase();
                for (let key of keys) {
                    if (key.toLowerCase() === lowerAlias) return item[key];
                }
            }
            return '';
        }
        function getCodigo(item) { return getField(item, 'Codigo', 'Código', 'Cod. Producto', 'InventarioProductoCodigo', 'Cod'); }
        function getCodigoFabrica(item) { return getField(item, 'CodigoFabrica', 'codigo_fabrica', 'CódigoFábrica', 'Cod. Fabrica', 'CodFabrica', 'SKU'); }
        function soloDigitos(v) { return String(v || '').replace(/\D/g, ''); }
        function normalizarCodigoBusqueda(v) {
            if (v == null || v === '') return '';
            var s = String(v).trim();
            if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, '');
            return s;
        }
        function getCodigoBarras(item) { return getField(item, 'CodigoBarras', 'codigo_barras', 'EAN', 'Barcode', 'CodBarras', 'CódigoBarras'); }
        function getDescripcion(item) { return getField(item, 'Producto', 'Descripción', 'InventarioProductoDescripcion', 'Descripcion', 'Nombre'); }
        function getImagenUrl(item) { return getField(item, 'imagen_url', 'ImagenUrl', 'Imagen', 'image_url', 'foto', 'Foto'); }
        function getUnidadRef(item) { return getField(item, 'Unidad Ref', 'Uni. Ref.', 'Unidad', 'InventarioProductoUnidadReferenciaAbreviacion', 'UnidadRef'); }
        function getCantidad(item) {
            const val = getField(item, 'InventarioProductoCantidad', 'Cantidad', 'Stock', 'Stock Fisico');
            if (typeof val === 'string' && val.includes('/')) {
                const partes = val.split('/');
                if (partes.length > 0) return parseInt(partes[0]) || 0;
            }
            return parseFloat(val) || 0;
        }
        function getFactorEmpaque(item) {
            const val = getField(item, 'InventarioProductoUnidadReferenciaFactor', 'FactorEmpaque', 'Factor', 'UnidadRefFactor');
            return parseInt(val) || 1;
        }
        function getLinea(item) {
            return getField(item,
                'Linea', 'Línea', 'linea', 'LINEA',
                'InventarioProductoCategoriaDescripcion', 'Categoria', 'categoria',
                'Familia', 'familia', 'Grupo', 'grupo', 'Sublinea', 'SubLínea'
            );
        }
        function getMarca(item) { return getField(item, 'Marca', 'InventarioProductoProveedorNombre', 'Proveedor'); }

        function obtenerFactorEmpaque(textoEmpaque) {
            if (!textoEmpaque) return 1;
            let factor = 1;
            // Bug #5: antes solo detectaba 'X' mayúscula; ahora es insensible a mayúsculas/minúsculas.
            let pos = textoEmpaque.indexOf('*');
            if (pos === -1) pos = textoEmpaque.toUpperCase().indexOf('X');
            if (pos !== -1) {
                let extraido = textoEmpaque.substring(pos + 1).trim();
                let numeros = extraido.replace(/\D/g, '');
                if (parseInt(numeros) > 1) factor = parseInt(numeros);
            }
            return factor;
        }

        // Bug #1: única fuente de verdad para el factor de empaque de un producto.
        // Antes renderResults() usaba solo getFactorEmpaque(item) y actualizarCantidades()
        // usaba obtenerFactorEmpaque(unidad) || getFactorEmpaque(item), pudiendo dar
        // resultados distintos para el mismo producto. Ahora ambos usan esta función.
        function getFactorFinal(item) {
            const unidad = getUnidadRef(item);
            return obtenerFactorEmpaque(unidad) || getFactorEmpaque(item) || 1;
        }

        // ============================================================
        // RESPALDO AUTOMÁTICO DE DATOS (por si se cae el link de Sheets)
        // ============================================================
        // Cada vez que la carga desde Google Sheets funciona bien, se guarda
        // una copia completa en este dispositivo. Si el link se desconecta
        // (como al reemplazar la hoja de cálculo), la app usa este respaldo
        // en vez de perder todo el inventario o mostrar datos de ejemplo.
        const BACKUP_KEY = 'buscador_respaldo_datos';

        function guardarRespaldo(data) {
            try {
                localStorage.setItem(BACKUP_KEY, JSON.stringify({
                    data: data,
                    fechaISO: new Date().toISOString()
                }));
            } catch (e) {
                console.warn('No se pudo guardar el respaldo de datos.', e);
            }
            // Offline real: IndexedDB (más capacidad que localStorage)
            try {
                if (window.IEM && typeof IEM.guardarCatalogoOffline === 'function') {
                    IEM.guardarCatalogoOffline(data);
                }
            } catch (e2) {}
            try {
                if (window.IEM && typeof IEM.setOfflineBadge === 'function') {
                    IEM.setOfflineBadge(false);
                }
            } catch (e3) {}
        }

        function cargarRespaldo() {
            try {
                const raw = localStorage.getItem(BACKUP_KEY);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                if (!parsed.data || !Array.isArray(parsed.data) || parsed.data.length === 0) return null;
                return parsed;
            } catch (e) {
                return null;
            }
        }

        function formatearFechaRespaldo(fechaISO) {
            try {
                const f = new Date(fechaISO);
                return f.toLocaleDateString() + ' ' + f.toLocaleTimeString();
            } catch (e) {
                return '';
            }
        }

        // ============================================================
        // CARGA DESDE GOOGLE SHEETS
        // ============================================================

        function contarConStock() {
            let n = 0;
            (currentData || []).forEach(function (item) {
                if (getCantidad(item) > 0) n++;
            });
            return n;
        }

        function actualizarEstadoCatalogo() {
            if (!fileStatus) return;
            const total = (currentData || []).length;
            const conStock = contarConStock();
            // Detalle de habilitados / catálogo solo para administrador
            if (typeof esAdmin === 'function' && esAdmin()) {
                const buscables = (currentData || []).filter(function (x) {
                    return typeof esProductoBuscableInventario === 'function'
                        ? esProductoBuscableInventario(x)
                        : (x.activo !== false && x.Activo !== false);
                }).length;
                const conActivos = (currentData || []).filter(function (x) {
                    return x.activo !== false && x.Activo !== false;
                }).length;
                fileStatus.textContent = '📦 Habilitados: ' + buscables + ' · Con stock: ' + conStock + ' (sin stock OK excepto PROM/CMB/CBM)';
                fileStatus.style.display = '';
            } else {
                // Almacén / conteo: sin números de catálogo
                fileStatus.textContent = '';
                fileStatus.style.display = 'none';
            }
        }

        async function loadFromGoogleSheets() {
            fileStatus.textContent = '⏳ Cargando productos desde Supabase...';
            try {
                // PostgREST limita ~1000 filas por request: paginar hasta traer todo
                const PAGE = 1000;
                let all = [];
                let from = 0;
                for (;;) {
                    // Carga TODO el catálogo (activos e inactivos).
                    // - Buscador inventario: solo habilitados (activo).
                    // - Vista Admin → Catálogo: todos, para ubicar códigos aunque estén desactivados.
                    let { data, error } = await supabaseClient
                        .from('productos')
                        .select('codigo,codigo_fabrica,codigo_barras,descripcion,unidad_ref,factor_empaque,stock_teorico,linea,marca,activo,tipo_almacen,imagen_url')
                        .order('codigo', { ascending: true })
                        .range(from, from + PAGE - 1);
                    if (error && /tipo_almacen/i.test(error.message || '')) {
                        const r0 = await supabaseClient
                            .from('productos')
                            .select('codigo,codigo_fabrica,codigo_barras,descripcion,unidad_ref,factor_empaque,stock_teorico,linea,marca,activo,imagen_url')
                            .order('codigo', { ascending: true })
                            .range(from, from + PAGE - 1);
                        data = r0.data; error = r0.error;
                    }
                    if (error && /imagen_url/i.test(error.message || '')) {
                        const r1 = await supabaseClient
                            .from('productos')
                            .select('codigo,codigo_fabrica,codigo_barras,descripcion,unidad_ref,factor_empaque,stock_teorico,linea,marca,activo,tipo_almacen')
                            .order('codigo', { ascending: true })
                            .range(from, from + PAGE - 1);
                        data = r1.data; error = r1.error;
                    }
                    if (error) throw error;
                    if (!data || !data.length) break;
                    all = all.concat(data);
                    if (data.length < PAGE) break;
                    from += PAGE;
                    if (from >= 100000) break;
                    fileStatus.textContent = '⏳ Cargando productos... ' + all.length;
                }
                if (all.length > 0) {
                    const mapTipo = leerMapaTipoAlmacen();
                    currentData = all.map(p => {
                        const tipo = normalizarTipoAlmacen(p.tipo_almacen) || mapTipo[p.codigo] || normalizarTipoAlmacen(p.linea) || '';
                        if (tipo && p.codigo) mapTipo[p.codigo] = tipo;
                        return {
                        Codigo: p.codigo,
                        CodigoFabrica: p.codigo_fabrica || '',
                        CodigoBarras: p.codigo_barras || '',
                        Producto: p.descripcion,
                        'Unidad Ref': p.unidad_ref || '',
                        Cantidad: String(p.stock_teorico ?? 0),
                        FactorEmpaque: String(p.factor_empaque ?? 1),
                        Linea: (normalizarTipoAlmacen(p.linea) ? '' : (p.linea || '')),
                        TipoAlmacen: tipo,
                        tipo_almacen: tipo,
                        Marca: p.marca || '',
                        activo: p.activo !== false,
                        Activo: p.activo !== false,
                        imagen_url: p.imagen_url || '',
                        ImagenUrl: p.imagen_url || '',
                        InventarioProductoCodigo: p.codigo,
                        InventarioProductoDescripcion: p.descripcion,
                        InventarioProductoUnidadReferenciaAbreviacion: p.unidad_ref || '',
                        InventarioProductoUnidadReferenciaFactor: String(p.factor_empaque ?? 1),
                        InventarioProductoCantidad: String(p.stock_teorico ?? 0),
                        InventarioProductoCategoriaDescripcion: p.linea || '',
                        InventarioProductoProveedorNombre: p.marca || ''
                    };
                    });
                    try { localStorage.setItem(TIPO_ALMACEN_KEY, JSON.stringify(mapTipo)); } catch (e) {}
                    // Índices + sincronizar Fríos/Secos desde nube a localStorage
                    var mapTipoSync = {};
                    currentData.forEach(function (item) {
                        var c = String(getCodigo(item) || '').trim();
                        var tip = normalizarTipoAlmacen(item.tipo_almacen || item.TipoAlmacen || '');
                        if (c && tip) {
                            mapTipoSync[c] = tip;
                            item.tipo_almacen = tip;
                            item.TipoAlmacen = tip;
                        }
                    });
                    try { if (typeof reindexarCatalogo === 'function') reindexarCatalogo(); } catch (eIdx) {
                        window._mapCodigo = Object.create(null);
                        window._mapBarras = Object.create(null);
                        window._mapFabrica = Object.create(null);
                        currentData.forEach(function (item) {
                            var c = String(getCodigo(item) || '').trim();
                            var f = String(getCodigoFabrica(item) || '').trim();
                            var b = String(getCodigoBarras(item) || '').trim();
                            item._sb = [c, f, b, getDescripcion(item)].join('\u0001').toUpperCase();
                            marcarFlagsProducto(item);
                            if (c) window._mapCodigo[c.toUpperCase()] = item;
                            if (f) { window._mapCodigo[f.toUpperCase()] = item; window._mapFabrica[f] = item; window._mapFabrica[f.replace(/\D/g,'')] = item; }
                            if (b && !(window._mapFabrica && window._mapFabrica[b])) window._mapBarras[b] = item;
                        });
                    }
                    try {
                        var prevMap = leerMapaTipoAlmacen();
                        Object.keys(mapTipoSync).forEach(function (k) { prevMap[k] = mapTipoSync[k]; });
                        localStorage.setItem(TIPO_ALMACEN_KEY, JSON.stringify(prevMap));
                    } catch (eMap) {}
                    guardarRespaldo(currentData);
                    aplicarBarrasLocalADatos();
                    try { if (typeof reindexarCatalogo === 'function') reindexarCatalogo(); } catch (e) {}
                    actualizarEstadoCatalogo();
                    // Refrescar teórico del conteo físico con el stock actual del catálogo
                    try { if (typeof sincronizarTeoricoDesdeCatalogo === 'function') sincronizarTeoricoDesdeCatalogo(); } catch (eSyncT) {}
                    if (!searchInput.value.trim() && selectedIndex === -1) {
                        filteredData = [];
                        renderResults([]);
                        limpiarCantidades();
                    }
                } else {
                    fileStatus.textContent = '⚠️ Sin productos en Supabase, buscando respaldo...';
                    useBackupOrLocalData();
                }
            } catch (err) {
                console.warn('Error Supabase productos:', err);
                fileStatus.textContent = '⚠️ Sin conexión, buscando respaldo...';
                useBackupOrLocalData();
            }
        }

        // Si Google Sheets falla o está vacío, primero intenta usar el último
        // respaldo bueno guardado en este dispositivo. Solo si tampoco hay
        // respaldo, cae a los datos de ejemplo.
        function aplicarRespaldoCatalogo(respaldo, origen) {
            if (!respaldo || !respaldo.data || !respaldo.data.length) return false;
            currentData = respaldo.data;
            try {
                if (typeof reindexarCatalogo === 'function') reindexarCatalogo();
            } catch (eIdx) {}
            try { aplicarBarrasLocalADatos(); } catch (eB) {}
            const fechaTexto = formatearFechaRespaldo(respaldo.fechaISO);
            actualizarEstadoCatalogo();
            try { if (typeof sincronizarTeoricoDesdeCatalogo === 'function') sincronizarTeoricoDesdeCatalogo(); } catch (eSyncT) {}
            if (fileStatus) {
                fileStatus.textContent = (fileStatus.textContent || '') +
                    ' · ' + (origen || 'respaldo') + (fechaTexto ? (' ' + fechaTexto) : '');
            }
            try {
                if (window.IEM && typeof IEM.setOfflineBadge === 'function') {
                    IEM.setOfflineBadge(true, fechaTexto || '');
                }
            } catch (eOff) {}
            if (!searchInput.value.trim() && selectedIndex === -1) {
                filteredData = [];
                renderResults([]);
                limpiarCantidades();
            }
            return true;
        }

        function useBackupOrLocalData() {
            // 1) Intento síncrono localStorage
            var local = cargarRespaldo();
            if (local && aplicarRespaldoCatalogo(local, 'offline')) {
                // 2) Mejorar con IndexedDB si hay copia más reciente (async)
                if (window.IEM && typeof IEM.leerCatalogoOffline === 'function') {
                    IEM.leerCatalogoOffline().then(function (idb) {
                        if (!idb || !idb.data || !idb.data.length) return;
                        var tLocal = local && local.fechaISO ? Date.parse(local.fechaISO) : 0;
                        var tIdb = idb.fechaISO ? Date.parse(idb.fechaISO) : 0;
                        if (tIdb > tLocal) aplicarRespaldoCatalogo(idb, 'offline IDB');
                    }).catch(function () {});
                }
                return;
            }
            // Solo IDB
            if (window.IEM && typeof IEM.leerCatalogoOffline === 'function') {
                IEM.leerCatalogoOffline().then(function (idb) {
                    if (idb && aplicarRespaldoCatalogo(idb, 'offline IDB')) return;
                    useLocalData();
                }).catch(function () { useLocalData(); });
                return;
            }
            useLocalData();
        }

        function useLocalData() {
            currentData = [...sampleData];
            fileStatus.textContent = `📋 ${currentData.length} registros de ejemplo`;
            try { if (typeof sincronizarTeoricoDesdeCatalogo === 'function') sincronizarTeoricoDesdeCatalogo(); } catch (eSyncT) {}
            // Bug #2: mismo cuidado que en loadFromGoogleSheets, para no interrumpir
            // una búsqueda o selección en curso si esto ocurre durante el auto-refresco.
            if (!searchInput.value.trim() && selectedIndex === -1) {
                filteredData = [];
                renderResults([]);
                limpiarCantidades();
            }
        }

        // Parser CSV robusto: procesa carácter a carácter para respetar comillas
        // ("..." puede contener el delimitador o saltos de línea) y no descarta
        // filas con menos columnas (las rellena con '' en vez de perder datos).
        function parseCSVRows(csvText) {
            const rows = [];
            let row = [];
            let field = '';
            let inQuotes = false;
            let i = 0;
            const len = csvText.length;

            // Detectar delimitador a partir de la primera línea (fuera de comillas)
            let delimiter = ',';
            let firstLineEnd = csvText.search(/\r?\n/);
            const sample = firstLineEnd === -1 ? csvText : csvText.slice(0, firstLineEnd);
            if (sample.includes(';') && !sample.includes(',')) delimiter = ';';
            else if (sample.includes('\t') && !sample.includes(',')) delimiter = '\t';

            while (i < len) {
                const char = csvText[i];

                if (inQuotes) {
                    if (char === '"') {
                        if (csvText[i + 1] === '"') { field += '"'; i += 2; continue; }
                        inQuotes = false; i++; continue;
                    }
                    field += char; i++; continue;
                }

                if (char === '"') { inQuotes = true; i++; continue; }
                if (char === delimiter) { row.push(field); field = ''; i++; continue; }
                if (char === '\r') { i++; continue; }
                if (char === '\n') {
                    row.push(field); field = '';
                    rows.push(row); row = [];
                    i++; continue;
                }
                field += char; i++;
            }
            // Última celda/fila pendiente
            if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }

            return rows.filter(r => r.some(v => v.trim() !== ''));
        }

        function parseCSV(csvText) {
            const rows = parseCSVRows(csvText);
            if (rows.length < 2) return null;
            const headers = rows[0].map(h => h.trim());
            const result = [];
            for (let i = 1; i < rows.length; i++) {
                const values = rows[i];
                const obj = {};
                headers.forEach((h, idx) => {
                    // Si la fila tiene menos columnas que el encabezado, se rellena
                    // con '' en vez de descartar el registro completo.
                    const v = values[idx];
                    obj[h] = v !== undefined ? v.trim() : '';
                });
                result.push(obj);
            }
            return result;
        }

        // ============================================================
        // BÚSQUEDA Y RENDER
        // ============================================================
        
        const TIPO_ALMACEN_KEY = 'iem_tipo_almacen_map';

        function normalizarTipoAlmacen(t) {
            const s = String(t || '').toUpperCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (!s) return '';
            if (s.indexOf('FRIO') !== -1) return 'FRIOS';
            if (s.indexOf('SECO') !== -1) return 'SECOS';
            return '';
        }

        function leerMapaTipoAlmacen() {
            try {
                const raw = localStorage.getItem(TIPO_ALMACEN_KEY);
                return raw ? (JSON.parse(raw) || {}) : {};
            } catch (e) { return {}; }
        }

        function guardarTipoAlmacenCodigo(codigo, tipo) {
            const cod = String(codigo || '').trim();
            const t = normalizarTipoAlmacen(tipo);
            if (!cod || !t) return;
            try {
                const map = leerMapaTipoAlmacen();
                map[cod] = t;
                localStorage.setItem(TIPO_ALMACEN_KEY, JSON.stringify(map));
            } catch (e) {}
        }

        function getTipoAlmacen(item) {
            if (!item) return '';
            const directo = normalizarTipoAlmacen(
                item.TipoAlmacen || item.tipo_almacen || item.tipoAlmacen || item['Tipo de Producto'] || ''
            );
            if (directo) return directo;
            const cod = String(getCodigo(item) || '').trim();
            if (cod) {
                const map = leerMapaTipoAlmacen();
                if (map[cod]) return map[cod];
            }
            // Compat: si linea solo dice Frios/Secos (import Laive antiguo)
            return normalizarTipoAlmacen(getLinea(item));
        }


        /** Códigos de servicio / no inventariables (no son productos Laive). */
        function esCodigoServicioOBasura(item) {
            const cod = String(getCodigo(item) || '').trim();
            const desc = String(getDescripcion(item) || '').toUpperCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (/RECOJO\s+DE\s+DEVOLUCION|DESCUENTOS?\s+VARIOS|VEH[IÍ]?CULO\s+MARCA|PRODUCTOS\s+VARIOS|^DEVOLUCION\b/.test(desc)) {
                return true;
            }
            // Códigos internos muy cortos tipo 0001–0009 con descripción genérica
            if (/^0+\d{1,3}$/.test(cod) && /DEVOLUCION|DESCUENTO|VEHICULO|VARIOS|OTROS/.test(desc)) {
                return true;
            }
            return false;
        }

        /** ¿Hay al menos un producto con tipo Fríos/Secos (base Laive aplicada)? */
        function catalogoTieneTiposLaive() {
            const data = currentData || [];
            for (let i = 0; i < data.length; i++) {
                const t = getTipoAlmacen(data[i]);
                if (t === 'FRIOS' || t === 'SECOS') return true;
            }
            return false;
        }

        /**
         * Producto visible en buscador de inventario:
         * - activo
         * - no es código de servicio
         * - si ya se subió Laive (hay tipos), solo los que tienen Fríos/Secos
         */

        /** Promos/combos: PROM, CBM, CMB (así vienen en el catálogo), COMBO, PACK. */
        function esPromoOCombo(item) {
            const desc = String(getDescripcion(item) || '').toUpperCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const cod = String(getCodigo(item) || '').toUpperCase().trim();
            const fab = String(getCodigoFabrica(item) || '').toUpperCase().trim();
            const linea = String(getLinea(item) || '').toUpperCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const blob = desc + ' ' + cod + ' ' + fab + ' ' + linea;
            if (/^(PROM|PROMO|CBM|CMB|COMBO)[\s.0-9(]/.test(desc)) return true;
            if (/^PACK\s*PROM/i.test(desc) || /\bPACK\s*PROMO?\b/i.test(desc)) return true;
            if (/\bPROM\b|\bPROMO\b|\bPROMOS\b|\bPROMOCION\b|\bPROM\./.test(blob)) return true;
            if (/\bCMB\d*\b|\bCBM\d*\b|\bCOMBO\b|PACK\s*PROM/.test(blob)) return true;
            if (/CMB\d*\(|CBM\d*\(/.test(desc)) return true;
            if (/^9\d{3,}$/.test(cod) && /PROM|CBM|CMB|COMBO/.test(desc)) return true;
            if (/^900\d+/.test(cod)) return true;
            if (/PROM|CBM|CMB|COMBO/.test(cod) || /PROM|CBM|CMB|COMBO/.test(fab)) return true;
            return false;
        }

        /** Stock teórico del sistema (unidades). */
        function stockTeoricoNum(item) {
            var n = 0;
            try { n = Number(getCantidad(item)); } catch (e) { n = 0; }
            if (!isFinite(n) || n < 0) n = 0;
            return n;
        }

        function marcarFlagsProducto(item) {
            if (!item) return item;
            try {
                item._esPromo = esPromoOCombo(item);
                item._stockN = stockTeoricoNum(item);
                var activo = item.activo !== false && item.Activo !== false && item.ACTIVO !== false;
                var basura = false;
                try { basura = esCodigoServicioOBasura(item); } catch (e) { basura = false; }
                // PROM/CMB/CBM con stock 0 no buscables
                item._buscable = !!(activo && !basura && !(item._esPromo && item._stockN <= 0));
            } catch (e2) {
                item._buscable = (item.activo !== false);
            }
            return item;
        }

        function esProductoBuscableInventario(item) {
            if (!item) return false;
            // Flag precalculado al cargar catálogo (mucho más rápido en cada tecla)
            if (item._buscable === true || item._buscable === false) return item._buscable;
            if (esCodigoServicioOBasura(item)) return false;
            const activoItem = item.activo !== false && item.Activo !== false && item.ACTIVO !== false;
            if (!activoItem) return false;
            if (esPromoOCombo(item) && stockTeoricoNum(item) <= 0) return false;
            return true;
        }

        function setFiltroTipoLaive(tipo) {
            filtroTipoLaive = normalizarTipoAlmacen(tipo) || (tipo ? String(tipo).toUpperCase() : '');
            if (filtroTipoLaive !== 'FRIOS' && filtroTipoLaive !== 'SECOS') filtroTipoLaive = '';
            document.querySelectorAll('[data-filtro-tipo]').forEach(function (btn) {
                const t = (btn.getAttribute('data-filtro-tipo') || '').toUpperCase();
                btn.classList.toggle('active', t === filtroTipoLaive || (filtroTipoLaive === '' && t === ''));
            });
            if (typeof performSearch === 'function') performSearch();
            if (typeof renderVistaPreviaInventario === 'function') {
                const vista = document.getElementById('adminVistaPreview');
                if (vista && document.body.classList.contains('admin-open')) {
                    try { renderVistaPreviaInventario(); } catch (e) {}
                }
            }
        }

        function reindexarCatalogo() {
            window._mapCodigo = Object.create(null);
            window._mapBarras = Object.create(null);
            window._mapFabrica = Object.create(null);
            function idx(map, key, item) {
                if (!key || !item) return;
                var s = String(key).trim();
                if (!s) return;
                map[s] = item;
                map[s.toUpperCase()] = item;
                var d = s.replace(/\D/g, '');
                if (d) {
                    map[d] = item;
                    var n = d.replace(/^0+/, '') || '0';
                    if (n !== d) map[n] = item;
                }
            }
            (currentData || []).forEach(function (item) {
                if (!item) return;
                var c = String(getCodigo(item) || '').trim();
                var f = String(getCodigoFabrica(item) || '').trim();
                var b = String(getCodigoBarras(item) || '').trim();
                if (f) { item.CodigoFabrica = f; item.codigo_fabrica = f; }
                item._sb = [c, f, b, getDescripcion(item), getUnidadRef(item), getLinea(item), getMarca(item)].join('\u0001').toUpperCase();
                try { marcarFlagsProducto(item); } catch (e) {}
                idx(window._mapCodigo, c, item);
                idx(window._mapCodigo, f, item);
                idx(window._mapFabrica, f, item);
                if (b && !(window._mapFabrica[b] || window._mapFabrica[b.replace(/\D/g,'')])) idx(window._mapBarras, b, item);
            });
        }

        function performSearch() {
            const term = searchInput.value.trim();
            if (!term) {
                filteredData = [];
                // Sin texto: no mostrar mensaje vacío (bloqueaba touch en móvil)
                resultList.innerHTML = '';
                resultList.classList.add('result-list-collapsed');
                resultList.classList.remove('result-list-open');
                try {
                    var rs0 = document.getElementById('resultsSection');
                    if (rs0) rs0.classList.remove('has-results');
                    document.body.classList.remove('search-open');
                } catch (e0) {}
                resultCount.textContent = '0';
                cajasCount.textContent = '0';
                unidadesCount.textContent = '0';
                selectedIndex = -1;
                limpiarCantidades();
                return;
            }
            const termCompact = term.replace(/\s/g, '');
            const termUpper = term.toUpperCase();
            const enPedido = (typeof modoPedido !== 'undefined' && modoPedido);
            const pareceBarras = /^[0-9]{8,}$/.test(termCompact);

            // Atajo O(1): código o barras exactos (también respeta filtro PROM/CBM stock 0)
            var hitExact = null;
            var termDigits = (typeof soloDigitos === 'function') ? soloDigitos(termCompact) : termCompact.replace(/\D/g, '');
            // 1) Código de fábrica primero (evita conflicto con QR/barras guardados)
            if (window._mapFabrica) {
                hitExact = window._mapFabrica[termCompact] || window._mapFabrica[termDigits] || window._mapFabrica[termUpper];
            }
            // 2) Código SAP
            if (!hitExact && window._mapCodigo) {
                hitExact = window._mapCodigo[termUpper] || window._mapCodigo[termCompact] || window._mapCodigo[termDigits];
            }
            // 3) Barras solo si ese número NO es fábrica de alguien
            if (!hitExact && window._mapBarras) {
                var fabBusy = window._mapFabrica && (window._mapFabrica[termCompact] || window._mapFabrica[termDigits]);
                if (!fabBusy) hitExact = window._mapBarras[termCompact] || window._mapBarras[termDigits];
            }
            // 4) Barrido lineal por fábrica 6–14 dígitos
            if (!hitExact && termDigits && termDigits.length >= 6 && termDigits.length <= 14) {
                for (var hi = 0; hi < (currentData || []).length; hi++) {
                    var itH = currentData[hi];
                    if (!itH) continue;
                    if (!enPedido && typeof esProductoBuscableInventario === 'function' && !esProductoBuscableInventario(itH)) continue;
                    var fdH = (typeof soloDigitos === 'function' ? soloDigitos(getCodigoFabrica(itH)) : String(getCodigoFabrica(itH) || '').replace(/\D/g, ''));
                    if (fdH && fdH === termDigits) { hitExact = itH; break; }
                }
            }
            // Hit exacto inválido → no cortar la búsqueda
            if (hitExact && !enPedido && !esProductoBuscableInventario(hitExact)) {
                hitExact = null;
            }

            // Barrido por fábrica / SAP (siempre, es lo más fiable para 4 y 8 dígitos)
            if (termDigits && termDigits.length >= 4 && termDigits.length <= 14) {
                var hitsFab = [];
                var hitsSap = [];
                for (var hi = 0; hi < (currentData || []).length; hi++) {
                    var itH = currentData[hi];
                    if (!itH) continue;
                    if (!enPedido && !esProductoBuscableInventario(itH)) continue;
                    if (filtroTipoLaive) {
                        var tipH = getTipoAlmacen(itH);
                        if (tipH && tipH !== filtroTipoLaive) continue;
                    }
                    var rawFab = String(getCodigoFabrica(itH) || '').trim();
                    var rawCod = String(getCodigo(itH) || '').trim();
                    var fdH = soloDigitos(rawFab);
                    var cdH = soloDigitos(rawCod);
                    if (fdH === termDigits || rawFab === termCompact || rawFab.toUpperCase() === termUpper) {
                        hitsFab.push(itH);
                    } else if (cdH === termDigits || rawCod.toUpperCase() === termUpper || rawCod === termCompact) {
                        hitsSap.push(itH);
                    }
                }
                if (hitsFab.length) {
                    filteredData = hitsFab;
                    renderResults(filteredData);
                    return;
                }
                if (hitsSap.length) {
                    filteredData = hitsSap;
                    renderResults(filteredData);
                    return;
                }
            }

            if (hitExact) {
                filteredData = [hitExact];
                renderResults(filteredData);
                return;
            }

            const palabras = term.split(/\s+/).filter(p => p.length > 0);
            const palabrasUpper = palabras.map(p => p.toUpperCase());

            filteredData = currentData.filter(item => {
                const cod = String(getCodigo(item) || '').toUpperCase();
                const fab = String(getCodigoFabrica(item) || '').toUpperCase();
                const bar = String(getCodigoBarras(item) || '').toUpperCase().trim();
                const matchBarras = bar && (bar === termUpper || bar.indexOf(termUpper) !== -1);
                const matchCodigoExacto = cod === termUpper || fab === termUpper
                    || soloDigitos(fab) === termDigits
                    || soloDigitos(cod) === termDigits;

                // Inventario: activos + PROM/CBM solo si stock > 0. Sin excepciones por código exacto
                // para promos en cero (si no, seguían apareciendo al buscar el código).
                if (!enPedido) {
                    if (!esProductoBuscableInventario(item)) return false;
                } else {
                    const activoItem = item.activo !== false && item.Activo !== false && item.ACTIVO !== false;
                    if (!activoItem && !(matchBarras || matchCodigoExacto)) return false;
                    // En modo pedido tampoco listar PROM/CBM sin stock
                    if (esPromoOCombo(item) && stockTeoricoNum(item) <= 0) return false;
                }

                // Filtro Frios / Secos
                if (filtroTipoLaive) {
                    const tipo = getTipoAlmacen(item);
                    if (tipo !== filtroTipoLaive) return false;
                }

                const blob = item._sb || [
                    cod, fab, bar,
                    getDescripcion(item).toUpperCase(),
                    getUnidadRef(item).toUpperCase(),
                    getLinea(item).toUpperCase(),
                    getMarca(item).toUpperCase()
                ].join('\u0001');
                return palabrasUpper.every(function (pal) { return blob.indexOf(pal) !== -1; });
            });

            // Priorizar fábrica exacta sobre barras cuando hay varios hits
            if (pareceBarras && filteredData.length > 1) {
                var td = termDigits || termCompact;
                var exactFab = filteredData.filter(function (item) {
                    var fd = String(getCodigoFabrica(item) || '').replace(/\D/g, '');
                    return fd === td || String(getCodigoFabrica(item) || '').trim() === termCompact;
                });
                if (exactFab.length) filteredData = exactFab;
                else {
                    var exactos = filteredData.filter(function (item) {
                        return String(getCodigoBarras(item) || '').trim() === term.replace(/\s/g, '');
                    });
                    if (exactos.length) filteredData = exactos;
                }
            }

            renderResults(filteredData);
        }


        // PC = lista en resultsSection (estilo 4.5.3). Móvil = desplegable bajo el input.
        function iemPlaceResultList() {
            var list = document.getElementById('resultList');
            if (!list) return;
            var suggest = document.getElementById('searchSuggestWrap');
            var panel = document.getElementById('pcPanelLista') || document.getElementById('resultsSection');
            var mobile = false;
            try { mobile = window.matchMedia && window.matchMedia('(max-width: 959px)').matches; } catch (e) {}
            if (mobile && suggest) {
                if (list.parentElement !== suggest) suggest.appendChild(list);
            } else if (panel) {
                // Insertar después del results-header si existe
                var header = panel.querySelector('.results-header');
                if (header && header.nextSibling !== list) {
                    if (header.nextSibling) panel.insertBefore(list, header.nextSibling);
                    else panel.appendChild(list);
                } else if (list.parentElement !== panel) {
                    panel.appendChild(list);
                }
            }
        }
        try {
            iemPlaceResultList();
            window.addEventListener('resize', function () {
                clearTimeout(window.__iemPlaceListT);
                window.__iemPlaceListT = setTimeout(iemPlaceResultList, 120);
            });
            document.addEventListener('DOMContentLoaded', iemPlaceResultList);
        } catch (ePlace) {}

        function renderResults(items) {
            try { if (typeof iemPlaceResultList === 'function') iemPlaceResultList(); } catch (ePL) {}
            const MAX_SHOW = 60;
            const totalHit = items ? items.length : 0;
            if (items && items.length > MAX_SHOW) items = items.slice(0, MAX_SHOW);
            if (!items || items.length === 0) {
                var termNow = '';
                try { termNow = (searchInput && searchInput.value) ? searchInput.value.trim() : ''; } catch (e) {}
                if (!termNow) {
                    // Sin búsqueda: colapsar lista para no bloquear scroll/touch
                    resultList.innerHTML = '';
                    resultList.classList.add('result-list-collapsed');
                    resultList.classList.remove('result-list-open');
                    try { document.body.classList.remove('search-open'); } catch (eB) {}
                } else {
                    resultList.innerHTML = '<div class="empty-message"><span class="empty-title">Sin resultados</span>No hay productos con ese criterio.<span class="empty-hint">Revisa el código o prueba menos letras · PROM/CMB en cero no aparecen</span></div>';
                    resultList.classList.remove('result-list-collapsed');
                    resultList.classList.add('result-list-open');
                    try { document.body.classList.add('search-open'); } catch (eB2) {}
                }
                resultCount.textContent = '0';
                cajasCount.textContent = '0';
                unidadesCount.textContent = '0';
                selectedIndex = -1;
                limpiarCantidades();
                try {
                    var rs = document.getElementById('resultsSection');
                    if (rs) rs.classList.toggle('has-results', !!termNow);
                } catch (eRs) {}
                return;
            }
            resultList.classList.remove('result-list-collapsed');
            resultList.classList.add('result-list-open');
            try {
                var rs2 = document.getElementById('resultsSection');
                if (rs2) rs2.classList.add('has-results');
                document.body.classList.add('search-open');
            } catch (eRs2) {}

            // En móvil: lista de sugerencias con más resultados y scroll (nombres completos + imagen más grande)
            var isMobileList = false;
            try { isMobileList = window.matchMedia && window.matchMedia('(max-width: 640px)').matches; } catch (eM) {}
            if (isMobileList && items.length > 30) items = items.slice(0, 30);

            let html = '';
            items.forEach((item, idx) => {
                const codigo = escapeHtml(getCodigo(item));
                const fabrica = escapeHtml(getCodigoFabrica(item));
                const desc = escapeHtml(getDescripcion(item));
                const unidad = escapeHtml(getUnidadRef(item));
                const linea = escapeHtml((typeof getLinea === 'function' ? getLinea(item) : '') || '');
                const marca = escapeHtml((typeof getMarca === 'function' ? getMarca(item) : '') || '');
                const cantidad = getCantidad(item);
                const factor = getFactorFinal(item);
                const cajasStock = factor === 1 ? 0 : Math.floor(cantidad / factor);
                const unidadesStock = factor === 1 ? cantidad : cantidad % factor;
                const stockLabel = factor === 1
                    ? (unidadesStock + ' und')
                    : (cajasStock + ' cj · ' + unidadesStock + ' und');
                const selectedClass = (idx === selectedIndex) ? ' selected' : '';
                var yaContadoDesk = false;
                try {
                    var codRawDesk = getCodigo(item);
                    if (typeof inventarioFisico !== 'undefined' && Array.isArray(inventarioFisico) && codRawDesk) {
                        yaContadoDesk = inventarioFisico.some(function (r) {
                            return r && String(r.codigo || '') === String(codRawDesk);
                        });
                    }
                } catch (eYCD) {}
                const imgUrl = getImagenUrl(item);
                const imgHtml = buildProductImgHtml(imgUrl, 'prod-img', idx);

                // Móvil / lista compacta: imagen grande + código + nombre + meta (stock, línea)
                if (isMobileList) {
                    const imgSuggest = buildProductImgHtml(imgUrl, 'suggest-img', idx);
                    const metaBits = [];
                    if (fabrica) metaBits.push('Fáb ' + fabrica);
                    if (linea) metaBits.push(linea);
                    if (unidad) metaBits.push(unidad);
                    metaBits.push(stockLabel);
                    var yaContado = false;
                    try {
                        var codRaw = getCodigo(item);
                        if (typeof inventarioFisico !== 'undefined' && Array.isArray(inventarioFisico) && codRaw) {
                            yaContado = inventarioFisico.some(function (r) {
                                return r && String(r.codigo || '') === String(codRaw);
                            });
                        }
                    } catch (eYC) {}
                    var badgeContado = yaContado
                        ? '<span class="suggest-badge-contado" title="Ya en conteo físico">Contado</span>'
                        : '';
                    html += `<div class="result-item result-item-suggest${selectedClass}${yaContado ? ' is-contado' : ''}" data-index="${idx}" role="option" aria-selected="${idx === selectedIndex ? 'true' : 'false'}">
                        ${imgSuggest}
                        <div class="suggest-main">
                            <div class="suggest-top">
                                <span class="suggest-code">${codigo}</span>
                                ${marca ? '<span class="suggest-marca">' + marca + '</span>' : ''}
                                ${badgeContado}
                            </div>
                            <span class="suggest-text">${desc}</span>
                            <span class="suggest-meta">${metaBits.join(' · ')}</span>
                        </div>
                        <span class="suggest-chevron" aria-hidden="true">›</span>
                    </div>`;
                    return;
                }

                html += `<div class="result-item${selectedClass}" data-index="${idx}" role="option" aria-selected="${idx === selectedIndex ? 'true' : 'false'}">
                    ${imgHtml}
                    <span class="codigo">${codigo}</span>
                    <span class="fabrica">${fabrica}</span>
                    <span class="descripcion">${desc}</span>
                    <span class="unidad">${unidad}</span>
                    <span class="stock-cajas">${cajasStock}</span>
                    <span class="stock-unidades">${unidadesStock}</span>
                    <div class="result-body">
                        <div class="ri-title">${desc}${yaContadoDesk ? ' <span class="suggest-badge-contado">Contado</span>' : ''}</div>
                        <div class="ri-meta">
                            <span class="codigo">Cód: ${codigo}</span>
                            <span class="fabrica">Fáb: ${fabrica || '—'}</span>
                            <span class="unidad">${unidad}</span>
                            ${linea ? '<span class="ri-linea">' + linea + '</span>' : ''}
                            ${marca ? '<span class="ri-marca">' + marca + '</span>' : ''}
                        </div>
                        <div class="ri-stock">
                            <span class="cajas">${cajasStock} cajas</span>
                            <span class="unidades">${unidadesStock} und</span>
                        </div>
                    </div>
                </div>`;
            });
            resultList.innerHTML = html;
            resultCount.textContent = (typeof totalHit === 'number' && totalHit > items.length) ? (items.length + '/' + totalHit) : String(items.length);

            if (selectedIndex !== -1 && selectedIndex < items.length) {
                actualizarCantidades(items[selectedIndex]);
            } else {
                limpiarCantidades();
            }

            document.querySelectorAll('.result-item').forEach(el => {
                el.addEventListener('click', function() {
                    const idx = parseInt(this.dataset.index);
                    if (idx === selectedIndex) return;
                    document.querySelectorAll('.result-item').forEach(e => e.classList.remove('selected'));
                    this.classList.add('selected');
                    selectedIndex = idx;
                    if (selectedIndex < filteredData.length) {
                        actualizarCantidades(filteredData[selectedIndex]);
                        if (typeof actualizarFilaVincular === 'function') actualizarFilaVincular();
                    }
                });
            });
        }

        // ============================================================
        // VENCIMIENTO (control de fechas)
        // ============================================================
        const MESES_CORTOS = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

        function poblarSelectDia() {
            selDia.innerHTML = '';
            for (let d = 1; d <= 31; d++) {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = String(d).padStart(2, '0');
                selDia.appendChild(opt);
            }
        }

        function poblarSelectMes() {
            selMes.innerHTML = '';
            MESES_CORTOS.forEach((m, idx) => {
                const opt = document.createElement('option');
                opt.value = idx + 1;
                opt.textContent = `${String(idx + 1).padStart(2, '0')}-${m}`;
                selMes.appendChild(opt);
            });
        }

        function poblarYearTabs() {
            const base = new Date().getFullYear();
            yearTabs.innerHTML = '';
            for (let y = base; y <= base + 7; y++) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'year-tab' + (y === anioSeleccionado ? ' active' : '');
                btn.textContent = y;
                btn.dataset.year = y;
                btn.addEventListener('click', () => {
                    anioSeleccionado = y;
                    document.querySelectorAll('.year-tab').forEach(t => t.classList.remove('active'));
                    btn.classList.add('active');
                });
                yearTabs.appendChild(btn);
            }
        }

        function resetVencimientoAHoy() {
            const hoy = new Date();
            selDia.value = hoy.getDate();
            selMes.value = hoy.getMonth() + 1;
            anioSeleccionado = hoy.getFullYear();
            document.querySelectorAll('.year-tab').forEach(t => {
                t.classList.toggle('active', parseInt(t.dataset.year) === anioSeleccionado);
            });
        }

        function obtenerVencimientoSeleccionado() {
            const dia = String(selDia.value).padStart(2, '0');
            const mes = String(selMes.value).padStart(2, '0');
            return `${dia}-${mes}-${anioSeleccionado}`;
        }

        // Muestra en chips las fechas de vencimiento registradas para este
        // código de producto en los últimos 14 días (según la fecha/hora en
        // que se hizo el registro, no la fecha de vencimiento en sí). Cada
        // chip es un lote independiente y se puede eliminar por separado.
        function renderFechasRegistradas(codigo, unidadRef) {
            const LIMITE_DIAS = 14;
            const ahora = Date.now();
            const record = inventarioFisico.find(d => d.codigo === codigo);
            const lotes = (record && record.lotes) ? record.lotes : [];

            const recientes = lotes
                .map((l, idx) => ({ ...l, idx }))
                .filter(l => {
                    if (!l.fechaISO) return true; // lotes antiguos sin marca de tiempo: se muestran igual
                    const dias = (ahora - new Date(l.fechaISO).getTime()) / 86400000;
                    return dias <= LIMITE_DIAS;
                });

            if (recientes.length === 0) {
                vencChips.innerHTML = `<span class="venc-chip-empty">Sin registros recientes para este producto.</span>`;
                return;
            }

            var factorChip = 1;
            try {
                if (record && record.factor) factorChip = Number(record.factor) || 1;
            } catch (eF) { factorChip = 1; }
            if (factorChip < 1) factorChip = 1;

            // Solo admin puede eliminar lotes; usuarios de almacén solo ven el registro
            var puedeEliminarLote = (typeof esAdmin === 'function') ? esAdmin() : false;

            vencChips.innerHTML = recientes.map(function (l) {
                var cant = Number(l.cantidad) || 0;
                var cajasL = factorChip > 1 ? Math.floor(cant / factorChip) : 0;
                var undL = factorChip > 1 ? (cant % factorChip) : cant;
                // Solo cajas/unidades; el factor (CJ*24/UND) no se muestra (va en el reporte)
                var qtyTxt = factorChip > 1
                    ? (cajasL + ' cj · ' + undL + ' und')
                    : (undL + ' und');
                var delBtn = puedeEliminarLote
                    ? ('<button type="button" class="venc-chip-del" data-codigo="' + codigo +
                       '" data-idx="' + l.idx + '" title="Eliminar este lote">✕</button>')
                    : '';
                return '<span class="venc-chip">' +
                    '<span class="venc-chip-date">' + (l.vencimiento || 'S/F') + '</span>' +
                    '<span class="venc-chip-qty">' + qtyTxt + '</span>' +
                    delBtn + '</span>';
            }).join('');

            if (puedeEliminarLote) {
                document.querySelectorAll('.venc-chip-del').forEach(btn => {
                    btn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        eliminarLote(this.dataset.codigo, parseInt(this.dataset.idx));
                    });
                });
            }
        }

        // Elimina un lote puntual (una cantidad con su fecha) de un producto
        // ya contado, y recalcula el total físico y la diferencia. Si era el
        // único lote, se elimina la fila completa del inventario físico.
        // También avisa al servidor para que el borrado se refleje en los
        // demás celulares/PC. Solo administrador.
        function eliminarLote(codigo, idx) {
            if (typeof esAdmin === 'function' && !esAdmin()) {
                try { showToast('Solo el administrador puede eliminar lotes.', 'error'); } catch (e) {}
                return;
            }
            const record = inventarioFisico.find(d => d.codigo === codigo);
            if (!record || !record.lotes) return;
            const [loteEliminado] = record.lotes.splice(idx, 1);
            if (record.lotes.length === 0) {
                inventarioFisico = inventarioFisico.filter(d => d.codigo !== codigo);
            } else {
                record.stockFisico = record.lotes.reduce((sum, l) => sum + l.cantidad, 0);
                record.diferencia = record.stockFisico - record.stockTeorico;
            }
            if (loteEliminado) eliminarLoteDelServidor(loteEliminado.id);
            saveInventario();
            renderInventario();
            if (selectedIndex !== -1 && selectedIndex < filteredData.length) {
                const item = filteredData[selectedIndex];
                if (getCodigo(item) === codigo) {
                    renderFechasRegistradas(codigo, getUnidadRef(item));
                }
            }
            showToast('Lote eliminado.', 'info');
        }

        // ============================================================
        // ACTUALIZAR CANTIDADES
        // ============================================================
        function actualizarCantidades(item) {
            let factor = getFactorFinal(item);
            currentFactor = factor;

            infoFactor.textContent = `Factor: ${factor}`;

            if (factor === 1) {
                cajasGroup.classList.add('hidden');
                txtCajas.disabled = true;
                txtCajas.value = '0';
            } else {
                cajasGroup.classList.remove('hidden');
                txtCajas.disabled = false;
                txtCajas.value = '0';
            }

            txtUnidades.value = '0';
            txtUnidades.disabled = false;

            const cantidad = getCantidad(item);
            const cajasStock = factor === 1 ? 0 : Math.floor(cantidad / factor);
            const unidadesStock = factor === 1 ? cantidad : cantidad % factor;
            cajasCount.textContent = cajasStock;
            unidadesCount.textContent = unidadesStock;

            vencBlock.classList.remove('hidden');
            resetVencimientoAHoy();
            renderFechasRegistradas(getCodigo(item), getUnidadRef(item));

            // Datos de la tarjeta de producto seleccionado (vista ampliada)
            document.body.classList.add('modo-seleccion');
            try { if (typeof window.__iemSyncFabCalc === 'function') window.__iemSyncFabCalc(); } catch (eFab1) {}
            try { if (typeof window.__iemSyncInventarioCard === 'function') window.__iemSyncInventarioCard(); } catch (eCol) {}
            try {
                if (typeof iemPlaceResultList === 'function') iemPlaceResultList();
                if (resultList) {
                    resultList.classList.remove('result-list-collapsed');
                    resultList.classList.add('result-list-open');
                }
            } catch (eMS) {}
            paDescripcion.textContent = getDescripcion(item);
            const codFab = getCodigoFabrica(item);
            paCodigo.textContent = codFab ? `Cód: ${getCodigo(item)} | Cód. Fábrica: ${codFab}` : `Cód: ${getCodigo(item)}`;
            paUnidad.textContent = getUnidadRef(item) || '-';
            paFactor.textContent = factor === 1 ? 'Unidad suelta' : `${factor} und/caja`;
            paStock.textContent = factor === 1
                ? `${unidadesStock} unidades`
                : `${cajasStock} cajas, ${unidadesStock} unidades`;
            paTotalUnidad.textContent = getUnidadRef(item) || '';

            // Datos adicionales en vista ampliada
            try {
                var lin = (typeof getLinea === 'function' ? getLinea(item) : '') || '';
                var mar = (typeof getMarca === 'function' ? getMarca(item) : '') || '';
                var bar = (typeof getCodigoBarras === 'function' ? getCodigoBarras(item) : '') || '';
                var elLin = document.getElementById('paLinea');
                var elMar = document.getElementById('paMarca');
                var elBar = document.getElementById('paBarras');
                var wLin = document.getElementById('paLineaWrap');
                var wMar = document.getElementById('paMarcaWrap');
                var wBar = document.getElementById('paBarrasWrap');
                if (elLin) elLin.textContent = lin || '-';
                if (elMar) elMar.textContent = mar || '-';
                if (elBar) elBar.textContent = bar || '-';
                if (wLin) wLin.hidden = !lin;
                if (wMar) wMar.hidden = !mar;
                if (wBar) wBar.hidden = !bar;
            } catch (eExtra) {}

            if (paImg) {
                setProductActiveImage(getImagenUrl(item));
            }
            actualizarTotalCalculado();
        }


        /** Oculta el desplegable de productos sugeridos (sin borrar el texto del buscador). */
        function cerrarSugerenciasBusqueda() {
            try {
                if (!resultList) return;
                var abierto = resultList.classList.contains('result-list-open') ||
                    document.body.classList.contains('search-open');
                if (!abierto && !(resultList.innerHTML && resultList.innerHTML.trim())) return false;
                resultList.innerHTML = '';
                resultList.classList.add('result-list-collapsed');
                resultList.classList.remove('result-list-open');
                document.body.classList.remove('search-open');
                try {
                    var rs = document.getElementById('resultsSection');
                    if (rs) rs.classList.remove('has-results');
                } catch (e) {}
                return true;
            } catch (err) {
                return false;
            }
        }

        function limpiarCantidades() {
            iemModoEdicion = false;
            try {
                var btnGx = document.getElementById('btnRegistrarFisico');
                if (btnGx && btnGx.dataset.editLabel) {
                    btnGx.innerHTML = btnGx.dataset.editLabel;
                    delete btnGx.dataset.editLabel;
                }
            } catch (eGx) {}
            cajasGroup.classList.remove('hidden');
            txtCajas.value = '0';
            txtUnidades.value = '0';
            currentFactor = 1;
            infoFactor.textContent = 'Factor: 1';
            txtCajas.disabled = true;
            txtUnidades.disabled = false;
            cajasCount.textContent = '0';
            unidadesCount.textContent = '0';
            vencBlock.classList.add('hidden');
            document.body.classList.remove('modo-seleccion');
            try { if (typeof window.__iemSyncFabCalc === 'function') window.__iemSyncFabCalc(); } catch (eFab0) {}
            try { if (typeof window.__iemSyncInventarioCard === 'function') window.__iemSyncInventarioCard(); } catch (eInv0) {}
            paTotalValor.textContent = '0';
            if (paImg) {
                paImg.removeAttribute('src');
                paImg.style.display = 'none';
            }
        }

        // Regresa de la tarjeta de producto seleccionado a la lista de
        // resultados, sin perder el término de búsqueda ni la lista ya
        // cargada, para poder elegir el siguiente producto rápido.
        function volverABuscar() {
            selectedIndex = -1;
            document.querySelectorAll('.result-item').forEach(e => e.classList.remove('selected'));
            limpiarCantidades();
        }

        // Calcula en vivo cuánto se va a registrar (cajas*factor + unidades
        // sueltas) para mostrarlo en la tarjeta de producto seleccionado.
        function actualizarTotalCalculado() {
            const cajas = parseInt(txtCajas.value) || 0;
            const unidades = parseInt(txtUnidades.value) || 0;
            const total = (cajas * currentFactor) + unidades;
            paTotalValor.textContent = total;
            actualizarAvisoConversion(cajas, unidades);
        }

        // Si el producto tiene factor de empaque (viene en cajas) y el
        // usuario está escribiendo la cantidad como unidades sueltas (por
        // ejemplo, contó 50 unidades sueltas de un producto que se
        // empaca de a 12), se muestra un aviso en vivo de a cuántas cajas
        // + unidades sueltas equivale, sin tocar todavía lo que el
        // usuario está escribiendo (para no mover el cursor mientras
        // tipea). La conversión real se aplica al salir del campo, con
        // normalizarUnidadesACajas().
        function actualizarAvisoConversion(cajas, unidades) {
            if (currentFactor > 1 && unidades >= currentFactor) {
                const cajasEquivalentes = cajas + Math.floor(unidades / currentFactor);
                const unidadesRestantes = unidades % currentFactor;
                conversionHint.textContent = `🔄 Equivale a ${cajasEquivalentes} caja${cajasEquivalentes === 1 ? '' : 's'} + ${unidadesRestantes} unidad${unidadesRestantes === 1 ? '' : 'es'} suelta${unidadesRestantes === 1 ? '' : 's'}`;
                conversionHint.classList.add('visible');
            } else {
                conversionHint.classList.remove('visible');
            }
        }

        // Aplica de verdad la conversión: mueve el sobrante de "Unidades"
        // hacia "Cajas" según el factor de empaque del producto. Se llama
        // al salir del campo de unidades y también justo antes de
        // guardar/agregar, así el usuario puede escribir todo en
        // unidades sueltas (como ya venía contando) y la app lo reparte
        // sola en cajas + unidades cuando corresponde.
        function normalizarUnidadesACajas() {
            if (currentFactor <= 1) return;
            const cajas = parseInt(txtCajas.value) || 0;
            const unidades = parseInt(txtUnidades.value) || 0;
            if (unidades >= currentFactor) {
                txtCajas.value = cajas + Math.floor(unidades / currentFactor);
                txtUnidades.value = unidades % currentFactor;
            }
            conversionHint.classList.remove('visible');
            actualizarTotalCalculado();
        }

        // ============================================================
        // PEDIDO (modo secundario + mismo buscador / catálogo existencias)
        // ============================================================
        let modoPedido = false;
        let filtroTipoLaive = ''; // '' | 'FRIOS' | 'SECOS'

        function activarModoPedido() {
            // Desactivado en Inventario: usar app Ventas / pedidos sugeridos
            try { showToast('Pedidos: usa la app Ventas.', 'info'); } catch (e) {}
            modoPedido = false;
            return;
            modoPedido = true;
            document.body.classList.add('modo-pedido-activo');
            const banner = document.getElementById('modoPedidoBanner');
            if (banner) banner.classList.remove('hidden');
            setCardExpandida('pedido', true);
            // Mismo buscador: enfocar y mostrar sección de búsqueda
            document.body.classList.remove('modo-seleccion');
            try { if (typeof window.__iemSyncFabCalc === 'function') window.__iemSyncFabCalc(); } catch (eFab0) {}
            try { if (typeof window.__iemSyncInventarioCard === 'function') window.__iemSyncInventarioCard(); } catch (eInv0) {}
            const searchSection = document.getElementById('searchSection');
            if (searchSection) {
                searchSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
            showToast('Modo pedido activo. Busca por código o nombre del catálogo.', 'info');
        }

        function salirModoPedido() {
            modoPedido = false;
            document.body.classList.remove('modo-pedido-activo');
            const banner = document.getElementById('modoPedidoBanner');
            if (banner) banner.classList.add('hidden');
            showToast('Volviste al modo inventario.', 'info');
        }

        function agregarProducto() {
            if (selectedIndex === -1 || selectedIndex >= filteredData.length) {
                showToast('Seleccione un producto de la lista.', 'error');
                return;
            }
            normalizarUnidadesACajas();
            const item = filteredData[selectedIndex];
            const codigo = getCodigo(item);
            const codigoFabrica = getCodigoFabrica(item);
            const descripcion = getDescripcion(item);
            const unidad = getUnidadRef(item);
            const linea = getLinea(item) || 'SIN LÍNEA';
            const factor = currentFactor;
            const esSuelta = factor === 1;

            const stockTotal = getCantidad(item);
            const stockCajas = esSuelta ? 0 : Math.floor(stockTotal / factor);
            const stockUnidades = esSuelta ? stockTotal : stockTotal % factor;

            let cajasPedido = parseInt(txtCajas.value) || 0;
            let unidadesPedido = parseInt(txtUnidades.value) || 0;
            if (cajasPedido === 0 && unidadesPedido === 0) {
                showToast('Ingrese una cantidad (cajas o unidades).', 'error');
                return;
            }

            let totalPedido = 0;
            if (esSuelta) {
                totalPedido = cajasPedido + unidadesPedido;
            } else {
                totalPedido = (cajasPedido * factor) + unidadesPedido;
            }

            if (totalPedido === 0) {
                showToast('Cantidad cero, no se agregará.', 'error');
                return;
            }

            if (totalPedido > stockTotal) {
                showToast(`Stock insuficiente. Disponible: ${stockCajas} cajas y ${stockUnidades} unidades sueltas.`, 'error');
                return;
            }

            let existing = pedido.find(p => p.codigo === codigo);
            if (existing) {
                let nuevasCajas = existing.cajas;
                let nuevasUnidades = existing.unidades;
                if (esSuelta) {
                    let total = (nuevasCajas + nuevasUnidades) + (cajasPedido + unidadesPedido);
                    nuevasCajas = 0;
                    nuevasUnidades = total;
                } else {
                    let total = (nuevasCajas * factor) + nuevasUnidades + (cajasPedido * factor) + unidadesPedido;
                    nuevasCajas = Math.floor(total / factor);
                    nuevasUnidades = total % factor;
                }
                let totalActualizado = (nuevasCajas * factor) + nuevasUnidades;
                if (totalActualizado > stockTotal) {
                    showToast(`No puedes agregar más de lo disponible. Stock: ${stockCajas} cajas y ${stockUnidades} unidades.`, 'error');
                    return;
                }
                existing.cajas = nuevasCajas;
                existing.unidades = nuevasUnidades;
            } else {
                let newCajas = 0, newUnidades = 0;
                if (esSuelta) {
                    newCajas = 0;
                    newUnidades = totalPedido;
                } else {
                    newCajas = Math.floor(totalPedido / factor);
                    newUnidades = totalPedido % factor;
                }
                pedido.push({
                    codigo: codigo,
                    codigoFabrica: codigoFabrica,
                    descripcion: descripcion,
                    unidad: unidad,
                    linea: linea,
                    cajas: newCajas,
                    unidades: newUnidades,
                    factor: factor,
                    esSuelta: esSuelta
                });
            }

            txtCajas.value = '0';
            txtUnidades.value = '0';
            renderPedido();
            savePedido();
            if (selectedIndex < filteredData.length) {
                actualizarCantidades(filteredData[selectedIndex]);
            }
            showToast(`✅ ${totalPedido} unidades agregadas al pedido.`, 'success');
        }

        function eliminarDelPedido(codigo) {
            pedido = pedido.filter(p => p.codigo !== codigo);
            renderPedido();
            savePedido();
        }

        function limpiarPedido() {
            if (pedido.length === 0) return;
            confirmarAccion('¿Eliminar todos los productos del pedido?').then(ok => {
                if (!ok) return;
                pedido = [];
                renderPedido();
                savePedido();
                showToast('Pedido vaciado.', 'info');
            });
        }

        function renderPedido() {
            // El tab/sección de "Sugerencia de Pedido" ya no existe en el HTML
            // actual (se removió del inventario). Estos elementos ya no están
            // en el DOM en la mayoría de instalaciones; sin este resguardo,
            // cualquier llamada a renderPedido() (por ejemplo al recargar con
            // un pedido guardado de una versión anterior en localStorage)
            // tumbaba con un TypeError el resto de la inicialización de la app.
            if (!pedidoBody || !pedidoMobileList || !pedidoFoot || !pedidoCount ||
                !totalCajasFoot || !totalUnidadesFoot || !totalCajasPedido || !totalUnidadesPedido) {
                return;
            }
            if (pedido.length === 0) {
                pedidoBody.innerHTML = `<tr><td colspan="8" class="empty-message">No hay productos en el pedido.</td></tr>`;
                pedidoMobileList.innerHTML = `<div class="empty-message">No hay productos en el pedido.</div>`;
                pedidoFoot.style.display = 'none';
                totalCajasPedido.textContent = '0';
                totalUnidadesPedido.textContent = '0';
                pedidoCount.textContent = '0 productos';
                collapseCardEnMovil('pedido');
                return;
            }

            let html = '';
            let mobileHtml = '';
            let totalCajas = 0, totalUnidades = 0;
            pedido.forEach((p, idx) => {
                totalCajas += p.cajas;
                totalUnidades += p.unidades;
                html += `<tr>
                    <td>${idx + 1}</td>
                    <td class="codigo-cell">${p.codigo}</td>
                    <td style="color:var(--text-muted);">${p.codigoFabrica}</td>
                    <td style="color:var(--text-secondary);">${p.descripcion}</td>
                    <td style="color:var(--text-muted);">${p.unidad}</td>
                    <td class="cantidad-cell">${p.cajas}</td>
                    <td class="cantidad-cell">${p.unidades}</td>
                    <td class="acciones-cell"><button class="eliminar-fila" data-codigo="${p.codigo}">✕</button></td>
                </tr>`;
                mobileHtml += `<div class="mi-card">
                    <div class="mi-card-head">
                        <div class="mi-card-idcol">
                            <div class="mi-card-idrow">
                                <span class="mi-card-num">#${idx + 1}</span>
                                <span class="mi-card-codigo">${p.codigo}</span>
                                ${p.codigoFabrica ? `<span class="mi-card-fabrica">(${p.codigoFabrica})</span>` : ''}
                            </div>
                            <div class="mi-card-desc">${p.descripcion}</div>
                        </div>
                        <button class="mi-card-del eliminar-fila-movil" data-codigo="${p.codigo}" title="Eliminar del pedido">🗑️</button>
                    </div>
                    <div class="mi-card-stats">
                        <div><span class="mi-stat-label">Unidad</span><span class="mi-stat-value">${p.unidad}</span></div>
                        <div><span class="mi-stat-label">Cajas</span><span class="mi-stat-value">${p.cajas}</span></div>
                        <div><span class="mi-stat-label">Unidades</span><span class="mi-stat-value">${p.unidades}</span></div>
                    </div>
                </div>`;
            });

            pedidoBody.innerHTML = html;
            pedidoMobileList.innerHTML = mobileHtml;
            pedidoFoot.style.display = 'table-row-group';
            totalCajasFoot.textContent = totalCajas;
            totalUnidadesFoot.textContent = totalUnidades;
            totalCajasPedido.textContent = totalCajas;
            totalUnidadesPedido.textContent = totalUnidades;
            pedidoCount.textContent = `${pedido.length} productos`;
            expandCardSiHaceFalta('pedido');

            document.querySelectorAll('.eliminar-fila, .eliminar-fila-movil').forEach(btn => {
                btn.addEventListener('click', function() {
                    const codigo = this.dataset.codigo;
                    eliminarDelPedido(codigo);
                });
            });
        }

        // ============================================================
        // PERSISTENCIA PEDIDO
        // ============================================================
        function savePedido() {
            try {
                localStorage.setItem('pedido_actual', JSON.stringify(pedido));
            } catch(e) {
                showToast('⚠️ No se pudo guardar el pedido en este dispositivo (almacenamiento lleno o bloqueado).', 'error');
            }
        }
        function loadPedido() {
            try {
                const raw = localStorage.getItem('pedido_actual');
                if (raw) { pedido = JSON.parse(raw); renderPedido(); }
            } catch(e) { pedido = []; }
        }

        // ============================================================
        // EXPORTAR PEDIDO
        // ============================================================
        function agruparPorLinea(items, getLineaItem) {
            const grupos = {};
            items.forEach(item => {
                const linea = getLineaItem(item) || 'SIN LÍNEA';
                if (!grupos[linea]) grupos[linea] = [];
                grupos[linea].push(item);
            });
            return Object.keys(grupos).sort((a, b) => a.localeCompare(b)).map(linea => ({
                linea: linea,
                items: grupos[linea]
            }));
        }

        async function exportarPedido() {
            try { await ensureXlsx(); } catch (eX) { showToast('No se pudo cargar Excel (XLSX).', 'error'); return; }
            if (!esAdmin()) {
                showToast('Solo el administrador puede descargar el Excel del pedido.', 'error');
                return;
            }
            if (pedido.length === 0) {
                showToast('No hay productos en el pedido.', 'error');
                return;
            }

            const grupos = agruparPorLinea(pedido, p => p.linea);
            const filas = [
                ['#', 'Código', 'Cód. Fábrica', 'Descripción', 'Unidad', 'Línea', 'Cajas', 'Unidades', 'Factor', 'Total (und)']
            ];

            grupos.forEach(grupo => {
                filas.push([`LÍNEA: ${grupo.linea}`]);
                let contador = 1;
                let subCajas = 0, subUnidades = 0;
                grupo.items.forEach(p => {
                    const total = (p.cajas * p.factor) + p.unidades;
                    filas.push([contador++, p.codigo, p.codigoFabrica, p.descripcion, p.unidad, p.linea, p.cajas, p.unidades, p.factor, total]);
                    subCajas += p.cajas;
                    subUnidades += p.unidades;
                });
                filas.push(['', '', '', '', '', 'Subtotal línea', subCajas, subUnidades, '', '']);
                filas.push([]);
            });

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(filas);
            ws['!cols'] = [{wch:6},{wch:10},{wch:14},{wch:42},{wch:10},{wch:24},{wch:8},{wch:10},{wch:8},{wch:12}];
            XLSX.utils.book_append_sheet(wb, ws, 'Pedido');
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/octet-stream' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `pedido_${new Date().toISOString().slice(0,10)}.xlsx`;
            link.click();
            URL.revokeObjectURL(link.href);
            showToast('📥 Pedido exportado a Excel.', 'success');
        }

        // ============================================================
        // GUARDAR PEDIDO EN DRIVE
        // ============================================================
        function guardarPedidoEnDrive() {
            if (pedido.length === 0) {
                showToast('No hay productos en el pedido.', 'error');
                return;
            }
            showToast('Use el botón Excel para descargar el pedido. Drive ya no es necesario con Supabase.', 'info');
        }

        // Avisa al servidor que un lote puntual (por su id) fue eliminado,
        // para que desaparezca también de la hoja "ConteoVivo" y, con eso,
        // de los demás celulares/PC en su próxima sincronización. Antes el
        // borrado solo pasaba en localStorage de este dispositivo, así que
        // el registro "eliminado" seguía existiendo en el servidor y
        // reaparecía en los demás.
        function eliminarLoteDelServidor(id) {
            if (!id) return;
            if (typeof esAdmin === 'function' && !esAdmin()) return;
            if (!supabaseClient) return;
            supabaseClient.from('lotes_conteo').delete().eq('id', id)
                .then(({ error }) => { if (error) console.warn('No se pudo borrar lote:', error); });
        }

        // ============================================================
        // CONTEO EN VIVO COMPARTIDO (varios celulares al mismo tiempo)
        // ============================================================
        // Envía un solo lote recién contado a la hoja "ConteoVivo" para que
        // los demás celulares lo vean en su próxima sincronización. No hace
        // falta leer la respuesta: si la red falla, el conteo local no se
        // pierde (queda guardado igual) y se puede reintentar más tarde.
        function normalizarVencimiento(v) {
            if (v === null || v === undefined) return '';
            return String(v).trim().toLowerCase();
        }

        // Mismo producto + misma fecha de vencimiento = mismo lote (se suma, no se duplica)
        function idLotePorProductoYVencimiento(codigo, vencimiento) {
            const venc = normalizarVencimiento(vencimiento) || 'sin_vencimiento';
            return String(codigo).trim() + '__' + venc.replace(/\s+/g, '_');
        }

        
        /**
         * Si el Excel Valorado BAJA el stock teórico, reduce lotes físicos
         * por FEFO (vence antes primero). Los AUMENTOS no crean lotes:
         * se registran solo con el conteo manual.
         * @returns {{ bajados: number, productos: number, detalle: string[] }}
         */
        function aplicarBajasLotesPorTeorico(cambiosStock) {
            // cambiosStock: [{ codigo, anterior, nuevo, descripcion? }]
            const resumen = { bajados: 0, productos: 0, detalle: [] };
            if (!Array.isArray(cambiosStock) || !cambiosStock.length) return resumen;
            if (typeof inventarioFisico === 'undefined' || !Array.isArray(inventarioFisico)) return resumen;

            cambiosStock.forEach(function (ch) {
                const codigo = String(ch.codigo || '').trim();
                const anterior = Number(ch.anterior);
                const nuevo = Number(ch.nuevo);
                if (!codigo || !isFinite(anterior) || !isFinite(nuevo)) return;
                if (nuevo >= anterior) return; // solo disminuciones
                let pendiente = anterior - nuevo;
                if (pendiente <= 0) return;

                const record = inventarioFisico.find(function (d) {
                    return String(d.codigo || '').trim() === codigo;
                });
                if (!record || !Array.isArray(record.lotes) || !record.lotes.length) {
                    // Sin conteo previo: no hay lotes que bajar
                    return;
                }

                // FEFO: fecha de vencimiento más cercana primero
                const ordenados = record.lotes.slice().sort(function (a, b) {
                    const da = typeof diasHastaVencimiento === 'function' ? diasHastaVencimiento(a.vencimiento) : null;
                    const db = typeof diasHastaVencimiento === 'function' ? diasHastaVencimiento(b.vencimiento) : null;
                    if (da === null && db === null) return 0;
                    if (da === null) return 1;
                    if (db === null) return -1;
                    return da - db;
                });

                const idsEliminar = [];
                let reducidoEnProducto = 0;
                ordenados.forEach(function (lote) {
                    if (pendiente <= 0) return;
                    const cant = Number(lote.cantidad) || 0;
                    if (cant <= 0) return;
                    const quita = Math.min(cant, pendiente);
                    lote.cantidad = cant - quita;
                    pendiente -= quita;
                    reducidoEnProducto += quita;
                    if (lote.cantidad <= 0) {
                        idsEliminar.push(lote.id);
                    }
                });

                if (reducidoEnProducto <= 0) return;

                // Quitar lotes en cero
                record.lotes = record.lotes.filter(function (l) {
                    return (Number(l.cantidad) || 0) > 0;
                });
                idsEliminar.forEach(function (id) {
                    if (typeof eliminarLoteDelServidor === 'function') eliminarLoteDelServidor(id);
                });

                record.stockTeorico = nuevo;
                record.stockFisico = record.lotes.reduce(function (s, l) {
                    return s + (Number(l.cantidad) || 0);
                }, 0);
                record.diferencia = record.stockFisico - record.stockTeorico;
                record.fecha = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString();
                try { record.fechaISO = new Date().toISOString(); } catch (e) {}

                // Subir lotes restantes
                (record.lotes || []).forEach(function (lote) {
                    if (typeof sincronizarLoteAlServidor === 'function') {
                        sincronizarLoteAlServidor(record, lote);
                    }
                });

                // Si ya no quedan lotes, se puede dejar el registro en 0 o eliminarlo
                if (!record.lotes.length) {
                    record.stockFisico = 0;
                    record.diferencia = 0 - record.stockTeorico;
                }

                resumen.bajados += reducidoEnProducto;
                resumen.productos += 1;
                if (resumen.detalle.length < 8) {
                    resumen.detalle.push(
                        codigo + ': −' + reducidoEnProducto + ' und en lotes (teórico ' + anterior + '→' + nuevo + ')'
                    );
                }
            });

            if (resumen.productos > 0) {
                try { if (typeof saveInventario === 'function') saveInventario(); } catch (e) {}
                try { if (typeof renderInventario === 'function') renderInventario(); } catch (e) {}
                try { if (typeof actualizarPanelAlertaVenc === 'function') actualizarPanelAlertaVenc(); } catch (e) {}
            }
            return resumen;
        }
        window.aplicarBajasLotesPorTeorico = aplicarBajasLotesPorTeorico;

        /**
         * Actualiza el stock teórico de todos los registros del conteo físico
         * con el valor actual del catálogo (currentData). Así, si alguien
         * actualiza el inventario (Excel valorado, Supabase, etc.) mientras
         * se está contando, el "Teórico" y la "Diferencia" del conteo se
         * refrescan en tiempo real (en el siguiente load del catálogo o al
         * llamar esta función).
         * @returns {{ actualizados: number }}
         */
        function sincronizarTeoricoDesdeCatalogo() {
            const resumen = { actualizados: 0 };
            if (!Array.isArray(inventarioFisico) || !inventarioFisico.length) return resumen;
            if (!Array.isArray(currentData) || !currentData.length) return resumen;
            if (typeof getCodigo !== 'function' || typeof getCantidad !== 'function') return resumen;

            // Índice rápido código → item del catálogo
            const mapa = Object.create(null);
            currentData.forEach(function (item) {
                const c = String(getCodigo(item) || '').trim();
                if (c) mapa[c] = item;
            });

            inventarioFisico.forEach(function (record) {
                const cod = String(record.codigo || '').trim();
                if (!cod) return;
                const item = mapa[cod];
                if (!item) return;
                const nuevo = Number(getCantidad(item));
                if (!isFinite(nuevo)) return;
                const anterior = Number(record.stockTeorico);
                if (isFinite(anterior) && anterior === nuevo) return;
                record.stockTeorico = nuevo;
                record.diferencia = (Number(record.stockFisico) || 0) - nuevo;
                resumen.actualizados += 1;
            });

            if (resumen.actualizados > 0) {
                try { if (typeof saveInventario === 'function') saveInventario(); } catch (e) {}
                try { if (typeof renderInventario === 'function') renderInventario(); } catch (e) {}
            }
            return resumen;
        }
        window.sincronizarTeoricoDesdeCatalogo = sincronizarTeoricoDesdeCatalogo;


        function sincronizarLoteAlServidor(record, lote) {
            const factor = record.factor || 1;
            const cajasLote = factor > 1 ? Math.floor(lote.cantidad / factor) : 0;
            const unidadesLote = factor > 1 ? (lote.cantidad % factor) : lote.cantidad;
            supabaseClient.from('lotes_conteo').upsert({
                id: lote.id,
                codigo: record.codigo,
                descripcion: record.descripcion,
                linea: record.linea || 'SIN LÍNEA',
                cantidad: lote.cantidad,
                cajas: cajasLote,
                unidades: unidadesLote,
                vencimiento: lote.vencimiento || null,
                fecha: lote.fecha || null,
                usuario: lote.usuario || usuarioActual || '',
                device_id: deviceId
            }).then(({ error }) => { if (error) console.warn('No se pudo subir lote:', error); });
        }

        // Une lotes del mismo producto con la misma fecha de vencimiento sumando cantidades.
        // Así varios dispositivos (o el mismo) no generan filas duplicadas en el reporte.
        function consolidarLotesDelRegistro(record) {
            if (!record || !Array.isArray(record.lotes)) return;
            const mapa = new Map();
            const idsAEliminar = [];
            record.lotes.forEach(l => {
                const key = normalizarVencimiento(l.vencimiento);
                const idCanonico = idLotePorProductoYVencimiento(record.codigo, l.vencimiento);
                if (!mapa.has(key)) {
                    const copia = Object.assign({}, l);
                    copia.id = idCanonico;
                    copia.cantidad = Number(copia.cantidad) || 0;
                    mapa.set(key, copia);
                    if (l.id && String(l.id) !== idCanonico) {
                        idsAEliminar.push(String(l.id));
                    }
                } else {
                    const acc = mapa.get(key);
                    acc.cantidad = (Number(acc.cantidad) || 0) + (Number(l.cantidad) || 0);
                    if (l.usuario && !acc.usuario) acc.usuario = l.usuario;
                    if (l.fecha) acc.fecha = l.fecha;
                    if (l.id && String(l.id) !== acc.id) {
                        idsAEliminar.push(String(l.id));
                    }
                }
            });
            record.lotes = Array.from(mapa.values());
            record.stockFisico = record.lotes.reduce((sum, l) => sum + (Number(l.cantidad) || 0), 0);
            record.diferencia = record.stockFisico - (Number(record.stockTeorico) || 0);
            // Limpia ids viejos duplicados en la nube (best-effort)
            idsAEliminar.forEach(id => {
                if (id) eliminarLoteDelServidor(id);
            });
        }

        // Combina un registro recibido del servidor con el inventario local.
        // Mismo código + misma fecha de vencimiento → se SUMA, no se duplica.
        function fusionarRegistroRemoto(r) {
            let record = inventarioFisico.find(d => d.codigo === r.codigo);
            if (!record) {
                record = {
                    codigo: r.codigo,
                    descripcion: r.descripcion,
                    linea: r.linea || 'SIN LÍNEA',
                    stockTeorico: 0,
                    stockFisico: 0,
                    diferencia: 0,
                    lotes: [],
                    fecha: r.fecha,
                    fechaISO: new Date().toISOString()
                };
                const item = currentData.find(it => getCodigo(it) === r.codigo);
                if (item) {
                    record.stockTeorico = getCantidad(item);
                    record.factor = getFactorFinal(item);
                }
                inventarioFisico.push(record);
            } else {
                // Registro ya existente: refrescar teórico desde el catálogo actual
                try {
                    const item = currentData.find(it => getCodigo(it) === r.codigo);
                    if (item && typeof getCantidad === 'function') {
                        const nuevo = Number(getCantidad(item));
                        if (isFinite(nuevo)) record.stockTeorico = nuevo;
                    }
                } catch (e) {}
            }

            const idCanonico = r.id || idLotePorProductoYVencimiento(r.codigo, r.vencimiento);
            const vencKey = normalizarVencimiento(r.vencimiento);
            let lote = record.lotes.find(l =>
                l.id === idCanonico || normalizarVencimiento(l.vencimiento) === vencKey
            );

            const cantidadRemota = Number(r.cantidad) || 0;
            if (!lote) {
                record.lotes.push({
                    id: idCanonico,
                    vencimiento: r.vencimiento,
                    cantidad: cantidadRemota,
                    fecha: r.fecha,
                    fechaISO: new Date().toISOString(),
                    usuario: r.usuario || ''
                });
            } else {
                // Si llega el mismo id, tomamos la cantidad del servidor (ya consolidada).
                // Si es otro id pero misma fecha, sumamos solo si aún no estaba ese id.
                if (lote.id === r.id || lote.id === idCanonico) {
                    lote.cantidad = cantidadRemota;
                } else {
                    // Evitar doble suma en cada poll: guardamos ids fusionados
                    if (!lote._idsFusionados) lote._idsFusionados = new Set([String(lote.id)]);
                    const rid = String(r.id || idCanonico);
                    if (!lote._idsFusionados.has(rid)) {
                        lote.cantidad = (Number(lote.cantidad) || 0) + cantidadRemota;
                        lote._idsFusionados.add(rid);
                    } else {
                        // Ya integrado; si el servidor trae total canónico con id fijo, preferir mayor
                        lote.cantidad = Math.max(Number(lote.cantidad) || 0, cantidadRemota);
                    }
                }
                lote.id = idCanonico;
                lote.vencimiento = r.vencimiento;
                if (r.usuario) lote.usuario = r.usuario;
                if (r.fecha) lote.fecha = r.fecha;
            }

            consolidarLotesDelRegistro(record);
        }

        // El servidor (obtenerLotes en el Apps Script) manda SIEMPRE la
        // hoja "ConteoVivo" completa, no solo lo nuevo. Aprovechamos eso
        // para borrar localmente cualquier lote que ya no esté en esa
        // lista (por ejemplo, porque otro celular lo eliminó): si un lote
        // tiene id (ya se sincronizó alguna vez) y ese id ya no aparece en
        // la lista del servidor, se quita de aquí también. Los lotes sin
        // id (registros viejos, previos a esta sincronización) se dejan
        // intactos porque nunca llegaron a viajar al servidor.
        function quitarLotesBorradosEnServidor(registros) {
            const idsServidor = new Set(registros.map(r => String(r.id)));
            let huboCambios = false;
            inventarioFisico = inventarioFisico.filter(record => {
                const lotesAntes = record.lotes.length;
                record.lotes = record.lotes.filter(l => !l.id || idsServidor.has(String(l.id)));
                if (record.lotes.length !== lotesAntes) huboCambios = true;
                if (record.lotes.length === 0) return false;
                record.stockFisico = record.lotes.reduce((sum, l) => sum + l.cantidad, 0);
                record.diferencia = record.stockFisico - record.stockTeorico;
                return true;
            });
            return huboCambios;
        }

        // Consulta la hoja "ConteoVivo" y trae lo que hayan contado otros
        // celulares desde la última vez. Se llama sola cada 10 segundos.
        function conteoLocalLimpioTrasEnvio() {
            try {
                var v = localStorage.getItem('iem_conteo_limpio_tras_envio');
                if (!v) return false;
                // Válido hasta medianoche del día siguiente (conteo del día cerrado)
                var ts = Number(v) || 0;
                if (!ts) return false;
                var ahora = Date.now();
                // 18 horas: evita que el sync vuelva a llenar el listado tras enviar
                return (ahora - ts) < (18 * 60 * 60 * 1000);
            } catch (e) { return false; }
        }
        function marcarConteoLimpioTrasEnvio() {
            try { localStorage.setItem('iem_conteo_limpio_tras_envio', String(Date.now())); } catch (e) {}
        }
        function quitarMarcaConteoLimpio() {
            try { localStorage.removeItem('iem_conteo_limpio_tras_envio'); } catch (e) {}
        }

        async function sincronizarDesdeServidor() {
            if (sincronizando) return;
            // Tras "Enviar y limpiar", no volver a traer lotes de la nube a este dispositivo
            if (conteoLocalLimpioTrasEnvio() && (!inventarioFisico || inventarioFisico.length === 0)) {
                return;
            }
            sincronizando = true;
            try {
                // Paginar por si hay más de ~1000 lotes de conteo
                const PAGE = 1000;
                let all = [];
                let from = 0;
                for (;;) {
                    const { data, error } = await supabaseClient
                        .from('lotes_conteo')
                        .select('*')
                        .order('creado_en', { ascending: true })
                        .range(from, from + PAGE - 1);
                    if (error) throw error;
                    if (!data || !data.length) break;
                    all = all.concat(data);
                    if (data.length < PAGE) break;
                    from += PAGE;
                    if (from >= 50000) break;
                }
                const registros = all.map(r => ({
                    id: r.id, codigo: r.codigo, descripcion: r.descripcion, linea: r.linea,
                    cantidad: r.cantidad, vencimiento: r.vencimiento, fecha: r.fecha, usuario: r.usuario || ''
                }));
                registros.forEach(fusionarRegistroRemoto);
                inventarioFisico.forEach(consolidarLotesDelRegistro);
                const huboBorrados = quitarLotesBorradosEnServidor(registros);
                if (registros.length === 0 && !huboBorrados && inventarioFisico.length === 0) return;
                saveInventario();
                renderInventario();
            } catch (e) { /* sin red */ }
            finally { sincronizando = false; }
        }

        // ============================================================
        // REGISTRAR INVENTARIO FÍSICO
        // ============================================================
        // Muestra una cantidad total (siempre guardada en unidades sueltas,
        // aunque el usuario haya escrito todo en el campo "Unidades") como
        // "cajas + unidades sueltas", usando el factor de empaque del
        // producto. Así, aunque se conteo todo suelto, la tabla de
        // Inventario Físico lo agrupa igual que si se hubiera ingresado en
        // cajas.
        function formatCajasUnidades(cantidad, factor) {
            const total = Number(cantidad) || 0;
            if (!factor || factor <= 1) return `${total} und`;
            const cajas = Math.floor(total / factor);
            const unidades = total % factor;
            if (cajas === 0) return `${unidades} und`;
            if (unidades === 0) return `${cajas} cj`;
            return `${cajas} cj + ${unidades} und`;
        }

        // Devuelve el factor de empaque a usar para un registro de
        // inventario físico: el que se guardó al registrarlo, o si no
        // existe (registros antiguos o sincronizados de otro celular),
        // lo busca en los datos del producto.
        function factorDeRegistro(d) {
            if (typeof d.factor === 'number' && d.factor > 0) return d.factor;
            const item = currentData.find(it => getCodigo(it) === d.codigo);
            return item ? getFactorFinal(item) : 1;
        }

        // Lista de usuarios distintos que contaron este producto (puede
        // venir de más de un celular). Sirve para detectar en la tabla si
        // el mismo producto fue contado dos veces por error, desde
        // dispositivos con usuarios distintos.
        function usuariosDeRegistro(d) {
            const lotes = d.lotes || [];
            return [...new Set(lotes.map(l => l.usuario).filter(u => u))];
        }

        function registrarFisico() {
            if (selectedIndex === -1 || selectedIndex >= filteredData.length) {
                showToast('Seleccione un producto de la lista.', 'error');
                return;
            }
            // Nuevo conteo del día: permitir sync de nuevo
            quitarMarcaConteoLimpio();
            normalizarUnidadesACajas();
            const item = filteredData[selectedIndex];
            const codigo = getCodigo(item);
            const descripcion = getDescripcion(item);
            const linea = getLinea(item) || 'SIN LÍNEA';
            const stockTeorico = getCantidad(item);
            const factor = currentFactor;
            const esSuelta = factor === 1;

            let cajas = parseInt(txtCajas.value) || 0;
            let unidades = parseInt(txtUnidades.value) || 0;

            if (esSuelta) {
                unidades += cajas;
                cajas = 0;
            }

            // Cantidad de este lote (no el total del producto): se suma a lo
            // que ya se hubiera registrado antes para el mismo código, cada
            // porción con su propia fecha de vencimiento.
            const cantidadLote = (cajas * factor) + unidades;

            if (cantidadLote === 0) {
                showToast('Ingrese una cantidad mayor que cero.', 'error');
                return;
            }

            const ahora = new Date();
            const fechaStr = ahora.toLocaleDateString() + ' ' + ahora.toLocaleTimeString();
            const vencimiento = obtenerVencimientoSeleccionado();

            // Busca si el producto ya tiene un registro (de otro lote/fecha) y
            // acumula ahí en vez de crear una fila aparte.
            let record = inventarioFisico.find(d => d.codigo === codigo);
            if (!record) {
                record = {
                    codigo: codigo,
                    descripcion: descripcion,
                    linea: linea,
                    stockTeorico: stockTeorico,
                    stockFisico: 0,
                    diferencia: 0,
                    factor: factor,
                    lotes: [],
                    fecha: fechaStr,
                    fechaISO: ahora.toISOString()
                };
                inventarioFisico.push(record);
            }
            record.factor = factor;

            const idCanonico = idLotePorProductoYVencimiento(codigo, vencimiento);
            const vencKey = normalizarVencimiento(vencimiento);
            let loteParaSync;

            // Modo edición (lápiz): reemplaza todos los lotes por este conteo
            if (iemModoEdicion) {
                try {
                    (record.lotes || []).forEach(function (l) {
                        if (l && l.id && typeof eliminarLoteDelServidor === 'function') {
                            eliminarLoteDelServidor(l.id);
                        }
                    });
                } catch (eDel) {}
                record.lotes = [];
                loteParaSync = {
                    id: idCanonico,
                    vencimiento: vencimiento,
                    cantidad: cantidadLote,
                    fecha: fechaStr,
                    fechaISO: ahora.toISOString(),
                    usuario: usuarioActual || ''
                };
                record.lotes.push(loteParaSync);
                iemModoEdicion = false;
                try {
                    var btnG2 = document.getElementById('btnRegistrarFisico');
                    if (btnG2 && btnG2.dataset.editLabel) {
                        btnG2.innerHTML = btnG2.dataset.editLabel;
                        delete btnG2.dataset.editLabel;
                    }
                } catch (eB2) {}
            } else {
                let loteExistente = record.lotes.find(l =>
                    l.id === idCanonico || normalizarVencimiento(l.vencimiento) === vencKey
                );
                if (loteExistente) {
                    // Mismo producto + misma fecha → SUMAR, no crear otra fila
                    loteExistente.cantidad = (Number(loteExistente.cantidad) || 0) + cantidadLote;
                    loteExistente.id = idCanonico;
                    loteExistente.fecha = fechaStr;
                    loteExistente.fechaISO = ahora.toISOString();
                    loteExistente.usuario = usuarioActual || loteExistente.usuario || '';
                    loteExistente.vencimiento = vencimiento;
                    loteParaSync = loteExistente;
                } else {
                    loteParaSync = {
                        id: idCanonico,
                        vencimiento: vencimiento,
                        cantidad: cantidadLote,
                        fecha: fechaStr,
                        fechaISO: ahora.toISOString(),
                        usuario: usuarioActual || ''
                    };
                    record.lotes.push(loteParaSync);
                }
            }

            record.stockTeorico = stockTeorico;
            record.stockFisico = record.lotes.reduce((sum, l) => sum + (Number(l.cantidad) || 0), 0);
            record.diferencia = record.stockFisico - record.stockTeorico;
            record.fecha = fechaStr;
            record.fechaISO = ahora.toISOString();

            // Comparte el total consolidado con los demás dispositivos
            sincronizarLoteAlServidor(record, loteParaSync);

            saveInventario();
            renderInventario();
            txtCajas.value = '0';
            txtUnidades.value = '0';
            const totalLotes = record.lotes.length;
            const msgLote = totalLotes > 1 ? ` (${totalLotes} fechas, total físico ${record.stockFisico})` : ` (total físico ${record.stockFisico})`;
            showToast((loteParaSync && record.lotes.length === 1 && msgLote.indexOf('fechas') < 0 ? '✅ Conteo actualizado: ' : '✅ +') + cantidadLote + ' (vence ' + (vencimiento || 's/f') + ')' + msgLote + '. Dif: ' + record.diferencia, 'success');
            // Vuelve a la lista de resultados para seguir contando el
            // siguiente producto, en vez de quedarse en el mismo.
            volverABuscar();
        }

        // ============================================================
        // PERSISTENCIA INVENTARIO
        // ============================================================
        const INV_KEY = 'buscador_inventario_fisico';

        function saveInventario() {
            try {
                localStorage.setItem(INV_KEY, JSON.stringify(inventarioFisico));
            } catch(e) {
                showToast('⚠️ No se pudo guardar el inventario físico en este dispositivo (almacenamiento lleno o bloqueado).', 'error');
            }
        }
        function loadInventario() {
            try {
                const raw = localStorage.getItem(INV_KEY);
                if (raw) {
                    inventarioFisico = JSON.parse(raw);
                    // Migración: registros guardados antes de tener "lotes" (una
                    // sola fecha de vencimiento por fila) se convierten al nuevo
                    // formato de lista de lotes para que sigan funcionando igual.
                    inventarioFisico.forEach(d => {
                        if (!d.lotes) {
                            d.lotes = [{
                                vencimiento: d.vencimiento || null,
                                cantidad: d.stockFisico,
                                fecha: d.fecha,
                                fechaISO: d.fechaISO || null
                            }];
                        }
                    });
                }
            } catch(e) { inventarioFisico = []; }
        }

        // ============================================================
        // RENDER INVENTARIO
        // ============================================================
        
        // ---- Vencimiento / diferencia (v4.2.2) — sin tocar estilos base ----
        const DIAS_ALERTA_VENC = 15;
        let filtroDiffModo = 'todos';
        try {
            const f = localStorage.getItem('iem_filtro_diff');
            if (f && ['todos','diff','bajaron','subieron','por_vencer'].indexOf(f) >= 0) filtroDiffModo = f;
        } catch (e) {}

        function parseFechaVencimiento(v) {
            if (v === null || v === undefined) return null;
            const s = String(v).trim();
            if (!s || /^s\/f$/i.test(s) || s.toLowerCase() === 'sin_vencimiento') return null;
            let m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
            if (m) {
                const d = +m[1], mo = +m[2] - 1, y = +m[3];
                const dt = new Date(y, mo, d);
                if (dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d) return dt;
            }
            m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
            if (m) {
                const y = +m[1], mo = +m[2] - 1, d = +m[3];
                const dt = new Date(y, mo, d);
                if (dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d) return dt;
            }
            return null;
        }
        function diasHastaVencimiento(v) {
            const dt = parseFechaVencimiento(v);
            if (!dt) return null;
            const hoy = new Date(); hoy.setHours(0,0,0,0); dt.setHours(0,0,0,0);
            return Math.round((dt - hoy) / 86400000);
        }
        function lotePorVencer(lote, limite) {
            const dias = diasHastaVencimiento(lote && lote.vencimiento);
            return dias !== null && dias <= (limite == null ? DIAS_ALERTA_VENC : limite);
        }
        function productoTieneLotePorVencer(record, limite) {
            return ((record && record.lotes) || []).some(l => lotePorVencer(l, limite));
        }
        function productoPasaFiltroDiff(d) {
            const dif = Number(d.diferencia) || 0;
            if (filtroDiffModo === 'diff') return dif !== 0;
            if (filtroDiffModo === 'bajaron') return dif < 0;
            if (filtroDiffModo === 'subieron') return dif > 0;
            if (filtroDiffModo === 'por_vencer') return productoTieneLotePorVencer(d, DIAS_ALERTA_VENC);
            return true;
        }
        function resumenFiltroDiff() {
            let nDiff = 0, nBajo = 0, nSube = 0;
            (inventarioFisico || []).forEach(d => {
                const dif = Number(d.diferencia) || 0;
                if (dif !== 0) nDiff++;
                if (dif < 0) nBajo++;
                if (dif > 0) nSube++;
            });
            return { total: (inventarioFisico || []).length, nDiff, nBajo, nSube };
        }
        function obtenerAlertasPorVencer(limite) {
            const lim = limite == null ? DIAS_ALERTA_VENC : limite;
            const out = [];
            (inventarioFisico || []).forEach(rec => {
                (rec.lotes || []).forEach(l => {
                    const dias = diasHastaVencimiento(l.vencimiento);
                    if (dias === null || dias > lim) return;
                    out.push({
                        codigo: rec.codigo, descripcion: rec.descripcion || '',
                        vencimiento: l.vencimiento || '', cantidad: Number(l.cantidad) || 0,
                        dias, vencido: dias < 0
                    });
                });
            });
            out.sort((a, b) => a.dias - b.dias);
            return out;
        }
        function actualizarPanelAlertaVenc() {
            const btn = document.getElementById('btnAlertaVenc');
            const countEl = document.getElementById('alertaVencCount');
            const dot = document.getElementById('alertaVencDot');
            const lista = document.getElementById('listaAlertaVenc');
            const fab = document.getElementById('fabAlertaVenc');
            const fabCount = document.getElementById('fabAlertaCount');
            const alertas = (typeof obtenerAlertasPorVencer === 'function')
                ? obtenerAlertasPorVencer(DIAS_ALERTA_VENC)
                : [];
            const n = alertas.length;
            const hayCritico = alertas.some(function (a) { return a.vencido || a.dias <= 7; });
            const esAdm = (typeof esAdmin === 'function') ? esAdmin() : false;

            function syncFab() {
                if (!fab) return;
                if (!esAdm) { fab.hidden = true; return; }
                if (n > 0) {
                    fab.hidden = false;
                    fab.classList.toggle('fab-ok', false);
                    if (fabCount) fabCount.textContent = String(n);
                } else {
                    fab.hidden = true; // solo flotante si hay alertas
                }
            }

            // Botón de alerta del header: siempre oculto (solo se usa el FAB flotante).
            if (btn) {
                btn.hidden = true;
                btn.style.display = 'none';
                btn.setAttribute('aria-hidden', 'true');
                if (countEl) countEl.textContent = String(n);
                if (dot) dot.hidden = true;
            }
            if (lista) {
                if (!n) {
                    lista.innerHTML = '<li class="alerta-item alerta-item-ok">Todo en orden · sin vencimientos ≤ ' + DIAS_ALERTA_VENC + ' días</li>';
                } else {
                    lista.innerHTML = alertas.map(function (a) {
                        const label = a.vencido ? ('Vencido hace ' + Math.abs(a.dias) + ' d') : (a.dias === 0 ? 'Vence hoy' : ('En ' + a.dias + ' d'));
                        const cls = (a.vencido || a.dias <= 7) ? 'alerta-item-critico' : 'alerta-item-warn';
                        const esc = function (s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
                        return '<li class="alerta-item ' + cls + '"><div class="alerta-item-top"><span class="alerta-item-cod">' + esc(a.codigo) +
                            '</span><span class="alerta-item-dias">' + label + '</span></div><div class="alerta-item-desc">' + esc(a.descripcion) +
                            '</div><div class="alerta-item-meta">📅 ' + esc(a.vencimiento) + ' · ' + a.cantidad + ' und</div></li>';
                    }).join('');
                }
            }
            syncFab();
        }

        let adminVencDiasModo = '15';
        let adminVencCache = [];
        function adminVencPasaFiltro(row) {
            const q = ((document.getElementById('adminVencFiltro') || {}).value || '').trim().toLowerCase();
            if (q) {
                const blob = ((row.codigo || '') + ' ' + (row.descripcion || '')).toLowerCase();
                if (blob.indexOf(q) < 0) return false;
            }
            if (row.dias == null) return false;
            if (adminVencDiasModo === 'vencidos') return row.dias < 0;
            if (adminVencDiasModo === 'todos') return true;
            return row.dias <= (parseInt(adminVencDiasModo, 10) || 15);
        }
        function renderAdminVencimientos() {
            const body = document.getElementById('adminVencBody');
            const mobile = document.getElementById('adminVencMobile');
            const countEl = document.getElementById('adminVencCount');
            const statusEl = document.getElementById('adminVencStatus');
            if (!body) return;
            document.querySelectorAll('[data-admin-venc-dias]').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-admin-venc-dias') === adminVencDiasModo);
            });
            const rows = adminVencCache.filter(adminVencPasaFiltro);
            if (countEl) countEl.textContent = String(rows.length);
            if (!rows.length) {
                body.innerHTML = '<tr><td colspan="8" class="empty-message">No hay lotes en este filtro.</td></tr>';
                if (mobile) mobile.innerHTML = '<div class="empty-message">No hay lotes en este filtro.</div>';
                if (statusEl) statusEl.textContent = adminVencCache.length ? 'Sin coincidencias.' : 'Sin lotes con fecha.';
                return;
            }
            if (statusEl) {
                const crit = rows.filter(r => r.dias < 0).length;
                const pronto = rows.filter(r => r.dias >= 0 && r.dias <= 7).length;
                statusEl.textContent = rows.length + ' lote(s)' + (crit ? ' · ' + crit + ' vencido(s)' : '') + (pronto ? ' · ' + pronto + ' ≤7d' : '');
            }
            const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            let html = '', mob = '';
            rows.forEach((r, i) => {
                const label = r.dias < 0 ? ('Vencido ' + Math.abs(r.dias) + ' d') : (r.dias === 0 ? 'Hoy' : (r.dias + ' d'));
                const cls = (r.dias < 0 || r.dias <= 7) ? 'diff-negativo' : '';
                html += '<tr class="' + (r.dias <= 7 ? 'row-bajo' : '') + '"><td>' + (i+1) + '</td><td class="codigo-cell">' +
                    (r.dias <= 15 ? '<span class="dot-venc' + (r.dias < 0 ? ' dot-venc-critico' : '') + '">●</span>' : '') + esc(r.codigo) +
                    '</td><td style="color:var(--text-secondary)">' + esc(r.descripcion) + '</td><td>' + esc(r.vencimiento||'-') +
                    '</td><td class="' + cls + '"><strong>' + label + '</strong></td><td>' + (r.cantidad != null ? r.cantidad : '-') +
                    '</td><td style="color:var(--text-muted)">' + esc(r.usuario||'-') + '</td><td style="color:var(--text-muted);font-size:0.72rem">' + esc(r.fecha||'-') + '</td></tr>';
                mob += '<div class="mi-card ' + (r.dias <= 7 ? 'mi-card-bajo' : '') + '"><div class="mi-card-head"><div class="mi-card-idcol"><div class="mi-card-idrow"><span class="mi-card-codigo">' +
                    esc(r.codigo) + '</span><span class="diff-badge diff-badge-bajo">' + label + '</span></div><div class="mi-card-desc">' + esc(r.descripcion) +
                    '</div></div></div><div class="mi-card-meta"><span>📅 ' + esc(r.vencimiento||'') + '</span><span>' + (r.cantidad!=null?r.cantidad+' und':'') +
                    '</span><span>👤 ' + esc(r.usuario||'-') + '</span></div></div>';
            });
            body.innerHTML = html;
            if (mobile) mobile.innerHTML = mob;
        }
        async function cargarAdminVencimientos() {
            const statusEl = document.getElementById('adminVencStatus');
            const body = document.getElementById('adminVencBody');
            if (statusEl) statusEl.textContent = 'Cargando lotes…';
            if (body) body.innerHTML = '<tr><td colspan="8" class="empty-message">Cargando…</td></tr>';
            const map = new Map();
            function addRow(r) {
                const venc = r.vencimiento;
                const dias = diasHastaVencimiento(venc);
                if (dias === null) return;
                const id = String(r.codigo||'') + '__' + (typeof normalizarVencimiento === 'function' ? normalizarVencimiento(venc) : String(venc||'').toLowerCase());
                const prev = map.get(id);
                const cant = Number(r.cantidad) || 0;
                if (prev) {
                    prev.cantidad += cant;
                    if (r.fecha && (!prev.fecha || String(r.fecha) > String(prev.fecha))) prev.fecha = r.fecha;
                    if (r.usuario) prev.usuario = r.usuario;
                } else {
                    map.set(id, { codigo: r.codigo||'', descripcion: r.descripcion||'', vencimiento: venc||'', cantidad: cant, usuario: r.usuario||'', fecha: r.fecha||'', dias, vencido: dias < 0 });
                }
            }
            try {
                (inventarioFisico||[]).forEach(rec => (rec.lotes||[]).forEach(l => addRow({ codigo: rec.codigo, descripcion: rec.descripcion, vencimiento: l.vencimiento, cantidad: l.cantidad, usuario: l.usuario, fecha: l.fecha })));
            } catch(e) {}
            try {
                let from = 0;
                for (;;) {
                    const { data, error } = await supabaseClient.from('lotes_conteo').select('codigo,descripcion,cantidad,vencimiento,fecha,usuario').not('vencimiento','is',null).order('codigo',{ascending:true}).range(from, from+999);
                    if (error) throw error;
                    if (!data || !data.length) break;
                    data.forEach(addRow);
                    if (data.length < 1000) break;
                    from += 1000;
                    if (from >= 30000) break;
                }
            } catch (e) {
                console.warn(e);
                if (statusEl && !map.size) statusEl.textContent = 'No se pudo leer la nube: ' + (e.message||e);
            }
            adminVencCache = Array.from(map.values()).sort((a,b)=>a.dias-b.dias);
            renderAdminVencimientos();
        }
        window.cargarAdminVencimientos = cargarAdminVencimientos;


        function renderInventario() {
            // Antes de pintar: alinear teórico del conteo con el catálogo actual
            // (sin forzar save/render recursivo; solo actualiza en memoria).
            try {
                if (Array.isArray(inventarioFisico) && inventarioFisico.length
                    && Array.isArray(currentData) && currentData.length
                    && typeof getCodigo === 'function' && typeof getCantidad === 'function') {
                    const mapa = Object.create(null);
                    currentData.forEach(function (item) {
                        const c = String(getCodigo(item) || '').trim();
                        if (c) mapa[c] = item;
                    });
                    let huboCambioTeorico = false;
                    inventarioFisico.forEach(function (record) {
                        const cod = String(record.codigo || '').trim();
                        if (!cod || !mapa[cod]) return;
                        const nuevo = Number(getCantidad(mapa[cod]));
                        if (!isFinite(nuevo)) return;
                        if (Number(record.stockTeorico) !== nuevo) {
                            record.stockTeorico = nuevo;
                            record.diferencia = (Number(record.stockFisico) || 0) - nuevo;
                            huboCambioTeorico = true;
                        }
                    });
                    if (huboCambioTeorico) {
                        try { if (typeof saveInventario === 'function') saveInventario(); } catch (e) {}
                    }
                }
            } catch (eTeo) { /* no bloquear el render */ }

            document.querySelectorAll('.diff-filtro-btn[data-diff-filtro]').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-diff-filtro') === filtroDiffModo);
            });
            const stats = resumenFiltroDiff();
            const statsEl = document.getElementById('diffFiltroStats');
            if (statsEl) statsEl.textContent = stats.total ? (stats.nBajo + '↓  ' + stats.nSube + '↑  ' + stats.nDiff + '≠') : '';

            if (inventarioFisico.length === 0) {
                diffBody.innerHTML = `<tr><td colspan="10" class="empty-message">No hay productos contados aún.</td></tr>`;
                diffMobileList.innerHTML = `<div class="empty-message">No hay productos contados aún.</div>`;
                diffFoot.style.display = 'none';
                diffResumen.style.display = 'none';
                diffCount.textContent = '0 registros';
                resContados.textContent = '0';
                try { actualizarPanelAlertaVenc(); } catch (e) {}
                collapseCardEnMovil('diff');
                return;
            }

            const lista = inventarioFisico.map((d, idx) => ({ d, idx })).filter(x => productoPasaFiltroDiff(x.d));
            if (lista.length === 0) {
                const msg = filtroDiffModo === 'bajaron' ? 'Ningún producto disminuyó.'
                    : filtroDiffModo === 'subieron' ? 'Ningún producto aumentó.'
                    : filtroDiffModo === 'diff' ? 'Todos cuadran: sin diferencias.'
                    : filtroDiffModo === 'por_vencer' ? 'No hay lotes por vencer en ≤ 15 días.'
                    : 'No hay productos contados aún.';
                diffBody.innerHTML = `<tr><td colspan="10" class="empty-message">${msg}</td></tr>`;
                diffMobileList.innerHTML = `<div class="empty-message">${msg}</div>`;
                diffFoot.style.display = 'none';
                diffResumen.style.display = 'flex';
                resContados.textContent = String(inventarioFisico.length);
                diffCount.textContent = `0 / ${inventarioFisico.length}`;
                try { actualizarPanelAlertaVenc(); } catch (e) {}
                return;
            }

            let html = '';
            let mobileHtml = '';
            let totalTeorico = 0, totalFisico = 0, totalDiff = 0;
            lista.forEach(({ d, idx }, n) => {
                totalTeorico += d.stockTeorico;
                totalFisico += d.stockFisico;
                totalDiff += d.diferencia;
                const claseDiff = d.diferencia > 0 ? 'diff-positivo' : (d.diferencia < 0 ? 'diff-negativo' : 'diff-cero');
                const lotes = d.lotes || [];
                const vencTitulo = lotes.map(l => `${l.vencimiento || 'S/F'}: ${l.cantidad} und`).join(' | ') || '-';
                const vencTexto = lotes.length === 0 ? (d.vencimiento || '-')
                    : lotes.length === 1 ? `${lotes[0].vencimiento || 'S/F'} (${lotes[0].cantidad})`
                    : lotes.map(l => `${l.vencimiento || 'S/F'}:${l.cantidad}`).join(' · ');
                const badgeDiff = d.diferencia < 0
                    ? `<span class="diff-badge diff-badge-bajo">↓ ${d.diferencia}</span>`
                    : d.diferencia > 0
                    ? `<span class="diff-badge diff-badge-sube">↑ +${d.diferencia}</span>`
                    : `<span class="diff-badge diff-badge-ok">= 0</span>`;
                const porVencer = productoTieneLotePorVencer(d, DIAS_ALERTA_VENC);
                let minDiasVenc = null;
                lotes.forEach(l => {
                    const di = diasHastaVencimiento(l.vencimiento);
                    if (di === null) return;
                    if (minDiasVenc === null || di < minDiasVenc) minDiasVenc = di;
                });
                const badgeVenc = porVencer
                    ? (minDiasVenc !== null && minDiasVenc < 0
                        ? '<span class="dot-venc dot-venc-critico" title="Lote vencido">●</span>'
                        : '<span class="dot-venc" title="Por vencer ≤ 15 días">●</span>')
                    : '';
                // Aunque el conteo se haya ingresado todo en el campo de
                // unidades sueltas, aquí se agrupa en cajas + unidades
                // sueltas según el factor de empaque del producto.
                const factorReg = factorDeRegistro(d);
                const teoricoTexto = formatCajasUnidades(d.stockTeorico, factorReg);
                const fisicoTexto = formatCajasUnidades(d.stockFisico, factorReg);
                // Si el mismo producto tiene lotes de más de un usuario, es
                // probable que dos celulares lo hayan contado por separado
                // (duplicado). Se marca con ⚠️ para que se note a simple
                // vista, con el detalle de cada lote y su usuario al pasar
                // el cursor (o al mantener presionado en el celular).
                const usuarios = usuariosDeRegistro(d);
                const usuarioTexto = usuarios.length ? usuarios.join(', ') : '-';
                const usuarioDuplicado = usuarios.length > 1;
                const usuarioTitulo = lotes.map(l => `${l.usuario || 'S/U'}: ${l.cantidad} (${l.fecha || ''})`).join(' | ');
                const usuarioColor = usuarioDuplicado ? 'var(--danger)' : 'var(--text-muted)';
                const usuarioCelda = `${usuarioDuplicado ? '⚠️ ' : ''}${usuarioTexto}`;
                html += `<tr>
                    <td>${n + 1}</td>
                    <td class="codigo-cell">${badgeVenc}${d.codigo}</td>
                    <td style="color:var(--text-secondary);">${d.descripcion}</td>
                    <td style="color:var(--heading-color);" title="${d.stockTeorico} und">${teoricoTexto}</td>
                    <td style="color:var(--heading-color);" title="${d.stockFisico} und">${fisicoTexto}</td>
                    <td class="${claseDiff}">${badgeDiff}</td>
                    <td style="color:var(--heading-color);" title="${vencTitulo}">${vencTexto}</td>
                    <td style="color:var(--text-muted);">${d.fecha}</td>
                    <td style="color:${usuarioColor}; font-weight:${usuarioDuplicado ? '700' : '400'};" title="${usuarioTitulo}">${usuarioCelda}</td>
                    <td class="acciones-cell"><button type="button" class="btn-edit-diff editar-diff" data-index="${idx}" title="Editar">✏️</button><button class="eliminar-diff" data-index="${idx}" title="Eliminar">✕</button></td>
                </tr>`;
                mobileHtml += `<div class="mi-card">
                    <div class="mi-card-head">
                        <div class="mi-card-idcol">
                            <div class="mi-card-idrow">
                                <span class="mi-card-num">#${n + 1}</span>
                                <span class="mi-card-codigo">${badgeVenc}${d.codigo}</span>
                                ${badgeDiff}
                            </div>
                            <div class="mi-card-desc">${d.descripcion}</div>
                        </div>
                        <div class="mi-card-actions">
                            <button type="button" class="mi-card-edit editar-diff-movil" data-index="${idx}" title="Editar fecha o cantidad">✏️</button>
                            <button type="button" class="mi-card-del eliminar-diff-movil" data-index="${idx}" title="Eliminar registro">🗑️</button>
                        </div>
                    </div>
                    <div class="mi-card-stats">
                        <div><span class="mi-stat-label">Teórico</span><span class="mi-stat-value">${teoricoTexto}</span></div>
                        <div><span class="mi-stat-label">Físico</span><span class="mi-stat-value">${fisicoTexto}</span></div>
                        <div><span class="mi-stat-label">Diferencia</span><span class="mi-stat-value ${claseDiff}">${d.diferencia}</span></div>
                    </div>
                    ${(lotes.length ? `<div class="mi-lotes">${lotes.map(l => `<span class="mi-lote-chip">${l.vencimiento || 'S/F'} · ${l.cantidad}</span>`).join('')}</div>` : '')}
                    <div class="mi-card-meta">
                        <span title="${vencTitulo}">📅 ${lotes.length} lote(s)</span>
                        <span>🕒 ${d.fecha}</span>
                        <span style="color:${usuarioColor}; font-weight:${usuarioDuplicado ? '700' : '400'};" title="${usuarioTitulo}">👤 ${usuarioCelda}</span>
                    </div>
                </div>`;
            });

            diffBody.innerHTML = html;
            diffMobileList.innerHTML = mobileHtml;
            diffFoot.style.display = 'table-row-group';
            diffTotalTeorico.textContent = totalTeorico;
            diffTotalFisico.textContent = totalFisico;
            diffTotalDiferencia.textContent = totalDiff;

            diffResumen.style.display = 'flex';
            resTeorico.textContent = totalTeorico;
            resFisico.textContent = totalFisico;
            resDiferencia.textContent = totalDiff;
            resContados.textContent = inventarioFisico.length;

            diffCount.textContent = filtroDiffModo === 'todos' ? `${inventarioFisico.length} registros` : `${lista.length} / ${inventarioFisico.length}`;
            try { actualizarPanelAlertaVenc(); } catch (e) {}
            expandCardSiHaceFalta('diff');
            try {
                if (typeof window.__iemAjustarScrollInventario === 'function') {
                    window.__iemAjustarScrollInventario();
                }
            } catch (eScroll) {}

            document.querySelectorAll('.eliminar-diff, .eliminar-diff-movil').forEach(btn => {
                btn.addEventListener('click', function() {
                    const idx = parseInt(this.dataset.index);
                    const registro = inventarioFisico[idx];
                    if (!registro) return;
                    confirmarAccion(`¿Eliminar el registro de "${registro.descripcion}"? Esto borra todos sus lotes contados.`).then(ok => {
                        if (!ok) return;
                        (registro.lotes || []).forEach(l => eliminarLoteDelServidor(l.id));
                        inventarioFisico.splice(idx, 1);
                        saveInventario();
                        renderInventario();
                    });
                });
            });
            document.querySelectorAll('.editar-diff, .editar-diff-movil').forEach(btn => {
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const idx = parseInt(this.dataset.index, 10);
                    if (typeof editarRegistroInventario === 'function') editarRegistroInventario(idx);
                });
            });
        }

        /** Abre el producto contado para corregir fecha/cantidad sin borrar. */
        function editarRegistroInventario(idx) {
            try {
                const registro = inventarioFisico[idx];
                if (!registro) return;
                const cod = String(registro.codigo || '').trim();
                if (!cod) return;
                let item = null;
                if (Array.isArray(currentData)) {
                    item = currentData.find(function (p) {
                        return String(getCodigo(p) || '').trim() === cod;
                    }) || null;
                }
                if (!item) {
                    showToast('Producto ' + cod + ' no está en el catálogo cargado', 'error');
                    return;
                }
                iemModoEdicion = true;
                filteredData = [item];
                selectedIndex = 0;
                try { if (searchInput) searchInput.value = cod; } catch (e0) {}
                try { renderResults(filteredData); } catch (e1) {}
                actualizarCantidades(item);
                try {
                    const factor = getFactorFinal(item) || 1;
                    const fisico = Number(registro.stockFisico) || 0;
                    if (factor > 1) {
                        txtCajas.value = String(Math.floor(fisico / factor));
                        txtUnidades.value = String(fisico % factor);
                    } else {
                        if (txtCajas) txtCajas.value = '0';
                        txtUnidades.value = String(fisico);
                    }
                    // Prefill fecha del último lote (o el primero)
                    var lotes = registro.lotes || [];
                    var loteRef = lotes.length ? lotes[lotes.length - 1] : null;
                    if (loteRef && loteRef.vencimiento && typeof selDia !== 'undefined') {
                        try {
                            var parts = String(loteRef.vencimiento).split(/[-/]/);
                            if (parts.length >= 3) {
                                var d = parseInt(parts[0], 10), m = parseInt(parts[1], 10), y = parseInt(parts[2], 10);
                                if (d >= 1 && d <= 31) selDia.value = d;
                                if (m >= 1 && m <= 12) selMes.value = m;
                                if (y >= 2000) {
                                    anioSeleccionado = y;
                                    document.querySelectorAll('.year-tab').forEach(function (t) {
                                        t.classList.toggle('active', parseInt(t.dataset.year) === y);
                                    });
                                }
                            }
                        } catch (eV) {}
                    }
                    if (typeof actualizarTotalCalculado === 'function') actualizarTotalCalculado();
                } catch (ePref) {}
                try {
                    var btnG = document.getElementById('btnRegistrarFisico');
                    if (btnG) {
                        btnG.dataset.editLabel = btnG.innerHTML;
                        btnG.innerHTML = '<span class="btn-icon">💾</span><span class="btn-label"> GUARDAR CAMBIOS</span>';
                    }
                } catch (eBtn) {}
                try {
                    const card = document.getElementById('productoActivoCard') || document.getElementById('resultsSection');
                    if (card && card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } catch (eSc) {}
                showToast('Modo edición: al guardar se REEMPLAZA el conteo (no se suma)', 'info');
            } catch (eEdit) {
                console.warn('editarRegistroInventario', eEdit);
                iemModoEdicion = false;
                showToast('No se pudo abrir para editar', 'error');
            }
        }

        // ============================================================
        // EXPORTAR INVENTARIO
        // ============================================================
        
        /**
         * ARCHIVO permanente del conteo (solo admin descarga).
         * Tabla Supabase: inventarios_enviados
         *  - id, enviado_en, usuario, total_productos, total_lotes, payload (jsonb)
         * lotes_conteo = solo conteo en vivo (varios celulares).
         * Al enviar: 1) guarda snapshot en inventarios_enviados
         *            2) respaldo Excel local
         *            3) borra lotes_conteo
         *            4) limpia inventario local en todos los dispositivos
         */
        async function archivarInventarioEnviado(filas, productosCount) {
            const payload = {
                productos: (inventarioFisico || []).map(function (r) {
                    return {
                        codigo: r.codigo,
                        descripcion: r.descripcion,
                        linea: r.linea,
                        stockTeorico: r.stockTeorico,
                        stockFisico: r.stockFisico,
                        diferencia: r.diferencia,
                        factor: r.factor,
                        lotes: r.lotes || []
                    };
                }),
                lotes: filas,
                meta: {
                    usuario: usuarioActual || '',
                    device_id: deviceId,
                    ts: new Date().toISOString()
                }
            };
            const ahora = new Date();
            const fechaMes = ahora.getFullYear() + '-' + String(ahora.getMonth() + 1).padStart(2, '0');
            const row = {
                usuario: usuarioActual || '',
                total_productos: productosCount || 0,
                total_lotes: (filas && filas.length) || 0,
                payload: payload,
                enviado_en: ahora.toISOString(),
                // Clave por mes para consultas y respaldos mensuales (si la columna existe)
                fecha_mes: fechaMes
            };
            let data, error;
            // Primero intentar con fecha_mes; si la columna no existe, reintentar sin ella
            ({ data, error } = await supabaseClient
                .from('inventarios_enviados')
                .insert([row])
                .select('id, enviado_en')
                .maybeSingle());
            if (error && /fecha_mes|column|schema/i.test(String(error.message || error))) {
                delete row.fecha_mes;
                ({ data, error } = await supabaseClient
                    .from('inventarios_enviados')
                    .insert([row])
                    .select('id, enviado_en')
                    .maybeSingle());
            }
            if (error) throw error;
            return data;
        }

        /**
         * Ledger persistente de lotes por producto + fecha de vencimiento (FIFO/FEFO).
         * A diferencia de lotes_conteo (que se BORRA al enviar), esta tabla nunca
         * se borra sola: cada envío actualiza (o crea) la fila de cada lote contado
         * que tenga vencimiento, para poder verlos ordenados por fecha (el que
         * vence antes, primero) y compararlos con el stock del sistema.
         * IMPORTANTE: esto NO toca productos.stock_teorico en ningún momento — ese
         * número sigue viniendo solo del Excel/sistema a diario. Es solo una foto
         * de referencia para ayudar a detectar diferencias con el sistema, no una
         * fuente de verdad del stock.
         * Requiere en Supabase (correr una sola vez):
         *   create table if not exists lotes_stock (
         *     id uuid primary key default gen_random_uuid(),
         *     codigo text not null,
         *     descripcion text,
         *     vencimiento text not null,
         *     cantidad numeric not null default 0,
         *     actualizado_en timestamptz default now(),
         *     usuario text,
         *     unique (codigo, vencimiento)
         *   );
         *   alter table lotes_stock enable row level security;
         *   create policy "auth all lotes_stock" on lotes_stock for all to authenticated using (true) with check (true);
         */
        async function actualizarLotesFifo(filas) {
            if (!supabaseClient || !Array.isArray(filas) || !filas.length) return;
            const conVencimiento = filas.filter(function (f) { return f.vencimiento; });
            if (!conVencimiento.length) return;
            const ahora = new Date().toISOString();
            // Sumar por si el mismo lote (código+vencimiento) aparece más de una vez en el envío
            const porLote = new Map();
            conVencimiento.forEach(function (f) {
                const key = String(f.codigo) + '__' + String(f.vencimiento);
                const prev = porLote.get(key);
                if (prev) {
                    prev.cantidad += Number(f.cantidad) || 0;
                } else {
                    porLote.set(key, {
                        codigo: f.codigo,
                        descripcion: f.descripcion || '',
                        vencimiento: f.vencimiento,
                        cantidad: Number(f.cantidad) || 0,
                        actualizado_en: ahora,
                        usuario: f.usuario || usuarioActual || ''
                    });
                }
            });
            const rows = Array.from(porLote.values());
            for (let i = 0; i < rows.length; i += 50) {
                const chunk = rows.slice(i, i + 50);
                try {
                    const { error } = await supabaseClient
                        .from('lotes_stock')
                        .upsert(chunk, { onConflict: 'codigo,vencimiento' });
                    if (error) {
                        console.warn('lotes_stock upsert', error);
                        if (/lotes_stock|does not exist|relation|schema cache/i.test(String(error.message || ''))) {
                            showToast('⚠️ Falta crear la tabla lotes_stock en Supabase para guardar los lotes por vencimiento (ver consola).', 'error');
                        }
                        break;
                    }
                } catch (e) {
                    console.warn('lotes_stock upsert', e);
                    break;
                }
            }
        }

        async function enviarInventarioCompleto() {
            if (!inventarioFisico || inventarioFisico.length === 0) {
                showToast('No hay conteo físico para enviar.', 'error');
                return;
            }
            const ok = await confirmarAccion(
                '¿Enviar el inventario a Supabase?\n' +
                '1) Se guarda un archivo permanente para el administrador\n' +
                '2) Se limpia el conteo en vivo (todos los celulares)\n' +
                'Así mañana pueden contar de nuevo.',
                'Enviar y limpiar',
                'primary'
            );
            if (!ok) return;

            const btn = document.getElementById('enviarInventarioBtn');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-label"> Enviando...</span>';
            }
            showToast('⏳ Archivando conteo en Supabase...', 'info');

            try {
                const filas = [];
                const productosCount = inventarioFisico.length;
                inventarioFisico.forEach(record => {
                    const factor = record.factor || 1;
                    (record.lotes || []).forEach(lote => {
                        const cajasLote = factor > 1 ? Math.floor(lote.cantidad / factor) : 0;
                        const unidadesLote = factor > 1 ? (lote.cantidad % factor) : lote.cantidad;
                        filas.push({
                            id: lote.id,
                            codigo: record.codigo,
                            descripcion: record.descripcion,
                            linea: record.linea || 'SIN LÍNEA',
                            cantidad: lote.cantidad,
                            cajas: cajasLote,
                            unidades: unidadesLote,
                            vencimiento: lote.vencimiento || null,
                            fecha: lote.fecha || null,
                            usuario: lote.usuario || usuarioActual || '',
                            device_id: deviceId
                        });
                    });
                });

                if (filas.length === 0) {
                    showToast('No hay lotes para enviar.', 'error');
                    return;
                }

                // 1) Archivo permanente (tabla inventarios_enviados)
                let archivoId = null;
                try {
                    const arch = await archivarInventarioEnviado(filas, productosCount);
                    archivoId = arch && arch.id ? arch.id : null;
                } catch (eArch) {
                    console.error('inventarios_enviados', eArch);
                    const msg = (eArch && eArch.message) ? String(eArch.message) : String(eArch);
                    if (/inventarios_enviados|does not exist|relation|schema cache/i.test(msg)) {
                        showToast('❌ Falta crear la tabla inventarios_enviados en Supabase (SQL abajo en el mensaje).', 'error');
                        throw new Error(
                            'Crea en Supabase SQL:\n' +
                            'create table inventarios_enviados (\n' +
                            '  id uuid primary key default gen_random_uuid(),\n' +
                            '  enviado_en timestamptz default now(),\n' +
                            '  usuario text,\n' +
                            '  total_productos int,\n' +
                            '  total_lotes int,\n' +
                            '  payload jsonb not null,\n' +
                            '  fecha_mes text\n' +
                            ');\n' +
                            'create index if not exists inventarios_enviados_fecha_mes_idx on inventarios_enviados (fecha_mes);\n' +
                            'create index if not exists inventarios_enviados_enviado_en_idx on inventarios_enviados (enviado_en);\n' +
                            'alter table inventarios_enviados enable row level security;\n' +
                            'create policy "auth all inventarios_enviados" on inventarios_enviados for all to authenticated using (true) with check (true);'
                        );
                    }
                    throw eArch;
                }

                // 1.5) Ledger persistente de lotes por vencimiento (FIFO/FEFO).
                // No borra nada existente, no toca stock_teorico: solo guarda una
                // foto actualizada de los lotes contados para comparar con el
                // sistema. Si falla, no debe frenar el resto del envío.
                try {
                    await actualizarLotesFifo(filas);
                } catch (eFifo) {
                    console.warn('No se pudo actualizar lotes_stock (FIFO)', eFifo);
                }

                // 2) Respaldo Excel en este dispositivo (IndexedDB mensuales)
                try {
                    if (typeof exportarInventario === 'function' && typeof XLSX !== 'undefined') {
                        // Generar buffer sin depender de admin para el respaldo interno
                        const filasX = [
                            ['#', 'Código', 'Descripción', 'Línea', 'Stock Teórico', 'Stock Físico', 'Diferencia', 'Vencimiento', 'Fecha/Hora', 'Usuario(s)']
                        ];
                        let n = 1;
                        (inventarioFisico || []).forEach(function (d) {
                            const det = (d.lotes || []).map(function (l) {
                                return (l.vencimiento || 'S/F') + ': ' + l.cantidad;
                            }).join(' | ');
                            const us = (typeof usuariosDeRegistro === 'function')
                                ? usuariosDeRegistro(d).join(', ')
                                : '';
                            filasX.push([
                                n++, d.codigo, d.descripcion, d.linea || '',
                                d.stockTeorico, d.stockFisico, d.diferencia,
                                det, d.fecha || '', us
                            ]);
                        });
                        const wb = XLSX.utils.book_new();
                        const ws = XLSX.utils.aoa_to_sheet(filasX);
                        XLSX.utils.book_append_sheet(wb, ws, 'ConteoEnviado');
                        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                        if (typeof guardarRespaldoMensual === 'function') {
                            await guardarRespaldoMensual('conteo_fisico', wbout, 'conteo_enviado');
                        }
                    }
                } catch (eBack) {
                    console.warn('Respaldo local del envío', eBack);
                }

                // 3) Vaciar conteo en vivo en Supabase (todos los celulares)
                try {
                    const { error: errDel } = await supabaseClient
                        .from('lotes_conteo')
                        .delete()
                        .neq('id', '');
                    if (errDel) console.warn('No se pudo vaciar lotes_conteo:', errDel);
                } catch (eDel) {
                    console.warn(eDel);
                }

                // 4) Limpiar local + marcar para no re-sincronizar lo viejo
                inventarioFisico = [];
                marcarConteoLimpioTrasEnvio();
                try { if (typeof saveInventario === 'function') saveInventario(); } catch (eClr) {}
                try { if (typeof renderInventario === 'function') renderInventario(); } catch (eRnd) {}

                try {
                    localStorage.setItem('iem_ultimo_envio_inventario', JSON.stringify({
                        ts: Date.now(),
                        usuario: usuarioActual || '',
                        lotes: filas.length,
                        productos: productosCount,
                        archivo_id: archivoId
                    }));
                } catch (e) {}

                // 5) Depuración: respaldos mensuales + borrar inventarios_enviados > 1 año
                try {
                    if (typeof depurarInventariosEnviadosAnuales === 'function') {
                        depurarInventariosEnviadosAnuales().catch(function () {});
                    }
                } catch (eDep) {}

                showToast(
                    '✅ Conteo archivado en Supabase por fecha (' + filas.length + ' lotes)' +
                    (archivoId ? ' · id ' + String(archivoId).slice(0, 8) + '…' : '') +
                    '. Conteo en vivo limpio. Respaldo mensual listo.',
                    'success'
                );
            } catch (err) {
                console.error(err);
                showToast('❌ No se pudo enviar: ' + (err.message || err), 'error');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<span class="btn-icon">📤</span><span class="btn-label"> Enviar inventario</span>';
                }
            }
        }

        /**
         * Mantiene inventarios_enviados por fechas hasta 1 año.
         * Genera/asegura respaldo mensual local y elimina de Supabase
         * los envíos con más de 365 días para depurar el sistema.
         */
        async function depurarInventariosEnviadosAnuales() {
            if (!supabaseClient) return { ok: false };
            var unAnoMs = 365 * 24 * 60 * 60 * 1000;
            var corte = new Date(Date.now() - unAnoMs).toISOString();
            var n = 0;
            try {
                // Intento directo por enviado_en
                var { data, error } = await supabaseClient
                    .from('inventarios_enviados')
                    .delete()
                    .lt('enviado_en', corte)
                    .select('id');
                if (!error && Array.isArray(data)) {
                    n = data.length;
                } else {
                    // Fallback: listar y borrar por lotes
                    var { data: all, error: e2 } = await supabaseClient
                        .from('inventarios_enviados')
                        .select('id, enviado_en')
                        .limit(2000);
                    if (e2) throw e2;
                    var ids = (all || []).filter(function (r) {
                        return r.enviado_en && new Date(r.enviado_en).getTime() < (Date.now() - unAnoMs);
                    }).map(function (r) { return r.id; });
                    for (var i = 0; i < ids.length; i += 50) {
                        var chunk = ids.slice(i, i + 50);
                        var { error: e3 } = await supabaseClient
                            .from('inventarios_enviados')
                            .delete()
                            .in('id', chunk);
                        if (!e3) n += chunk.length;
                    }
                }
            } catch (e) {
                console.warn('depurarInventariosEnviadosAnuales', e);
                return { ok: false, error: e };
            }
            // También limpiar lotes_conteo de meses anteriores (ya existe)
            try {
                if (typeof limpiarConteosMesesAnterioresAuto === 'function') {
                    await limpiarConteosMesesAnterioresAuto();
                }
            } catch (e2) {}
            return { ok: true, n: n };
        }

        async function listarInventariosEnviados() {
            if (!esAdmin()) {
                showToast('Solo el administrador puede ver los envíos archivados.', 'error');
                return;
            }
            const box = document.getElementById('adminListaEnviados');
            if (box) box.innerHTML = '<p class="admin-lead">Cargando envíos…</p>';
            // Depurar en segundo plano (>1 año + lotes de meses anteriores)
            try {
                if (typeof depurarInventariosEnviadosAnuales === 'function') {
                    depurarInventariosEnviadosAnuales().catch(function () {});
                }
            } catch (eDep) {}
            try {
                // Hasta 1 año de historial por fechas; se depuran automáticamente los >365 días
                const { data, error } = await supabaseClient
                    .from('inventarios_enviados')
                    .select('id, enviado_en, usuario, total_productos, total_lotes')
                    .order('enviado_en', { ascending: false })
                    .limit(100);
                if (error) throw error;
                if (!data || !data.length) {
                    if (box) box.innerHTML = '<p class="admin-lead">Aún no hay envíos archivados. Usa <strong>Enviar inventario</strong> en el conteo.</p>';
                    return;
                }
                // Agrupar por mes (YYYY-MM) para lectura por fechas
                var porMes = {};
                data.forEach(function (r) {
                    var key = '-';
                    if (r.enviado_en) {
                        var d = new Date(r.enviado_en);
                        key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
                    }
                    if (!porMes[key]) porMes[key] = [];
                    porMes[key].push(r);
                });
                var meses = Object.keys(porMes).sort().reverse();
                if (box) {
                    var html = '<p class="admin-lead" style="margin-bottom:0.5rem;">Archivados por fecha (retención 1 año). Respaldo mensual al enviar.</p>';
                    meses.forEach(function (mes) {
                        html += '<div style="margin:0.6rem 0 0.25rem;font-weight:600;font-size:0.9rem;color:var(--text-muted);">📦 ' + mes + '</div>';
                        html += '<ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:0.4rem;">';
                        porMes[mes].forEach(function (r) {
                            const f = r.enviado_en ? new Date(r.enviado_en).toLocaleString('es-PE') : '-';
                            html += '<li style="display:flex;flex-wrap:wrap;align-items:center;gap:0.4rem;padding:0.5rem 0.65rem;border:1px solid var(--card-border);border-radius:10px;background:var(--input-bg);">' +
                                '<span style="flex:1;min-width:140px;font-size:0.85rem;">📅 ' + f +
                                '<br><span style="color:var(--text-muted);font-size:0.78rem;">👤 ' + (r.usuario || '-') +
                                ' · ' + (r.total_productos || 0) + ' prod · ' + (r.total_lotes || 0) + ' lotes</span></span>' +
                                '<button type="button" class="btn btn-sm btn-primary btn-descarga-envio" data-id="' + r.id + '">⬇️ Excel</button>' +
                                '</li>';
                        });
                        html += '</ul>';
                    });
                    box.innerHTML = html;
                    box.querySelectorAll('.btn-descarga-envio').forEach(function (b) {
                        b.addEventListener('click', function () {
                            descargarInventarioEnviadoExcel(b.getAttribute('data-id'));
                        });
                    });
                }
            } catch (e) {
                console.error(e);
                const msg = (e && e.message) ? e.message : String(e);
                if (box) {
                    box.innerHTML = /inventarios_enviados|does not exist|relation/i.test(msg)
                        ? '<p class="admin-lead" style="color:var(--danger);">Falta crear la tabla <code>inventarios_enviados</code> en Supabase (SQL del envío).</p>'
                        : '<p class="admin-lead" style="color:var(--danger);">Error: ' + msg + '</p>';
                }
            }
        }

        async function descargarInventarioEnviadoExcel(id) {
            try { await ensureXlsx(); } catch (eX) { showToast('No se pudo cargar Excel (XLSX).', 'error'); return; }
            if (!esAdmin()) return;
            showToast('⏳ Preparando Excel del envío…', 'info');
            try {
                let q = supabaseClient.from('inventarios_enviados').select('id, enviado_en, usuario, payload, total_productos, total_lotes');
                if (id) q = q.eq('id', id).maybeSingle();
                else q = q.order('enviado_en', { ascending: false }).limit(1).maybeSingle();
                const { data, error } = await q;
                if (error) throw error;
                if (!data) {
                    showToast('No hay envío archivado.', 'error');
                    return;
                }
                const payload = data.payload || {};
                const productos = payload.productos || [];
                const filas = [
                    ['#', 'Código', 'Descripción', 'Línea', 'Stock Teórico', 'Stock Físico', 'Diferencia', 'Vencimiento', 'Fecha', 'Usuario(s)']
                ];
                let n = 1;
                productos.forEach(function (d) {
                    const det = (d.lotes || []).map(function (l) {
                        return (l.vencimiento || 'S/F') + ': ' + l.cantidad;
                    }).join(' | ');
                    const us = [...new Set((d.lotes || []).map(function (l) { return l.usuario; }).filter(Boolean))].join(', ');
                    filas.push([
                        n++, d.codigo, d.descripcion, d.linea || '',
                        d.stockTeorico, d.stockFisico, d.diferencia,
                        det, (d.lotes && d.lotes[0] && d.lotes[0].fecha) || '', us
                    ]);
                });
                if (filas.length === 1 && payload.lotes) {
                    payload.lotes.forEach(function (l, i) {
                        filas.push([i + 1, l.codigo, l.descripcion, l.linea || '', '', l.cantidad, '', l.vencimiento || '', l.fecha || '', l.usuario || '']);
                    });
                }
                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.aoa_to_sheet(filas);
                XLSX.utils.book_append_sheet(wb, ws, 'ConteoEnviado');
                const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                const blob = new Blob([wbout], { type: 'application/octet-stream' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                const dia = (data.enviado_en || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
                a.download = 'conteo_enviado_' + dia + '.xlsx';
                a.click();
                URL.revokeObjectURL(a.href);
                showToast('📥 Excel del envío archivado descargado.', 'success');
            } catch (e) {
                console.error(e);
                showToast('❌ ' + (e.message || e), 'error');
            }
        }

        async function exportarInventario() {
            try { await ensureXlsx(); } catch (eX) { showToast('No se pudo cargar Excel (XLSX).', 'error'); return; }
            // Disponible para admin y usuarios de conteo (guardar su conteo terminado)
            if (typeof esVendedor === 'function' && esVendedor() && !esAdmin()) {
                showToast('No disponible en modo vendedor.', 'error');
                return;
            }
            if (inventarioFisico.length === 0) {
                showToast('No hay datos para exportar. Si ya enviaste, usa «Excel del último envío archivado» en Descargas (admin).', 'error');
                return;
            }

            // Excel PLANO: sin agrupar por línea (una fila por producto)
            const filas = [
                ['#', 'Código', 'Descripción', 'Línea', 'Stock Teórico', 'Stock Físico', 'Diferencia', 'Vencimiento', 'Fecha/Hora', 'Usuario(s)']
            ];
            let contador = 1;
            let totalTeorico = 0, totalFisico = 0, totalDiff = 0;
            const ordenados = inventarioFisico.slice().sort(function (a, b) {
                return String(a.codigo || '').localeCompare(String(b.codigo || ''), 'es', { numeric: true });
            });
            ordenados.forEach(function (d) {
                const detalleLotes = (d.lotes || []).map(function (l) {
                    return (l.vencimiento || 'S/F') + ': ' + l.cantidad;
                }).join(' | ');
                const usuarios = usuariosDeRegistro(d);
                const usuariosTexto = usuarios.length > 1 ? usuarios.join(', ') : (usuarios.join(', ') || '-');
                filas.push([
                    contador++,
                    d.codigo,
                    d.descripcion,
                    d.linea || 'SIN LÍNEA',
                    d.stockTeorico,
                    d.stockFisico,
                    d.diferencia,
                    detalleLotes || (d.vencimiento || '-'),
                    d.fecha,
                    usuariosTexto
                ]);
                totalTeorico += Number(d.stockTeorico) || 0;
                totalFisico += Number(d.stockFisico) || 0;
                totalDiff += Number(d.diferencia) || 0;
            });
            filas.push(['', '', '', 'TOTAL', totalTeorico, totalFisico, totalDiff, '', '', '']);

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(filas);
            ws['!cols'] = [{wch:6},{wch:10},{wch:42},{wch:24},{wch:12},{wch:12},{wch:12},{wch:30},{wch:18},{wch:24}];
            XLSX.utils.book_append_sheet(wb, ws, 'InventarioFisico');
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/octet-stream' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'inventario_fisico_' + new Date().toISOString().slice(0,10) + '.xlsx';
            link.click();
            URL.revokeObjectURL(link.href);
            showToast('📥 Excel plano exportado (sin agrupar por línea).', 'success');
            try {
                if (typeof guardarRespaldoMensual === 'function') {
                    await guardarRespaldoMensual('conteo_fisico', wbout, 'conteo_fisico');
                }
            } catch (eB) { console.warn(eB); }
        }

        // Vista previa agrupada por línea + PDF elegante (print)
        function stockACajasUnidades(stock, factor) {
            const f = Math.max(1, Number(factor) || 1);
            const s = Math.max(0, Math.floor(Number(stock) || 0));
            return { cajas: Math.floor(s / f), unidades: s % f };
        }

        function construirHtmlVistaInventario() {
            // Vista previa = SOLO inventario físico contado.
            // Misma estructura que Reporte sistema: Fríos/Secos → líneas → cajas/unidades.
            const filtroVista = (typeof filtroTipoLaive !== 'undefined' && filtroTipoLaive) ? filtroTipoLaive : '';
            const invMap = {};
            (inventarioFisico || []).forEach(function (d) {
                if (d && d.codigo) invMap[String(d.codigo)] = d;
            });

            // Solo productos que tienen conteo físico registrado
            let items = (currentData || []).filter(function (item) {
                const cod = String(getCodigo(item) || '');
                if (!cod || !invMap[cod]) return false;
                const reg = invMap[cod];
                const fisico = Number(reg.stockFisico);
                if (!isFinite(fisico)) return false;
                if (filtroVista) {
                    const tipo = (typeof getTipoAlmacenReporte === 'function')
                        ? getTipoAlmacenReporte(item)
                        : getTipoAlmacen(item);
                    return tipo === filtroVista;
                }
                return true;
            });

            if (!items.length) {
                return '<p class="admin-sesiones-empty">No hay productos contados' +
                    (filtroVista ? ' en <strong>' + filtroVista + '</strong>' : '') +
                    '. Realiza el conteo físico y vuelve a abrir Vista previa.</p>';
            }

            function agruparPorLineaVista(lista) {
                const gruposMap = {};
                lista.forEach(function (item) {
                    let lin = (typeof getLineaReporte === 'function')
                        ? getLineaReporte(item)
                        : String(getLinea(item) || '').trim();
                    if (!lin || (typeof normalizarTipoAlmacen === 'function' && normalizarTipoAlmacen(lin))) {
                        lin = 'SIN LÍNEA';
                    }
                    if (!gruposMap[lin]) gruposMap[lin] = [];
                    gruposMap[lin].push(item);
                });
                return Object.keys(gruposMap).sort(function (a, b) {
                    if (a === 'SIN LÍNEA') return 1;
                    if (b === 'SIN LÍNEA') return -1;
                    if (a === 'PROMOS / COMBOS') return 1;
                    if (b === 'PROMOS / COMBOS') return -1;
                    return a.localeCompare(b, 'es');
                }).map(function (lin) {
                    const arr = gruposMap[lin].slice().sort(function (a, b) {
                        return String(getCodigo(a)).localeCompare(String(getCodigo(b)), 'es', { numeric: true });
                    });
                    return { linea: lin, items: arr };
                });
            }

            const bloques = [];
            if (filtroVista) {
                bloques.push({
                    titulo: (filtroVista === 'FRIOS' ? '❄️ FRÍOS' : '📦 SECOS') + ' · ' + items.length + ' productos',
                    grupos: agruparPorLineaVista(items),
                    esOtros: false
                });
            } else {
                const getTipo = (typeof getTipoAlmacenReporte === 'function') ? getTipoAlmacenReporte : getTipoAlmacen;
                const frios = items.filter(function (it) { return getTipo(it) === 'FRIOS'; });
                const secos = items.filter(function (it) { return getTipo(it) === 'SECOS'; });
                const otros = items.filter(function (it) {
                    const t = getTipo(it);
                    return t !== 'FRIOS' && t !== 'SECOS';
                });
                if (frios.length) bloques.push({ titulo: '❄️ FRÍOS · ' + frios.length + ' productos', grupos: agruparPorLineaVista(frios), esOtros: false });
                if (secos.length) bloques.push({ titulo: '📦 SECOS · ' + secos.length + ' productos', grupos: agruparPorLineaVista(secos), esOtros: false });
                if (otros.length) bloques.push({
                    titulo: '⚠️ SIN CLASIFICAR · ' + otros.length + ' productos',
                    grupos: agruparPorLineaVista(otros),
                    esOtros: true
                });
            }

            let html = '<div class="inv-preview-doc inv-report-almacen inv-report-fisico">';
            let n = 0, totalCajas = 0, totalUni = 0;
            html += '<header class="inv-preview-head inv-report-head">' +
                '<div class="inv-report-logo-wrap">' +
                '<img class="inv-report-logo" src="logo-iem.png" alt="IEM GROUP">' +
                '<p class="inv-preview-meta">' + new Date().toLocaleString('es-PE') + '</p>' +
                '</div>' +
                '<div class="inv-report-head-text">' +
                '<h1>REPORTE DE INVENTARIO FÍSICO</h1>' +
                '</div></header>';

            bloques.forEach(function (bloque, idxBloque) {
                const breakCls = (idxBloque > 0) ? ' page-break-before' : '';
                html += '<div class="inv-report-tipo-block' + breakCls + '">';
                html += '<h2 class="inv-report-tipo-titulo' + (bloque.esOtros ? ' otros' : '') + '">' +
                    escapeHtmlSes(bloque.titulo) + '</h2>';
                (bloque.grupos || []).forEach(function (grupo) {
                    html += '<section class="inv-preview-linea"><h3 class="inv-preview-linea-h">' + escapeHtmlSes(grupo.linea) + '</h3>';
                    html += '<table class="inv-preview-table inv-report-table"><thead><tr>' +
                        '<th>Cod. Producto</th><th>Cod. Fábrica</th><th>Descripción</th>' +
                        '<th>Unidad</th><th class="num col-cajas">Cajas</th><th class="num col-sueltas">Sueltas</th>' +
                        '</tr></thead><tbody>';
                    (grupo.items || []).forEach(function (item) {
                        n++;
                        const cod = String(getCodigo(item) || '');
                        const reg = invMap[cod];
                        const factor = (typeof getFactorFinal === 'function') ? getFactorFinal(item) : (getFactorEmpaque(item) || 1);
                        const fisico = reg ? (Number(reg.stockFisico) || 0) : 0;
                        const cu = stockACajasUnidades(fisico, factor);
                        totalCajas += cu.cajas;
                        totalUni += cu.unidades;
                        html += '<tr>' +
                            '<td class="mono">' + escapeHtmlSes(cod) + '</td>' +
                            '<td class="mono">' + escapeHtmlSes(getCodigoFabrica(item) || '') + '</td>' +
                            '<td>' + escapeHtmlSes(getDescripcion(item)) + '</td>' +
                            '<td>' + escapeHtmlSes(getUnidadRef(item) || '') + '</td>' +
                            '<td class="num">' + cu.cajas + '</td>' +
                            '<td class="num">' + cu.unidades + '</td>' +
                            '</tr>';
                    });
                    html += '</tbody></table></section>';
                });
                html += '</div>';
            });

            const tituloFiltro = filtroVista === 'FRIOS' ? 'FRÍOS' : (filtroVista === 'SECOS' ? 'SECOS' : 'TODOS');
            html += '<footer class="inv-preview-foot"><strong>TOTAL FÍSICO</strong> · Ítems: ' + n +
                ' · Cajas contadas: ' + totalCajas + ' · Unidades sueltas: ' + totalUni +
                (filtroVista ? ' · (' + tituloFiltro + ')' : '') +
                '</footer></div>';
            return html;
        }

        function renderVistaPreviaInventario() {
            const box = document.getElementById('adminVistaPreview');
            if (!box) return;
            box.innerHTML = construirHtmlVistaInventario();
        }

        /** Carga html2pdf.js una sola vez (CDN). */
        function cargarHtml2Pdf() {
            return new Promise(function (resolve, reject) {
                if (typeof window.html2pdf === 'function') {
                    resolve(window.html2pdf);
                    return;
                }
                const existente = document.querySelector('script[data-html2pdf]');
                if (existente) {
                    existente.addEventListener('load', function () { resolve(window.html2pdf); });
                    existente.addEventListener('error', function () { reject(new Error('No se pudo cargar html2pdf')); });
                    return;
                }
                const s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                s.async = true;
                s.setAttribute('data-html2pdf', '1');
                s.onload = function () { resolve(window.html2pdf); };
                s.onerror = function () { reject(new Error('No se pudo cargar html2pdf')); };
                document.head.appendChild(s);
            });
        }

        /**
         * Genera un PDF real y lo abre en el visor nativo del navegador
         * (como Chrome PDF viewer: páginas, zoom, descargar).
         */
        function abrirHtmlParaImprimir(titulo, estilosExtra, contenidoHtml) {
            const nombreArchivo = (String(titulo || 'reporte')
                .replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, '')
                .replace(/\s+/g, '_')
                .slice(0, 60) || 'reporte_inventario') + '.pdf';

            // Colores fijos (no hereda tema oscuro → evita PDF en blanco)
            const estilosPagina =
                '*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}' +
                '#iemPdfPage{margin:0;padding:0;font-family:Arial,Segoe UI,sans-serif;color:#111!important;font-size:11px;background:#fff!important}' +
                '#iemPdfPage, #iemPdfPage td, #iemPdfPage th, #iemPdfPage p, #iemPdfPage span, #iemPdfPage div, #iemPdfPage strong{color:#111!important}' +
                '#iemPdfPage .inv-report-logo-wrap{margin:0;position:absolute;left:0;top:2px;text-align:left}' +
                '#iemPdfPage .inv-report-logo{height:36px;width:auto;display:block}' +
                '#iemPdfPage .inv-preview-head{position:relative;min-height:48px;border-bottom:none;padding:0 0 8px 0;margin:0 0 12px 0;text-align:center}' +
                '#iemPdfPage .inv-report-head-text{display:block;padding-top:6px}' +
                '#iemPdfPage .inv-preview-head h1{margin:0;font-size:15px;color:#0f172a!important;font-weight:700;letter-spacing:.02em}' +
                '#iemPdfPage .inv-preview-meta{position:static;margin:3px 0 0;color:#475569!important;font-size:9px;line-height:1.2}' +
                '#iemPdfPage .inv-report-tipo-block{page-break-inside:auto}' +
                '#iemPdfPage .inv-report-tipo-block.page-break-before{page-break-before:always;break-before:page}' +
                '#iemPdfPage .inv-report-tipo-titulo{margin:16px 0 8px;font-size:13px;color:#fff!important;background:#0f766e!important;padding:6px 10px;font-weight:800;letter-spacing:.03em;border-radius:4px;page-break-after:avoid;break-after:avoid-page}' +
                '#iemPdfPage .inv-report-tipo-titulo.otros{background:#b45309!important}' +
                '#iemPdfPage .inv-preview-linea{margin-bottom:14px;page-break-inside:avoid;break-inside:avoid}' +
                '#iemPdfPage .inv-preview-linea-h,#iemPdfPage .inv-preview-linea h2,#iemPdfPage .inv-preview-linea h3{margin:0 0 6px;font-size:12px;color:#fff!important;background:#1e3a5f!important;padding:5px 8px;font-weight:700;page-break-after:avoid;break-after:avoid-page}' +
                '#iemPdfPage .inv-preview-table{width:100%;border-collapse:collapse;font-size:10px;color:#111!important}' +
                '#iemPdfPage .inv-preview-table th{background:#e2e8f0!important;color:#0f172a!important;text-align:left;padding:4px 6px;border:1px solid #94a3b8;font-weight:700}' +
                '#iemPdfPage .inv-preview-table td{padding:3px 6px;border:1px solid #cbd5e1;vertical-align:top;color:#111!important}' +
                '#iemPdfPage .mono{font-family:ui-monospace,Consolas,monospace;font-weight:600;color:#111!important}' +
                '#iemPdfPage .num{text-align:right;font-variant-numeric:tabular-nums;color:#111!important}' +
                '#iemPdfPage .col-cajas,#iemPdfPage .col-sueltas{width:48px;max-width:52px;white-space:nowrap;padding-left:3px!important;padding-right:4px!important}' +
                '#iemPdfPage .inv-preview-table th.col-cajas,#iemPdfPage .inv-preview-table th.col-sueltas{font-size:9px}' +
                '#iemPdfPage .inv-preview-table td:nth-child(3){width:auto}' +
                '#iemPdfPage .inv-preview-table th:nth-child(1),#iemPdfPage .inv-preview-table td:nth-child(1){width:52px}' +
                '#iemPdfPage .inv-preview-table th:nth-child(2),#iemPdfPage .inv-preview-table td:nth-child(2){width:62px}' +
                '#iemPdfPage .inv-preview-table th:nth-child(4),#iemPdfPage .inv-preview-table td:nth-child(4){width:70px;font-size:9px}' +
                '#iemPdfPage .inv-preview-foot{margin-top:12px;padding-top:8px;border-top:2px solid #1d4ed8;font-size:11px;color:#0f172a!important}' +
                (estilosExtra || '');

            showToast('Generando PDF… espera un momento.', 'info');

            // Contenedor fuera de pantalla (mismo origen → se puede abrir el blob)
            let host = document.getElementById('iemPdfRenderHost');
            if (!host) {
                host = document.createElement('div');
                host.id = 'iemPdfRenderHost';
                host.setAttribute('aria-hidden', 'true');
                host.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;background:#ffffff;color:#111111;z-index:-1;pointer-events:none;opacity:1;';
                document.body.appendChild(host);
            }
            host.innerHTML = '<style>' + estilosPagina + '</style><div id="iemPdfPage">' + contenidoHtml + '</div>';
            const page = host.querySelector('#iemPdfPage');
            if (page) {
                page.style.background = '#ffffff';
                page.style.color = '#111111';
            }

            cargarHtml2Pdf()
                .then(function (html2pdf) {
                    const opt = {
                        margin: [8, 8, 8, 8],
                        filename: nombreArchivo,
                        image: { type: 'jpeg', quality: 0.96 },
                        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                        pagebreak: { mode: ['css', 'legacy'] }
                    };
                    return html2pdf().set(opt).from(page).outputPdf('blob');
                })
                .then(function (blob) {
                    if (!blob) throw new Error('PDF vacío');
                    const url = URL.createObjectURL(blob);
                    const w = window.open(url, '_blank');
                    if (!w) {
                        // Popup bloqueado → descarga directa
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = nombreArchivo;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        showToast('PDF descargado (activa ventanas emergentes para abrirlo en el visor).', 'info');
                    } else {
                        showToast('PDF abierto en el visor del navegador.', 'success');
                    }
                    setTimeout(function () {
                        try { URL.revokeObjectURL(url); } catch (e) {}
                        try { host.innerHTML = ''; } catch (e2) {}
                    }, 120000);
                })
                .catch(function (err) {
                    console.error(err);
                    showToast('No se pudo generar el PDF: ' + (err && err.message ? err.message : err), 'error');
                });

            return true;
        }

        function exportarInventarioPDF() {
            if (!esAdmin()) {
                showToast('Solo el administrador puede exportar PDF.', 'error');
                return;
            }
            const contenido = construirHtmlVistaInventario();
            if (!contenido || contenido.indexOf('No hay productos') !== -1) {
                showToast('No hay productos para el PDF con el filtro actual.', 'error');
                return;
            }
            const titulo = 'REPORTE DE INVENTARIO POR ALMACÉN' + (filtroTipoLaive ? ' · ' + filtroTipoLaive : '');
            abrirHtmlParaImprimir(titulo, '', contenido);
        }

        // ============================================================
        // REPORTE DEL SISTEMA (stock del Excel / existencias)
        // Formato igual al macro: agrupado por Fríos/Secos + línea
        // ============================================================
        let filtroTipoReporte = ''; // '' | 'FRIOS' | 'SECOS'

        function setFiltroTipoReporte(tipo) {
            filtroTipoReporte = normalizarTipoAlmacen(tipo) || (tipo ? String(tipo).toUpperCase() : '');
            if (filtroTipoReporte !== 'FRIOS' && filtroTipoReporte !== 'SECOS') filtroTipoReporte = '';
            document.querySelectorAll('[data-filtro-tipo-reporte]').forEach(function (btn) {
                const t = (btn.getAttribute('data-filtro-tipo-reporte') || '').toUpperCase();
                btn.classList.toggle('active', t === filtroTipoReporte || (filtroTipoReporte === '' && t === ''));
            });
            if (typeof renderReporteSistema === 'function') {
                try { renderReporteSistema(); } catch (e) {}
            }
        }

        /** Texto normalizado de descripción (sin tildes) para inferir línea / tipo. */
        function descReporteNorm(item) {
            return String(getDescripcion(item) || '').toUpperCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }

        /**
         * Tipo Fríos/Secos para el reporte.
         * Usa el del catálogo (Laive); si falta (PROM, CBM, etc.) lo infiere por nombre.
         */
        function getTipoAlmacenReporte(item) {
            const directo = getTipoAlmacen(item);
            if (directo === 'FRIOS' || directo === 'SECOS') return directo;

            const d = descReporteNorm(item);
            // Fríos primero cuando es UHT / bebida chocolate / preferida (aunque diga M.LÁC)
            if (/UHT|BEB\.?\s*CHOCOLATE|BEB\.?\s*(?:LA\s*)?PREF|YOGURT|YOGHURT|\bYOG\b|BIO\s*DEFENSA|YOPI|YOP\s*MIX|QUESO|MOZARELLA|MOZZARELLA|EDAM|GOUDA|DANBO|CHEDDAR|PARMESANO|FRESCO\s*LAIVE|CREAM\s*CHEESE|CREMA\s*DE\s*Q|CREMA\s*QUESO|MANTEQUILLA|MANJAR|FUDGE|AREQUIP|BLANQUITO|DULCE\s*DE\s*LECHE|HELADERO|JAMONADA|\bJAMON\b|CHORIZO|HOT\s*DOG|HOTDOG|CHICHARRON|TOCINO|LECHE\s*ENTER|LECHE\s*LIGHT|LECHE\s*SEMIDES|LECHE\s*SIN\s*LACT|LECHE\s*SABORIZ|LECHE\s*LAIVE|BEBIDA\s*DE\s*LECHE|ALMENDRA|SOYA\s*LAIVE|BEB\.?\s*COCO|COCO\s*LAIVE/.test(d)) {
                return 'FRIOS';
            }
            // Secos: evaporadas / M.LÁC caja / Nutrilac (ambiente)
            if (/EVAPORAD|NUTRILAC|M\.?\s*LAC\.?|ML\s*LAIVE|SIN\s*LAC.*(?:CAJA|CJ|6PACK|PACK)|MARGARINA|SIROPE|MAPLE|WATTS|\bNARANJA\b|\bDURAZNO\b|\bPERA\b|\bMANGO\b/.test(d)) {
                return 'SECOS';
            }
            // PROM / CBM sin match claro → por defecto fríos (promos lácteas)
            const cod = String(getCodigo(item) || '').toUpperCase();
            if (/^(PROM|CBM|CMB|COMBO|PACK)/.test(cod) || /\b(PROM|PROMO|CBM|CMB|COMBO)\b/.test(d)) {
                return 'FRIOS';
            }
            return '';
        }

        /** Línea de reporte: categoría del catálogo o inferida de la descripción (estilo macro). */
        function getLineaReporte(item) {
            let lin = String(getLinea(item) || '').trim();
            if (lin && !normalizarTipoAlmacen(lin)) return lin.toUpperCase();

            const extra = getField(item,
                'InventarioProductoCategoriaDescripcion', 'Categoria', 'categoria',
                'Familia', 'familia', 'Sublinea', 'SubLínea', 'Grupo', 'grupo'
            );
            if (extra && !normalizarTipoAlmacen(String(extra))) return String(extra).trim().toUpperCase();

            // Inferir por descripción (nombres del Excel existencias + abreviaturas Laive/MAX)
            const d = descReporteNorm(item);
            const reglas = [
                // UHT / bolsa preferida antes que evaporada genérica
                [/UHT\s*(?:LA\s*)?PREF|UHT\s*LAIVE|M\.?\s*LAC\.?\s*UHT|LECHE\s*UHT/, 'LECHES FRESCAS: ENTERO (A)'],
                // Bebidas saborizadas / chocolate
                [/BEB\.?\s*CHOCOLATE|BEB\.?\s*(?:LA\s*)?PREF|BEBIDA\s*YOPI|CHOCOLATE\s*LAIVE\s*BOLSA|B\.?\s*NUTRITIVA|BEBIDA\s*DE\s*LECHE.*CHOCO/, 'LECHES FRESCAS: SABORIZADAS'],
                // Evaporadas: M. LÁC / ML / NUTRILAC / SIN LAC en caja/6pack / BOLSITARRO
                [/NUTRILAC|BOLSITARRO|(?:^|[\s.])M\.?\s*LAC\.?(?:\s|$)|ML\s*LAIVE|SIN\s*LAC.*(?:CAJA|CJ|6PACK|PACK)|EVAPORAD|MEZCLA\s*LACTEA/, 'EVAPORADAS: ENTERO (A)'],
                [/WATTS|\bNARANJADA\b|\bNARANJA\b.*(?:BOT|CAJ|946)|YOPIGEL|REFRESCOS/, 'BEBIDAS: BEBIDAS'],
                [/BEBIDA(?!\s*DE\s*LECHE)/, 'BEBIDAS: BEBIDAS'],
                [/CHICHARRON/, 'CARNICOS: CHICHARRON'],
                [/CHORIZO/, 'CARNICOS: CHORIZO'],
                [/HOT\s*DOG|HOTDOG|SALCHICHA/, 'CARNICOS: HOT DOG'],
                [/JAMONADA|MORTADELA/, 'CARNICOS: JAMONADA / MORTADELA'],
                [/\bJAMON\b|PIZZERO/, 'CARNICOS: JAMÓN'],
                [/TOCINO/, 'CARNICOS: TOCINO'],
                [/LECHE\s*(?:ENTER|NATURAL|FRESCA)|LECHE\s*LAIVE\s*NATURAL/, 'LECHES FRESCAS: ENTERO (A)'],
                [/LECHE\s*(?:LIGHT|SEMIDES)|SBELT/, 'LECHES FRESCAS: LIGHT'],
                [/LECHE\s*SIN\s*LACT|SIN\s*LAC.*BOL/, 'LECHES FRESCAS: SIN LACTOSA'],
                [/LECHE\s*SABORIZ|SAB\.?\s*CHOCO/, 'LECHES FRESCAS: SABORIZADAS'],
                [/AREQUIPENO|AREQUIPENO/, 'MANJARES: AREQUIPEÑO'],
                [/BLANQUITO/, 'MANJARES: BLANQUITO'],
                [/CASERO.*CHOCOLATE|FUDGE\s*ESPECIAL\s*CASERO|FUDGE\s*SABOR\s*CASERO/, 'MANJARES: CASERO - SABOR CHOCOLATE'],
                [/DULCE\s*DE\s*LECHE|DULC\.?\s*LECHE/, 'MANJARES: DULCE DE LECHE'],
                [/HELADERO/, 'MANJARES: HELADERO - SABOR CHOCOLATE'],
                [/MANJAR\s*ESPECIAL/, 'MANJARES: ESPECIAL'],
                [/MANJAR|FUDGE/, 'MANJARES: MANJAR'],
                [/MANTEQUILLA|MANT\.\s*CON\s*SAL|MANT\.\s*BAZO/, 'MANTEQUILLAS: CON SAL'],
                [/MARGARINA|SWIS/, 'MARGARINAS: MARGARINAS'],
                [/SIROPE|MAPLE/, 'MAQUILA'],
                [/Q\.?\s*ANDINO|\bANDINO\b/, 'QUESOS: ANDINO'],
                [/CHARACATO/, 'QUESOS: CHARACATO'],
                [/CHEDDAR/, 'QUESOS: CHEDDAR'],
                [/CREAM\s*CHEESE|CREMA\s*CHEESE/, 'QUESOS: CREAM CHEESE'],
                [/QUESO\s*CREMA|CREMA\s*DE\s*Q\.?|CREMA\s*DE\s*QUESO|CREMA\s*QUESO|\bCREMA\s*DE\s*Q\b/, 'QUESOS: CREMA'],
                [/\bDANBO\b/, 'QUESOS: DANBO'],
                [/\bEDAM\b/, 'QUESOS: EDAM'],
                [/QUESO\s*FRESCO|FRESCO\s*LAIVE/, 'QUESOS: FRESCO'],
                [/\bGOUDA\b/, 'QUESOS: GOUDA'],
                [/MOZARELLA|MOZZARELLA/, 'QUESOS: MOZARELLA'],
                [/PARMESANO/, 'QUESOS: PARMESANO'],
                [/BEB\.?\s*COCO|COCO\s*LAIVE|ALMENDRA|SOYA\s*LAIVE|VEGETALES/, 'VEGETALES:VEGETALES'],
                [/BIO\s*DEF|BIODEFENSA|YOGURT|YOGHURT|\bYOG\b|YOPI|YOP\s*MIX|GRIEGO/, 'YOGURTS'],
                [/CREMA\s*DE\s*LECHE/, 'CREMAS DE LECHE: CREMA DE LECHE']
            ];
            for (let i = 0; i < reglas.length; i++) {
                if (reglas[i][0].test(d)) return reglas[i][1];
            }
            const cod = String(getCodigo(item) || '').toUpperCase();
            if (/^(PROM|CBM|CMB)/.test(cod) || /\b(PROM|PROMO|CBM|CMB|COMBO)\b/.test(d)) {
                return 'PROMOS / COMBOS';
            }
            return 'SIN LÍNEA';
        }

        function construirHtmlReporteSistema() {
            // Stock del sistema: solo con stock > 0 · Fríos/Secos (Laive o por nombre) · luego línea
            const filtro = filtroTipoReporte || '';
            let items = (currentData || []).filter(function (item) {
                const activoItem = item.activo !== false && item.Activo !== false && item.ACTIVO !== false;
                if (!activoItem) return false;
                // Productos sin stock no figuran
                const stock = (typeof getCantidad === 'function') ? Number(getCantidad(item)) || 0 : 0;
                if (stock <= 0) return false;
                if (filtro) return getTipoAlmacenReporte(item) === filtro;
                return true;
            });

            if (!items.length) {
                return '<p class="admin-sesiones-empty">No hay productos con stock' +
                    (filtro ? ' en <strong>' + filtro + '</strong>' : '') +
                    '. Sube el Excel de existencias (cantidad &gt; 0).</p>';
            }

            // Agrupar: primero FRIOS/SECOS (bloques), luego por línea dentro de cada uno
            function agruparPorLinea(lista) {
                const gruposMap = {};
                lista.forEach(function (item) {
                    let lin = getLineaReporte(item);
                    if (!lin) lin = 'SIN LÍNEA';
                    if (!gruposMap[lin]) gruposMap[lin] = [];
                    gruposMap[lin].push(item);
                });
                return Object.keys(gruposMap).sort(function (a, b) {
                    if (a === 'SIN LÍNEA') return 1;
                    if (b === 'SIN LÍNEA') return -1;
                    if (a === 'PROMOS / COMBOS') return 1;
                    if (b === 'PROMOS / COMBOS') return -1;
                    return a.localeCompare(b, 'es');
                }).map(function (lin) {
                    const arr = gruposMap[lin].slice().sort(function (a, b) {
                        return String(getCodigo(a)).localeCompare(String(getCodigo(b)), 'es', { numeric: true });
                    });
                    return { linea: lin, items: arr };
                });
            }

            const bloques = [];
            if (filtro) {
                bloques.push({
                    titulo: (filtro === 'FRIOS' ? '❄️ FRÍOS' : '📦 SECOS') + ' · ' + items.length + ' productos',
                    grupos: agruparPorLinea(items),
                    esOtros: false
                });
            } else {
                const frios = items.filter(function (it) { return getTipoAlmacenReporte(it) === 'FRIOS'; });
                const secos = items.filter(function (it) { return getTipoAlmacenReporte(it) === 'SECOS'; });
                const otros = items.filter(function (it) {
                    const t = getTipoAlmacenReporte(it);
                    return t !== 'FRIOS' && t !== 'SECOS';
                });
                if (frios.length) bloques.push({ titulo: '❄️ FRÍOS · ' + frios.length + ' productos', grupos: agruparPorLinea(frios), esOtros: false });
                if (secos.length) bloques.push({ titulo: '📦 SECOS · ' + secos.length + ' productos', grupos: agruparPorLinea(secos), esOtros: false });
                if (otros.length) bloques.push({
                    titulo: '⚠️ SIN CLASIFICAR · ' + otros.length + ' productos',
                    grupos: agruparPorLinea(otros),
                    esOtros: true
                });
            }

            const tituloFiltro = filtro === 'FRIOS' ? 'FRÍOS' : (filtro === 'SECOS' ? 'SECOS' : 'TODOS (Fríos + Secos + sin tipo)');
            let html = '<div class="inv-preview-doc inv-report-almacen inv-report-sistema">';
            let n = 0, totalCajas = 0, totalUni = 0;
            // Cabecera simple para gerencia: logo + título + fecha
            html += '<header class="inv-preview-head inv-report-head">' +
                '<div class="inv-report-logo-wrap">' +
                '<img class="inv-report-logo" src="logo-iem.png" alt="IEM GROUP">' +
                '<p class="inv-preview-meta">' + new Date().toLocaleString('es-PE') + '</p>' +
                '</div>' +
                '<div class="inv-report-head-text">' +
                '<h1>REPORTE DE INVENTARIO POR ALMACÉN</h1>' +
                '</div></header>';

            bloques.forEach(function (bloque, idxBloque) {
                // SECOS / OTROS empiezan en hoja nueva (no dejan el título solo al final de Fríos)
                const breakCls = (idxBloque > 0) ? ' page-break-before' : '';
                html += '<div class="inv-report-tipo-block' + breakCls + '">';
                html += '<h2 class="inv-report-tipo-titulo' + (bloque.esOtros ? ' otros' : '') + '">' +
                    escapeHtmlSes(bloque.titulo) + '</h2>';
                (bloque.grupos || []).forEach(function (grupo) {
                    html += '<section class="inv-preview-linea"><h3 class="inv-preview-linea-h">' + escapeHtmlSes(grupo.linea) + '</h3>';
                    html += '<table class="inv-preview-table inv-report-table"><thead><tr>' +
                        '<th>Cod. Producto</th><th>Cod. Fábrica</th><th>Descripción</th>' +
                        '<th>Unidad</th><th class="num col-cajas">Cajas</th><th class="num col-sueltas">Sueltas</th>' +
                        '</tr></thead><tbody>';
                    (grupo.items || []).forEach(function (item) {
                        n++;
                        const cod = String(getCodigo(item) || '');
                        const factor = (typeof getFactorFinal === 'function') ? getFactorFinal(item) : (getFactorEmpaque(item) || 1);
                        const stock = (typeof getCantidad === 'function') ? getCantidad(item) : 0;
                        const cu = stockACajasUnidades(stock, factor);
                        totalCajas += cu.cajas;
                        totalUni += cu.unidades;
                        html += '<tr>' +
                            '<td class="mono">' + escapeHtmlSes(cod) + '</td>' +
                            '<td class="mono">' + escapeHtmlSes(getCodigoFabrica(item) || '') + '</td>' +
                            '<td>' + escapeHtmlSes(getDescripcion(item)) + '</td>' +
                            '<td>' + escapeHtmlSes(getUnidadRef(item) || '') + '</td>' +
                            '<td class="num">' + cu.cajas + '</td>' +
                            '<td class="num">' + cu.unidades + '</td>' +
                            '</tr>';
                    });
                    html += '</tbody></table></section>';
                });
                html += '</div>';
            });

            html += '<footer class="inv-preview-foot"><strong>TOTAL</strong> · Ítems: ' + n +
                ' · Cajas: ' + totalCajas + ' · Unidades sueltas: ' + totalUni +
                ' · (' + tituloFiltro + ')</footer></div>';
            return html;
        }

        function renderReporteSistema() {
            const box = document.getElementById('adminReportePreview');
            if (!box) return;
            box.innerHTML = construirHtmlReporteSistema();
        }

        function exportarReporteSistemaPDF() {
            if (!esAdmin()) {
                showToast('Solo el administrador puede exportar PDF.', 'error');
                return;
            }
            const contenido = construirHtmlReporteSistema();
            if (!contenido || contenido.indexOf('No hay productos') !== -1) {
                showToast('No hay productos para el PDF con el filtro actual.', 'error');
                return;
            }
            const titulo = 'REPORTE DE INVENTARIO POR ALMACÉN · SISTEMA' + (filtroTipoReporte ? ' · ' + filtroTipoReporte : '');
            abrirHtmlParaImprimir(titulo, '', contenido);
        }

        // Buscador admin de catálogo completo (existencias)
        function buscarCatalogoAdmin(term) {
            const list = document.getElementById('adminCatalogList');
            const countEl = document.getElementById('adminCatalogCount');
            if (!list) return;
            const soloCero = !!(document.getElementById('adminCatalogSoloCero') && document.getElementById('adminCatalogSoloCero').checked);
            const q = String(term || '').trim().toUpperCase();
            // Catálogo admin: TODOS los productos (con o sin stock). Nunca filtra stock salvo "solo sin stock".
            let base = (currentData || []).slice();
            if (soloCero) {
                base = base.filter(function (item) { return getCantidad(item) <= 0; });
            }
            if (!q) {
                if (soloCero) {
                    const hits0 = base.slice(0, 100);
                    if (countEl) countEl.textContent = String(base.length);
                    if (!hits0.length) {
                        list.innerHTML = '<p class="admin-sesiones-empty">No hay productos sin stock.</p>';
                        return;
                    }
                    list.innerHTML = hits0.map(function (item) {
                        return htmlCatalogoItemAdmin(item);
                    }).join('');
                    return;
                }
                list.innerHTML = '<p class="admin-sesiones-empty">Escribe un código o nombre para buscar.<br><br><strong>Para editar la URL de imagen:</strong> busca el producto y en cada resultado verás el campo de URL + botón «Guardar imagen».</p>';
                if (countEl) countEl.textContent = String((currentData || []).length);
                return;
            }
            const palabras = q.split(/\s+/).filter(Boolean);
            const hits = base.filter(function (item) {
                const campos = [
                    getCodigo(item), getCodigoFabrica(item), getDescripcion(item),
                    getLinea(item), getMarca(item), getUnidadRef(item)
                ].map(function (x) { return String(x || '').toUpperCase(); });
                return palabras.every(function (p) {
                    return campos.some(function (c) { return c.indexOf(p) !== -1; });
                });
            }).slice(0, 80);
            if (countEl) countEl.textContent = String(hits.length) + (hits.length >= 80 ? '+' : '');
            if (!hits.length) {
                list.innerHTML = '<p class="admin-sesiones-empty">Sin coincidencias en el catálogo.</p>';
                return;
            }
            list.innerHTML = hits.map(function (item) {
                return htmlCatalogoItemAdmin(item);
            }).join('');
        }

        function htmlCatalogoItemAdmin(item) {
            const cod = escapeHtmlSes(getCodigo(item));
            const desc = escapeHtmlSes(getDescripcion(item));
            const lin = escapeHtmlSes(getLinea(item) || '-');
            const mar = escapeHtmlSes(getMarca(item) || '-');
            const cant = getCantidad(item);
            const imgUrl = getImagenUrl(item);
            const activoItem = item.activo !== false && item.Activo !== false;
            const stockClass = cant <= 0 ? ' stock-cero' : '';
            const estado = activoItem ? '' : ' · <span style="color:#f59e0b">Inactivo</span>';
            const imgHtml = imgUrl
                ? '<img class="aci-img" src="' + escapeHtmlSes(imgUrl) + '" alt="" width="48" height="48" loading="lazy" decoding="async" fetchpriority="low" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">'
                : '<span class="aci-img aci-img-ph" aria-hidden="true">📦</span>';
            return '<div class="admin-catalog-item' + stockClass + '" data-codigo="' + cod + '">' +
                imgHtml +
                '<div class="aci-body">' +
                '<div class="aci-cod">' + cod + '</div>' +
                '<div class="aci-desc">' + desc + '</div>' +
                '<div class="aci-meta">Línea: ' + lin + ' · Marca: ' + mar +
                ' · Stock: <strong>' + cant + '</strong>' + estado + '</div>' +
                '<div class="aci-img-row">' +
                '<input type="url" class="aci-img-input" data-codigo="' + cod + '" placeholder="URL de imagen (https://...)" value="' + escapeHtmlSes(imgUrl) + '">' +
                '<button type="button" class="btn btn-sm btn-primary aci-img-save" data-codigo="' + cod + '">Guardar imagen</button>' +
                (imgUrl ? '<button type="button" class="btn btn-sm btn-danger aci-img-clear" data-codigo="' + cod + '" title="Quitar imagen">✕</button>' : '') +
                '</div></div></div>';
        }

        async function guardarImagenProductoAdmin(codigo, urlNueva) {
            if (!esAdmin()) {
                showToast('Solo el administrador puede editar imágenes.', 'error');
                return false;
            }
            const cod = String(codigo || '').trim();
            if (!cod) return false;
            const url = String(urlNueva || '').trim();
            if (url && !/^https?:\/\//i.test(url)) {
                showToast('La URL debe empezar con http:// o https://', 'error');
                return false;
            }
            try {
                const { error } = await supabaseClient
                    .from('productos')
                    .update({ imagen_url: url || null })
                    .eq('codigo', cod);
                if (error) throw error;
                // Actualizar en memoria
                (currentData || []).forEach(function (item) {
                    if (String(getCodigo(item) || '') === cod) {
                        item.imagen_url = url;
                        item.ImagenUrl = url;
                    }
                });
                if (window._mapCodigo && window._mapCodigo[cod.toUpperCase()]) {
                    window._mapCodigo[cod.toUpperCase()].imagen_url = url;
                    window._mapCodigo[cod.toUpperCase()].ImagenUrl = url;
                }
                showToast(url ? 'Imagen actualizada.' : 'Imagen eliminada.', 'success');
                // Refrescar lista admin si está abierta
                const inp = document.getElementById('adminCatalogInput');
                if (typeof buscarCatalogoAdmin === 'function') {
                    buscarCatalogoAdmin(inp ? inp.value : '');
                }
                // Refrescar resultados de búsqueda principal si hay
                if (typeof filteredData !== 'undefined' && filteredData && filteredData.length && typeof renderResults === 'function') {
                    renderResults(filteredData);
                }
                return true;
            } catch (e) {
                console.error('guardarImagenProductoAdmin', e);
                showToast('No se pudo guardar: ' + ((e && e.message) || e), 'error');
                return false;
            }
        }

        /**
         * Busca imágenes en el catálogo público mayorista Laive (WooCommerce)
         * y rellena imagen_url solo en productos que aún no tienen imagen.
         * Empareja por codigo_fabrica === SKU del mayorista.
         */
        async function buscarImagenesFaltantesLaive() {
            if (!esAdmin()) {
                showToast('Solo el administrador puede buscar imágenes.', 'error');
                return;
            }
            if (!supabaseClient) {
                showToast('Sin conexión a Supabase.', 'error');
                return;
            }
            const statusEl = document.getElementById('adminImgBuscarStatus');
            const btn = document.getElementById('btnBuscarImagenesLaive');
            function setStatus(t) { if (statusEl) statusEl.textContent = t || ''; }
            if (btn) { btn.disabled = true; btn.textContent = 'Buscando…'; }
            setStatus('Descargando catálogo mayorista Laive…');
            try {
                const mapSkuImg = Object.create(null);
                let page = 1;
                let totalPages = 1;
                while (page <= totalPages && page <= 20) {
                    const res = await fetch('https://mayorista.laive.pe/wp-json/wc/store/v1/products?per_page=100&page=' + page);
                    if (!res.ok) throw new Error('Mayorista respondió ' + res.status);
                    const totalH = res.headers.get('X-WP-TotalPages');
                    if (totalH) totalPages = parseInt(totalH, 10) || totalPages;
                    const lista = await res.json();
                    if (!Array.isArray(lista) || !lista.length) break;
                    lista.forEach(function (p) {
                        const sku = String(p.sku || '').trim();
                        const src = p.images && p.images[0] && p.images[0].src ? String(p.images[0].src).trim() : '';
                        if (sku && src && /^https?:\/\//i.test(src)) {
                            mapSkuImg[sku] = src;
                        }
                    });
                    setStatus('Catálogo mayorista: página ' + page + '/' + totalPages + ' · ' + Object.keys(mapSkuImg).length + ' con imagen');
                    page += 1;
                }
                const nCatalogo = Object.keys(mapSkuImg).length;
                if (!nCatalogo) {
                    showToast('No se obtuvieron imágenes del mayorista.', 'error');
                    setStatus('');
                    return;
                }

                const sinImg = (currentData || []).filter(function (item) {
                    return !getImagenUrl(item);
                });
                setStatus('Emparejando ' + sinImg.length + ' sin imagen con ' + nCatalogo + ' del mayorista…');

                let actualizados = 0;
                let sinMatch = 0;
                const BATCH = 15;
                const pendientes = [];
                sinImg.forEach(function (item) {
                    const fab = String(getCodigoFabrica(item) || '').trim();
                    const url = fab && mapSkuImg[fab] ? mapSkuImg[fab] : '';
                    if (!url) { sinMatch++; return; }
                    pendientes.push({ codigo: String(getCodigo(item) || '').trim(), url: url, item: item });
                });

                for (let i = 0; i < pendientes.length; i += BATCH) {
                    const chunk = pendientes.slice(i, i + BATCH);
                    await Promise.all(chunk.map(async function (row) {
                        if (!row.codigo) return;
                        let { error } = await supabaseClient
                            .from('productos')
                            .update({ imagen_url: row.url })
                            .eq('codigo', row.codigo);
                        if (error) {
                            console.warn('No se actualizó', row.codigo, error);
                            return;
                        }
                        row.item.imagen_url = row.url;
                        row.item.ImagenUrl = row.url;
                        const k = row.codigo.toUpperCase();
                        if (window._mapCodigo && window._mapCodigo[k]) {
                            window._mapCodigo[k].imagen_url = row.url;
                            window._mapCodigo[k].ImagenUrl = row.url;
                        }
                        actualizados++;
                    }));
                    setStatus('Guardando en Supabase… ' + actualizados + '/' + pendientes.length);
                }

                const msg = 'Listo: ' + actualizados + ' imágenes nuevas. Sin coincidencia SKU: ' + sinMatch + '. Catálogo Laive: ' + nCatalogo + '.';
                setStatus(msg);
                showToast(msg, actualizados ? 'success' : 'info');
                const inp = document.getElementById('adminCatalogInput');
                if (typeof buscarCatalogoAdmin === 'function') {
                    buscarCatalogoAdmin(inp ? inp.value : '');
                }
                if (typeof filteredData !== 'undefined' && filteredData && filteredData.length && typeof renderResults === 'function') {
                    renderResults(filteredData);
                }
            } catch (e) {
                console.error('buscarImagenesFaltantesLaive', e);
                setStatus('Error: ' + ((e && e.message) || e));
                showToast('No se pudo buscar imágenes: ' + ((e && e.message) || e), 'error');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = '🔍 Buscar imágenes faltantes (Laive)';
                }
            }
        }

        async function borrarTodasImagenesAdmin() {
            if (!esAdmin()) {
                showToast('Solo el administrador puede borrar imágenes.', 'error');
                return;
            }
            if (!supabaseClient) {
                showToast('Sin conexión a Supabase.', 'error');
                return;
            }
            const ok1 = await confirmarAccion(
                '⚠️ ¿Borrar TODAS las imágenes del catálogo?\n\nSe vaciará imagen_url en todos los productos. Esta acción no se puede deshacer desde la app.',
                'Continuar',
                'danger'
            );
            if (!ok1) return;
            const ok2 = await confirmarAccion(
                'Última confirmación: se borrarán las URLs de imagen de TODOS los productos. ¿Seguro?',
                'Sí, borrar todas',
                'danger'
            );
            if (!ok2) return;
            const btn = document.getElementById('btnBorrarTodasImagenes');
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Borrando...';
            }
            try {
                // PostgREST exige un filtro en UPDATE masivo; neq codigo '' cubre todas las filas con código
                const { data, error } = await supabaseClient
                    .from('productos')
                    .update({ imagen_url: null })
                    .neq('codigo', '')
                    .select('codigo');
                if (error) throw error;
                const n = Array.isArray(data) ? data.length : 0;
                (currentData || []).forEach(function (item) {
                    item.imagen_url = '';
                    item.ImagenUrl = '';
                });
                if (window._mapCodigo) {
                    Object.keys(window._mapCodigo).forEach(function (k) {
                        if (window._mapCodigo[k]) {
                            window._mapCodigo[k].imagen_url = '';
                            window._mapCodigo[k].ImagenUrl = '';
                        }
                    });
                }
                showToast(n ? ('Se borraron las imágenes de ' + n + ' productos.') : 'Imágenes borradas.', 'success');
                const inp = document.getElementById('adminCatalogInput');
                if (typeof buscarCatalogoAdmin === 'function') {
                    buscarCatalogoAdmin(inp ? inp.value : '');
                }
                if (typeof filteredData !== 'undefined' && filteredData && filteredData.length && typeof renderResults === 'function') {
                    renderResults(filteredData);
                }
            } catch (e) {
                console.error('borrarTodasImagenesAdmin', e);
                showToast('No se pudo borrar: ' + ((e && e.message) || e), 'error');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = '🗑️ Borrar todas las imágenes';
                }
            }
        }

        // ============================================================
        // GUARDAR INVENTARIO EN DRIVE
        // ============================================================
        function guardarInventarioDrive() {
            showToast('El inventario compartido ya está en la nube (Supabase). Use Excel para descargar una copia.', 'info');
        }



        /** Productos mal cargados: codigo = SAP (7+ dígitos). No son Uniflex. */
        function esCodigoErroneoTipoSap(c) {
            c = String(c || '').trim();
            return /^\d{7,}$/.test(c);
        }

        async function limpiarCodigosSapComoProducto() {
            if (!esAdmin()) {
                showToast('Solo administrador.', 'error');
                return;
            }
            if (!supabaseClient) {
                showToast('Sin Supabase.', 'error');
                return;
            }
            const ok = await confirmarAccion(
                'Se desactivarán (activo=false) productos cuyo CÓDIGO es en realidad un SAP de 7+ dígitos (ej. 50001363).\n\nLos Uniflex 0589/0591 no se tocan; solo entradas erróneas.\n¿Continuar?',
                'Limpiar códigos SAP',
                'danger'
            );
            if (!ok) return;
            try {
                let from = 0;
                const PAGE = 1000;
                const malos = [];
                for (;;) {
                    const { data, error } = await supabaseClient
                        .from('productos')
                        .select('codigo,codigo_fabrica,descripcion,activo')
                        .order('codigo')
                        .range(from, from + PAGE - 1);
                    if (error) throw error;
                    if (!data || !data.length) break;
                    data.forEach(function (p) {
                        if (esCodigoErroneoTipoSap(p.codigo)) malos.push(String(p.codigo));
                    });
                    if (data.length < PAGE) break;
                    from += PAGE;
                }
                if (!malos.length) {
                    showToast('No hay códigos tipo SAP como producto.', 'success');
                    return;
                }
                let n = 0;
                for (let i = 0; i < malos.length; i += 50) {
                    const chunk = malos.slice(i, i + 50);
                    const { error } = await supabaseClient
                        .from('productos')
                        .update({ activo: false, actualizado_en: new Date().toISOString() })
                        .in('codigo', chunk);
                    if (error) console.warn(error);
                    else n += chunk.length;
                }
                // Quitar de memoria
                if (Array.isArray(currentData)) {
                    currentData = currentData.filter(function (it) {
                        return !esCodigoErroneoTipoSap(getCodigo(it));
                    });
                    if (typeof actualizarEstadoCatalogo === 'function') actualizarEstadoCatalogo();
                }
                showToast('Desactivados ' + n + ' productos con código tipo SAP (erróneos).', 'success');
            } catch (e) {
                showToast('Error: ' + (e.message || e), 'error');
            }
        }


        function iemMesActualKey() {
            var d = new Date();
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        }

        function iemBackupFlagKey(mes) {
            return 'iem_zip_descargado_' + (mes || iemMesActualKey());
        }

        function actualizarEstadoRespaldoUI() {
            var el = document.getElementById('iemBackupStatus');
            if (!el) return;
            var mes = iemMesActualKey();
            var ok = false;
            try { ok = localStorage.getItem(iemBackupFlagKey(mes)) === '1'; } catch (e) {}
            el.textContent = ok
                ? ('✓ Respaldo de ' + mes + ' descargado. Conteos de meses anteriores ya pueden haberse limpiado en Supabase.')
                : ('Pendiente: descarga Excel sistema (último del día) + conteo. Luego la nube se limpia sola al usar «Ambos + limpiar».');
        }

        /** Descarga ZIP filtrado. tipos: null=todos, 'excel_subido', 'conteo_fisico' */
        async function descargarZipMesFiltrado(mesKey, tipos, nombreZip) {
            var lista = await iemIdbGetByMes(mesKey);
            if (!lista.length) return { ok: false, motivo: 'sin_local' };
            var byDayExcel = {};
            var otros = [];
            lista.forEach(function (r) {
                if (tipos && tipos.indexOf(r.tipo) === -1) return;
                if (r.tipo === 'excel_subido') {
                    var prev = byDayExcel[r.dia];
                    if (!prev || (r.ts || 0) > (prev.ts || 0)) byDayExcel[r.dia] = r;
                } else {
                    otros.push(r);
                }
            });
            var finalList = otros.concat(Object.keys(byDayExcel).map(function (k) { return byDayExcel[k]; }));
            if (!finalList.length) return { ok: false, motivo: 'sin_tipo' };
            try {
                await ensureJSZip();
            } catch (eZip) {
                // fallback: último archivo suelto
                var last = finalList[finalList.length - 1];
                var url0 = URL.createObjectURL(last.blob);
                var a0 = document.createElement('a');
                a0.href = url0;
                a0.download = last.nombre || 'respaldo.xlsx';
                a0.click();
                setTimeout(function () { URL.revokeObjectURL(url0); }, 2000);
                return { ok: true, n: 1 };
            }
            var zip = new JSZip();
            var folderExcel = zip.folder('excel_sistema');
            var folderConteo = zip.folder('conteo_fisico');
            finalList.forEach(function (r) {
                var folder = (r.tipo === 'excel_subido') ? folderExcel : folderConteo;
                folder.file(r.nombre || (r.id + '.xlsx'), r.blob);
            });
            var out = await zip.generateAsync({ type: 'blob' });
            var url = URL.createObjectURL(out);
            var a = document.createElement('a');
            a.href = url;
            a.download = nombreZip || ('IEM_respaldos_' + mesKey + '.zip');
            a.click();
            setTimeout(function () { URL.revokeObjectURL(url); }, 2500);
            return { ok: true, n: finalList.length };
        }

        /** Exporta conteo actual desde memoria/nube a un Excel y lo guarda en respaldo. */
        async function generarExcelConteoActual() {
            if (typeof inventarioFisico === 'undefined' || !inventarioFisico || !inventarioFisico.length) {
                // intentar desde lotes en nube
                if (supabaseClient) {
                    try {
                        var { data } = await supabaseClient.from('lotes_conteo').select('*').limit(5000);
                        if (data && data.length && typeof exportarInventario === 'function') {
                            // no re-enter full export; build minimal sheet
                        }
                    } catch (e) {}
                }
                return null;
            }
            // Reutilizar estructura simple
            var filas = [['Código', 'Descripción', 'Stock físico', 'Fecha']];
            inventarioFisico.forEach(function (d) {
                filas.push([
                    d.codigo || '',
                    d.descripcion || '',
                    d.stockFisico != null ? d.stockFisico : (d.cantidad || ''),
                    d.fecha || ''
                ]);
            });
            try { await ensureXlsx(); } catch (eX) { return null; }
            var wb = XLSX.utils.book_new();
            var ws = XLSX.utils.aoa_to_sheet(filas);
            XLSX.utils.book_append_sheet(wb, ws, 'Conteo');
            var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            await guardarRespaldoMensual('conteo_fisico', wbout, 'conteo_fisico');
            return true;
        }

        async function descargarExcelSistemaUI() {
            if (!esAdmin()) { showToast('Solo administrador.', 'error'); return; }
            var mes = iemMesActualKey();
            var r = await descargarZipMesFiltrado(mes, ['excel_subido'], 'IEM_excel_sistema_' + mes + '.zip');
            if (!r.ok) {
                showToast('No hay Excel de sistema respaldado este mes. Sube el Excel de existencias/valorado primero.', 'info');
                return;
            }
            try { localStorage.setItem(iemBackupFlagKey(mes), '1'); } catch (e) {}
            actualizarEstadoRespaldoUI();
            showToast('Excel del sistema descargado (solo último de cada día).', 'success');
        }

        async function descargarConteoMesUI() {
            if (!esAdmin()) { showToast('Solo administrador.', 'error'); return; }
            var mes = iemMesActualKey();
            var r = await descargarZipMesFiltrado(mes, ['conteo_fisico'], 'IEM_conteo_' + mes + '.zip');
            if (!r.ok) {
                // intentar generar desde conteo en pantalla
                try {
                    if (typeof exportarInventario === 'function') {
                        showToast('Generando conteo desde datos actuales…', 'info');
                        await exportarInventario();
                        r = await descargarZipMesFiltrado(mes, ['conteo_fisico'], 'IEM_conteo_' + mes + '.zip');
                    }
                } catch (e) {}
            }
            if (!r.ok) {
                showToast('No hay conteo respaldado. Exporta el inventario físico o envía conteo a la nube y vuelve a intentar.', 'info');
                return;
            }
            try { localStorage.setItem(iemBackupFlagKey(mes), '1'); } catch (e) {}
            actualizarEstadoRespaldoUI();
            showToast('Conteo del mes descargado.', 'success');
        }

        /** Borra lotes_conteo anteriores al mes actual (sin preguntar). */
        async function limpiarConteosMesesAnterioresAuto() {
            if (!supabaseClient) return { ok: false };
            var mes = iemMesActualKey();
            var parts = mes.split('-');
            var inicioMes = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
            var corteISO = inicioMes.toISOString();
            try {
                var { data, error } = await supabaseClient
                    .from('lotes_conteo')
                    .delete()
                    .lt('created_at', corteISO)
                    .select('id');
                if (error) {
                    var { data: all, error: e2 } = await supabaseClient
                        .from('lotes_conteo')
                        .select('id,created_at,fechaISO')
                        .limit(5000);
                    if (e2) throw e2;
                    var ids = (all || []).filter(function (r) {
                        var t = r.created_at || r.fechaISO;
                        return t && new Date(t).getTime() < inicioMes.getTime();
                    }).map(function (r) { return r.id; });
                    var n = 0;
                    for (var i = 0; i < ids.length; i += 50) {
                        var chunk = ids.slice(i, i + 50);
                        var { error: e3 } = await supabaseClient.from('lotes_conteo').delete().in('id', chunk);
                        if (!e3) n += chunk.length;
                    }
                    return { ok: true, n: n };
                }
                return { ok: true, n: Array.isArray(data) ? data.length : 0 };
            } catch (e) {
                console.warn('auto clean', e);
                return { ok: false, error: e };
            }
        }

        async function descargarAmbosYLimpiarUI() {
            if (!esAdmin()) { showToast('Solo administrador.', 'error'); return; }
            var mes = iemMesActualKey();
            showToast('Descargando Excel sistema + conteo…', 'info');
            var r1 = await descargarZipMesFiltrado(mes, ['excel_subido'], 'IEM_excel_sistema_' + mes + '.zip');
            await new Promise(function (res) { setTimeout(res, 600); });
            var r2 = await descargarZipMesFiltrado(mes, ['conteo_fisico'], 'IEM_conteo_' + mes + '.zip');
            if (!r1.ok && !r2.ok) {
                showToast('No hay respaldos locales este mes. Sube Excel del sistema y/o exporta el conteo primero.', 'error');
                return;
            }
            try { localStorage.setItem(iemBackupFlagKey(mes), '1'); } catch (e) {}
            var clean = await limpiarConteosMesesAnterioresAuto();
            actualizarEstadoRespaldoUI();
            var msg = 'Descarga lista.';
            if (r1.ok) msg += ' Excel sistema ✓';
            if (r2.ok) msg += ' Conteo ✓';
            if (clean.ok) msg += ' Nube: conteos de meses anteriores eliminados (' + (clean.n || 0) + ').';
            else msg += ' (no se pudo limpiar nube automáticamente)';
            showToast(msg, 'success');
        }

        async function descargarZipMesActualDesdeUI() {
            return descargarAmbosYLimpiarUI();
        }

        function marcarZipMesDescargado() {
            var mes = iemMesActualKey();
            try { localStorage.setItem(iemBackupFlagKey(mes), '1'); } catch (e) {}
            showToast('Marcado: respaldo de ' + mes + ' guardado.', 'success');
            actualizarEstadoRespaldoUI();
        }

        async function limpiarConteosMesesAnteriores() {
            if (!esAdmin()) { showToast('Solo administrador.', 'error'); return; }
            var clean = await limpiarConteosMesesAnterioresAuto();
            if (clean.ok) showToast('Conteos de meses anteriores eliminados: ' + (clean.n || 0), 'success');
            else showToast('No se pudo limpiar la nube.', 'error');
        }

        // ============================================================
        // LIMPIAR INVENTARIO
        // ============================================================
        function limpiarInventario() {
            if (!esAdmin()) {
                showToast('Solo el administrador puede limpiar el inventario.', 'error');
                return;
            }
            if (inventarioFisico.length === 0) return;
            confirmarAccion('¿Eliminar todos los registros del inventario físico? Esto también borra el conteo compartido en la nube para todos los celulares.').then(ok => {
                if (!ok) return;
                inventarioFisico = [];
                saveInventario();
                renderInventario();
                supabaseClient.from('lotes_conteo').delete().neq('id', '')
                    .then(({ error }) => { if (error) console.warn('No se pudo limpiar nube:', error); });
                showToast('Inventario limpiado (local y compartido).', 'info');
            });
        }

        // ============================================================
        // TEMA DÍA / NOCHE
        // ============================================================
        const THEME_KEY = 'buscador_tema';
        const themeToggleBtn = document.getElementById('themeToggleBtn');

        function aplicarTema(tema) {
            var esClaro = (tema === 'light');
            document.body.classList.toggle('light-theme', esClaro);
            try { document.documentElement.classList.toggle('light-theme', esClaro); } catch (e) {}
            try { document.documentElement.setAttribute('data-theme', esClaro ? 'light' : 'dark'); } catch (e) {}
            var icono = esClaro ? '☀️' : '🌙';
            if (themeToggleBtn) themeToggleBtn.textContent = icono;
            var loginThemeBtn = document.getElementById('loginThemeToggleBtn');
            if (loginThemeBtn) loginThemeBtn.textContent = icono;
            // Actualizar color de la barra de estado (status bar)
            try {
                var meta = document.getElementById('metaThemeColor') || document.querySelector('meta[name="theme-color"]');
                if (meta) meta.setAttribute('content', esClaro ? '#3B6EA5' : '#0f172a');
            } catch (e) {}
            // Forzar repaint del overlay de login (fondo malla)
            var ov = document.getElementById('loginOverlay');
            if (ov) {
                void ov.offsetWidth;
            }
        }

        function cargarTema() {
            let tema = 'dark';
            try { tema = localStorage.getItem(THEME_KEY) || 'dark'; } catch(e) {}
            aplicarTema(tema);
        }

        function alternarTema() {
            const esClaro = document.body.classList.contains('light-theme');
            const nuevo = esClaro ? 'dark' : 'light';
            aplicarTema(nuevo);
            try { localStorage.setItem(THEME_KEY, nuevo); } catch(e) {}
        }

        // Tema global desde el login (como ventas): no esperar a init/sesión
        function cablearBotonesTema() {
            var btnApp = document.getElementById('themeToggleBtn');
            var btnLogin = document.getElementById('loginThemeToggleBtn');
            if (btnApp && !btnApp._temaOk) {
                btnApp.addEventListener('click', alternarTema);
                btnApp._temaOk = true;
            }
            if (btnLogin && !btnLogin._temaOk) {
                btnLogin.addEventListener('click', alternarTema);
                btnLogin._temaOk = true;
            }
        }
        try { cargarTema(); } catch (e) {}
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                try { cargarTema(); } catch (e) {}
                cablearBotonesTema();
            });
        } else {
            cablearBotonesTema();
        }

        // ============================================================
        // INICIALIZACIÓN
        // ============================================================
        // TARJETAS PLEGABLES (Inventario Físico / Sugerencia de Pedido)
        // ============================================================
        // En escritorio quedan siempre abiertas. En móvil arrancan
        // cerradas para no saturar la pantalla, y se abren solas en
        // cuanto hay algo que mostrar (o al tocar el título).
        const CARDS_PLEGABLES = {
            diff: { header: 'diffCardHeader', body: 'diffCardBody' },
            pedido: { header: 'pedidoCardHeader', body: 'pedidoCardBody' }
        };
        function esMovil() {
            return window.matchMedia('(max-width: 959px)').matches;
        }
        function setCardExpandida(nombre, expandida) {
            const cfg = CARDS_PLEGABLES[nombre];
            if (!cfg) return;
            const header = document.getElementById(cfg.header);
            const body = document.getElementById(cfg.body);
            if (!header || !body) return;
            body.classList.toggle('is-collapsed', !expandida);
            header.setAttribute('aria-expanded', expandida ? 'true' : 'false');
            // Ocultar de verdad el cuerpo (evita capa invisible que captura toques)
            if (nombre === 'diff') {
                // Mientras cuentas un producto: inventario SIEMPRE cerrado e inaccesible
                if (document.body.classList.contains('modo-seleccion')) {
                    expandida = false;
                }
                if (expandida) {
                    body.style.removeProperty('display');
                    body.style.removeProperty('pointer-events');
                    body.style.removeProperty('height');
                    body.style.removeProperty('max-height');
                    body.style.removeProperty('overflow');
                    body.style.removeProperty('visibility');
                } else {
                    body.style.setProperty('display', 'none', 'important');
                    body.style.setProperty('pointer-events', 'none', 'important');
                    body.style.setProperty('height', '0', 'important');
                    body.style.setProperty('max-height', '0', 'important');
                    body.style.setProperty('overflow', 'hidden', 'important');
                    body.style.setProperty('visibility', 'hidden', 'important');
                }
                try {
                    document.body.classList.toggle('inv-fisico-abierto', !!expandida);
                    if (typeof window.__iemAjustarScrollInventario === 'function') {
                        window.__iemAjustarScrollInventario();
                    }
                } catch (e) {}
            }
        }

        /** Scroll táctil de la lista contada (sin forzar la tarjeta abierta). */
        window.__iemAjustarScrollInventario = function () {
            try {
                var body = document.getElementById('diffCardBody');
                var hdr = document.getElementById('diffCardHeader');
                var ml = document.getElementById('diffMobileList');
                if (!ml) return;
                var abierta = hdr && hdr.getAttribute('aria-expanded') === 'true'
                    && body && !body.classList.contains('is-collapsed');
                ml.style.setProperty('pointer-events', 'auto', 'important');
                ml.style.setProperty('touch-action', 'pan-y', 'important');
                ml.style.setProperty('position', 'relative', 'important');
                ml.style.setProperty('z-index', '22', 'important');
                if (abierta) {
                    // Casi pantalla completa para revisar todo el conteo
                    ml.style.setProperty('max-height', 'min(78vh, 720px)', 'important');
                    ml.style.setProperty('overflow-y', 'auto', 'important');
                    ml.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
                } else {
                    ml.style.removeProperty('max-height');
                    ml.style.removeProperty('overflow-y');
                }
                if (body) body.style.setProperty('pointer-events', 'auto', 'important');
            } catch (e) {}
        };
        function toggleCard(nombre) {
            const cfg = CARDS_PLEGABLES[nombre];
            if (!cfg) return;
            const header = document.getElementById(cfg.header);
            const expandidaAhora = header.getAttribute('aria-expanded') === 'true';
            setCardExpandida(nombre, !expandidaAhora);
        }
        // Colapsa la tarjeta solo si estamos en móvil (en PC se deja abierta siempre).
        function collapseCardEnMovil(nombre) {
            if (esMovil()) setCardExpandida(nombre, false);
        }
        // Expande la tarjeta cuando aparece contenido nuevo, solo si estaba cerrada.
        function expandCardSiHaceFalta(nombre) {
            const cfg = CARDS_PLEGABLES[nombre];
            if (!cfg) return;
            // Inventario físico: NUNCA se abre solo. El usuario maximiza cuando quiere revisar/editar.
            if (nombre === 'diff') return;
            // Pedido u otras tarjetas: abrir solo si no estás contando
            if (document.body.classList.contains('modo-seleccion')) return;
            const header = document.getElementById(cfg.header);
            if (header && header.getAttribute('aria-expanded') !== 'true') {
                setCardExpandida(nombre, true);
            }
        }
        function initCardsPlegables() {
            Object.keys(CARDS_PLEGABLES).forEach(nombre => {
                const cfg = CARDS_PLEGABLES[nombre];
                const header = document.getElementById(cfg.header);
                if (!header) return;
                header.addEventListener('click', function (ev) {
                    if (document.body.classList.contains('calc-open')) return;
                    // En tarjeta de producto no se puede abrir inventario (evita toques accidentales)
                    if (nombre === 'diff' && document.body.classList.contains('modo-seleccion')) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        return;
                    }
                    if (ev.target && ev.target.closest && ev.target.closest('#fabCalc, .fab-calc, #calcOverlay')) return;
                    ev.preventDefault();
                    ev.stopPropagation();
                    toggleCard(nombre);
                });
                header.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleCard(nombre);
                    }
                });
                // Estado inicial: cerradas en móvil (y tablet), abiertas en escritorio.
                setCardExpandida(nombre, !esMovil());
            });
        }


        function parseFactorDesdeTexto(texto) {
            if (texto === null || texto === undefined || texto === '') return 1;
            const n = Number(texto);
            if (!isNaN(n) && n > 0) return n;
            const s = String(texto);
            // Formatos tipo CJ*12/BAR, PAQ*24/VAS, BOL*10/BOL
            let m = s.match(/[*xX]\s*(\d+)/);
            if (m) return Number(m[1]) || 1;
            m = s.match(/(\d+)\s*$/);
            return m ? Number(m[1]) : 1;
        }

        // Stock tipo "5/0" o "5/18" (cajas/unidades) → total en unidades
        function parseStockFisicoTexto(texto, factor) {
            if (texto === null || texto === undefined || texto === '') return 0;
            const n = Number(texto);
            if (!isNaN(n)) return n;
            const s = String(texto).trim();
            const m = s.match(/^(-?\d+(?:[.,]\d+)?)\s*[\/]\s*(-?\d+(?:[.,]\d+)?)/);
            if (m) {
                const cajas = Number(String(m[1]).replace(',', '.')) || 0;
                const unid = Number(String(m[2]).replace(',', '.')) || 0;
                const f = factor > 0 ? factor : 1;
                return (cajas * f) + unid;
            }
            const solo = s.match(/-?\d+(?:[.,]\d+)?/);
            return solo ? Number(solo[0].replace(',', '.')) || 0 : 0;
        }

        function normalizarClaveCol(s) {
            return String(s || '')
                .trim()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // quita tildes
                .replace(/[\s._\-]+/g, '');
        }

        function valorColumna(row, nombres) {
            if (!row || typeof row !== 'object') return '';
            // Coincidencia exacta
            for (const n of nombres) {
                if (row[n] !== undefined && row[n] !== null && String(row[n]).trim() !== '') {
                    return row[n];
                }
            }
            // Coincidencia sin importar mayúsculas / tildes / espacios
            const mapa = {};
            Object.keys(row).forEach(function (k) {
                mapa[normalizarClaveCol(k)] = k;
            });
            for (const n of nombres) {
                const real = mapa[normalizarClaveCol(n)];
                if (real !== undefined && row[real] !== undefined && row[real] !== null && String(row[real]).trim() !== '') {
                    return row[real];
                }
            }
            // Columnas sin nombre (primera columna = descripción en existencias)
            for (const k of Object.keys(row)) {
                if (/^__EMPTY/i.test(k) || k === '' || k === 'null' || k === 'undefined') {
                    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
                        return row[k];
                    }
                }
            }
            return '';
        }


        /** Lee filas de Excel detectando la fila de encabezados (títulos Laive, existencias, etc.). */
        function leerFilasExcel(hoja) {
            const raw = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '' });
            if (!raw || !raw.length) return [];
            let headerIdx = 0;
            const maxScan = Math.min(20, raw.length);
            for (let i = 0; i < maxScan; i++) {
                const cells = (raw[i] || []).map(function (c) {
                    return String(c || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                });
                const joined = cells.join('|');
                if (
                    joined.indexOf('CODIGO SAP') !== -1 ||
                    joined.indexOf('CODIGO UNIFLEX') !== -1 ||
                    joined.indexOf('INVENTARIOPRODUCTOCODIGO') !== -1 ||
                    (cells.some(function (c) { return c === 'CODIGO' || c === 'CODIGO'; }) &&
                     cells.some(function (c) { return c.indexOf('DESCRIP') !== -1 || c.indexOf('PRODUCTO') !== -1 || c.indexOf('NOMBRE') !== -1; }))
                ) {
                    headerIdx = i;
                    break;
                }
            }
            const headers = (raw[headerIdx] || []).map(function (h, j) {
                const t = String(h || '').trim();
                // Existencias: la 1.ª columna suele ser el NOMBRE del producto
                // con encabezado vacío o solo un espacio. Si se omite, la
                // descripción se pierde y se toma Unidad Ref / código fábrica.
                if (!t) return j === 0 ? 'Producto' : ('__EMPTY_' + j);
                return t;
            });
            const filas = [];
            for (let r = headerIdx + 1; r < raw.length; r++) {
                const line = raw[r] || [];
                const obj = {};
                let vacia = true;
                headers.forEach(function (h, j) {
                    if (!h) return;
                    const v = line[j];
                    obj[h] = v;
                    if (v !== undefined && v !== null && String(v).trim() !== '') vacia = false;
                });
                if (!vacia) filas.push(obj);
            }
            return filas;
        }

        function keysExcelNorm(filas) {
            if (!filas || !filas.length) return [];
            return Object.keys(filas[0] || {}).map(function (k) {
                return String(k).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s._\-]+/g, '');
            });
        }

        function esExcelLaive(filas) {
            const keys = keysExcelNorm(filas);
            return keys.some(function (k) {
                return k.indexOf('CODIGOSAP') !== -1 || k.indexOf('CODIGOUNIFLEX') !== -1 || k === 'CODIGOSAP' || k === 'CODIGOUNIFLEX';
            });
        }

        /** Detecta los 3 Excel de IEM: existencias | valorado | laive */
        function detectarTipoExcel(filas) {
            if (esExcelLaive(filas)) return 'laive';
            const keys = keysExcelNorm(filas);
            const has = function (frag) {
                return keys.some(function (k) { return k.indexOf(frag) !== -1; });
            };
            // Inventario valorado por almacén
            if (has('INVENTARIOPRODUCTOCODIGO') || has('INVENTARIOPRODUCTOCANTIDAD') || has('INVENTARIOALMACEN')) {
                return 'valorado';
            }
            // Existencias (Codigo + Stock Fisico / Producto)
            if (has('CODIGO') || has('STOCKFISICO') || has('PRODUCTO')) {
                return 'existencias';
            }
            return 'existencias';
        }

        function normalizarCodigoUniflex(c) {
            c = String(c || '').trim();
            if (!c) return '';
            // Solo dígitos: rellenar a 4 (0782)
            if (/^\d+$/.test(c) && c.length > 0 && c.length < 4) {
                c = ('0000' + c).slice(-4);
            }
            return c;
        }

        /**
         * Excel base Laive (Reporte de Pedido de Reposición):
         * Uniflex real es 4 dígitos (0460, 0835) y a veces 5 (8593, 90027).
         * NO son 4–5 dígitos. El nombre puede variar; se agrupa por código.
         * Códigos de otras dist. suelen ir en la misma celda separados por coma.
         */
        function esCodigoProductoUniflex(c) {
            c = String(c || '').trim();
            if (!/^\d{4,5}$/.test(c)) return false;
            return true;
        }

        /** Extrae Uniflex de una celda (coma/punto y coma). Normaliza a 4 dígitos si viene corto. */
        function extraerCodigosUniflexLaive(raw) {
            var out = [];
            var vistos = {};
            String(raw || '').split(/[,;|/]+/).forEach(function (s) {
                s = String(s || '').trim();
                if (!s) return;
                // solo dígitos
                if (!/^\d+$/.test(s)) return;
                // rellenar a 4 si es 1–3 dígitos (ej. 835 → 0835)
                if (s.length > 0 && s.length < 4) s = ('0000' + s).slice(-4);
                // Laive principal: 4 o 5 dígitos. Evitar basura muy larga.
                if (!/^\d{4,5}$/.test(s)) return;
                if (vistos[s]) return;
                vistos[s] = true;
                out.push(s);
            });
            return out;
        }

        /**
         * Excel Laive "Reporte de Pedido de Reposición".
         * Usa CÓDIGO UNIFLEX (puede haber varios separados por coma) o, si no hay, CÓDIGO SAP.
         * No pisa el stock diario.
         */
        /**
         * Excel base Laive: se guía por CÓDIGO SAP (fabricación).
         * NO se elige “cuál Uniflex es el nuestro”: el nombre puede no coincidir entre dist.
         * Devuelve metadatos de la fila (SAP + tipo + lista Uniflex cruda para cruce opcional).
         */
        function filaLaiveMeta(row) {
            const sap = String(valorColumna(row, [
                'CÓDIGO SAP', 'CODIGO SAP', 'Codigo SAP', 'Código SAP', 'CodigoSAP', 'SAP'
            ])).trim();
            const uniflexRaw = String(valorColumna(row, [
                'CÓDIGO UNIFLEX', 'CODIGO UNIFLEX', 'Codigo Uniflex', 'Código Uniflex',
                'CodigoUniflex', 'UNIFLEX'
            ])).trim();
            const tipo = String(valorColumna(row, [
                'TIPO DE PRODUCTO', 'Tipo de Producto', 'TIPO', 'Tipo'
            ])).trim();
            const um = String(valorColumna(row, [
                'UM VENTA', 'UM Venta', 'UM', 'Unidad'
            ])).trim();
            const bloqueado = String(valorColumna(row, [
                'BLOQUEADO', 'Bloqueado', 'BLOCKED'
            ])).trim().toUpperCase();
            const activo = !(bloqueado === 'SI' || bloqueado === 'SÍ' || bloqueado === 'S' || bloqueado === 'YES' || bloqueado === '1' || bloqueado === 'TRUE');
            if (!sap) return null;
            const tipoNorm = normalizarTipoAlmacen(tipo);
            const uniflexLista = typeof extraerCodigosUniflexLaive === 'function'
                ? extraerCodigosUniflexLaive(uniflexRaw)
                : [];
            const factor = (typeof parseFactorDesdeTexto === 'function')
                ? (parseFactorDesdeTexto(um) || 1)
                : 1;
            return {
                sap: sap,
                uniflexLista: uniflexLista,
                tipo_almacen: tipoNorm || null,
                unidad_ref: um || null,
                factor_empaque: factor,
                activo: activo
            };
        }

        /** Compat: si algo llama filaLaiveAProductos, no inventa códigos nuevos. */
        function filaLaiveAProductos(row) {
            return [];
        }

        function filaExcelAProducto(row) {
            let codigo = String(valorColumna(row, [
                'InventarioProductoCodigo', 'Codigo', 'codigo', 'CÓDIGO', 'Código'
            ])).trim();
            if (!codigo) return null;
            // Normalizar Uniflex cortos (835 → 0835)
            if (typeof normalizarCodigoUniflex === 'function') {
                codigo = normalizarCodigoUniflex(codigo);
            }
            // NUNCA usar CÓDIGO SAP / fábrica (7–10 dígitos tipo 50001363) como código interno.
            // El código de producto es Uniflex 4–5 dígitos (0589, 0591, etc.).
            if (/^\d{7,}$/.test(codigo)) {
                console.warn('Excel: se omitió fila con código tipo SAP (no Uniflex):', codigo);
                return null;
            }
            // Si parece SAP y no es Uniflex 4–5, rechazar
            if (typeof esCodigoProductoUniflex === 'function' && !esCodigoProductoUniflex(codigo) && /^\d+$/.test(codigo) && codigo.length >= 6) {
                console.warn('Excel: código no Uniflex omitido:', codigo);
                return null;
            }

            let descripcion = String(valorColumna(row, [
                'InventarioProductoDescripcion', 'Producto', 'descripcion', 'Descripcion',
                'Descripción', 'Nombre', 'producto', 'NOMBRE DE PRODUCTO'
            ])).trim();

            // Existencias: columna sin título (XLSX → __EMPTY / __EMPTY_0 / "")
            if (!descripcion) {
                for (const k of Object.keys(row)) {
                    if (/^__EMPTY/i.test(k) || k === '' || k === ' ') {
                        const v = String(row[k] || '').trim();
                        if (v && v !== codigo && v.length > 3 && !/^\d+$/.test(v) && !/^[A-Z]{2,4}\s*[\/\*xX]/.test(v)) {
                            descripcion = v;
                            break;
                        }
                    }
                }
            }
            // No usar Unidad Ref / códigos como descripción
            if (descripcion && (/^[A-Z]{2,4}\s*[\/\*xX]/.test(descripcion) || /^\d{5,}$/.test(descripcion) || /^(TRUE|FALSE)$/i.test(descripcion))) {
                descripcion = '';
            }
            // Último recurso: valor largo que parezca nombre de producto
            if (!descripcion) {
                for (const k of Object.keys(row)) {
                    if (/^(Codigo|Código|CodigoFabrica|Unidad|Stock|Linea|Línea|Marca|Activo)/i.test(String(k))) continue;
                    const v = String(row[k] || '').trim();
                    if (!v || v === codigo) continue;
                    if (/^(TRUE|FALSE|\d+[\/]\d+)$/i.test(v)) continue;
                    if (/^\d+$/.test(v)) continue;
                    if (/^[A-Z]{2,4}\s*[\/\*xX]/.test(v)) continue; // PQT/PQT, CJ*12
                    if (v.length > 5) { descripcion = v; break; }
                }
            }
            if (!descripcion) return null;

            const unidadRef = String(valorColumna(row, [
                'InventarioProductoUnidadReferenciaAbreviacion', 'Unidad Ref', 'unidad_ref',
                'Uni. Ref.', 'Uni. Ref', 'UnidadRef'
            ])).trim();

            const factorRaw = valorColumna(row, [
                'InventarioProductoUnidadReferenciaFactor', 'FactorEmpaque', 'factor_empaque', 'Factor'
            ]);
            const factor = factorRaw !== '' && factorRaw !== undefined
                ? parseFactorDesdeTexto(factorRaw)
                : parseFactorDesdeTexto(unidadRef);

            let cantidadRaw = valorColumna(row, [
                'InventarioProductoCantidad', 'Cantidad', 'stock_teorico', 'Stock Teorico', 'Stock'
            ]);
            if (cantidadRaw === '' || cantidadRaw === undefined) {
                cantidadRaw = valorColumna(row, ['Stock Fisico', 'Stock Físico', 'StockFisico']);
            }
            const stockTeorico = parseStockFisicoTexto(cantidadRaw, factor);

            // Activo: solo si el Excel lo trae explícito. Si no, NO se manda
            // (así existencias no re-habilita códigos que Laive desactivó).
            const activoRaw = valorColumna(row, ['Activo', 'activo']);
            let activoExplicit = null;
            if (activoRaw !== '' && activoRaw !== undefined) {
                const a = String(activoRaw).trim().toLowerCase();
                activoExplicit = !(a === 'false' || a === '0' || a === 'no' || a === 'f');
            }

            // Existencias: actualiza stock/nombre/línea. NO incluye tipo_almacen
            // (Fríos/Secos lo pone solo el Excel base Laive y no se pisa).
            const producto = {
                codigo: codigo,
                descripcion: descripcion,
                unidad_ref: unidadRef || null,
                factor_empaque: factor,
                stock_teorico: stockTeorico,
                linea: String(valorColumna(row, [
                    'InventarioProductoCategoriaDescripcion', 'Linea', 'linea', 'Línea', 'Categoria'
                ])).trim() || null,
                marca: String(valorColumna(row, [
                    'InventarioProductoProveedorNombre', 'Marca', 'marca', 'Proveedor'
                ])).trim() || null,
                actualizado_en: new Date().toISOString()
            };
            // Solo manda codigo_fabrica si el Excel lo trae (no borra SAP de Laive)
            const fabEx = String(valorColumna(row, ['CodigoFabrica', 'codigo_fabrica', 'Cod. Fabrica', 'Cod Fabrica'])).trim();
            if (fabEx) producto.codigo_fabrica = fabEx;
            if (activoExplicit !== null) producto.activo = activoExplicit;
            // Solo incluir codigo_barras si el Excel trae un valor real.
            // Así no se borran los códigos de barras/QR ya guardados en la nube.
            const barrasExcel = String(valorColumna(row, [
                'CodigoBarras', 'codigo_barras', 'EAN', 'Barcode', 'CodBarras', 'CódigoBarras'
            ])).trim();
            if (barrasExcel) producto.codigo_barras = barrasExcel;
            return producto;
        }

        async function importarExcelASupabase(file, opciones) {
            try { await ensureXlsx(); } catch (eX) { showToast('No se pudo cargar Excel (XLSX).', 'error'); return; }
            if (!file) return;
            if (typeof esAdmin === 'function' && !esAdmin()) {
                showToast('Solo el administrador puede importar el Excel.', 'error');
                return;
            }
            const soloCatalogo = !!(opciones && opciones.soloCatalogo);
            const modoBase = !!(opciones && (opciones.modoBase || opciones.modo === 'base' || opciones.modo === 'laive'));
            const modoValorado = !!(opciones && (opciones.modoValorado || opciones.modo === 'valorado'));
            showToast('⏳ Leyendo Excel...', 'info');
            try {
                const buffer = await file.arrayBuffer();
                const wb = XLSX.read(buffer, { type: 'array' });
                const hoja = wb.Sheets[wb.SheetNames[0]];
                // Detecta fila de encabezados (sirve para Laive con título arriba)
                const filas = (typeof leerFilasExcel === 'function')
                    ? leerFilasExcel(hoja)
                    : XLSX.utils.sheet_to_json(hoja, { defval: '' });
                if (!filas.length) { showToast('El archivo no tiene filas de datos.', 'error'); return; }

                // Modo base forzado por el usuario O detección automática de columnas Laive
                const tipoDetectado = detectarTipoExcel(filas);
                const esLaive = modoBase || tipoDetectado === 'laive';
                const esValorado = !esLaive && (modoValorado || tipoDetectado === 'valorado');
                if (tipoDetectado === 'laive' && !modoBase) {
                    showToast('Detectado: Excel base Laive (SAP + Fríos/Secos).', 'info');
                } else if (esValorado) {
                    showToast('Detectado: Inventario valorado → solo actualiza stock del sistema.', 'info');
                } else if (!esLaive) {
                    showToast('Detectado: Existencias → catálogo (línea, marca, fábrica).', 'info');
                }
                const productos = [];
                const codigosVistos = new Set();

                if (esLaive) {
                    showToast('📋 Excel base Laive: solo habilita por CÓDIGO SAP (= fábrica). No toca Fríos/Secos ni códigos cortos...', 'info');
                    // Catálogo nube: cruzar solo por codigo_fabrica === SAP
                    const codigosExistentes = new Set();
                    const byCodigo = Object.create(null);
                    const byFabrica = Object.create(null);
                    const sapsEnExcel = new Set();
                    try {
                        const PAGE = 1000;
                        let from = 0;
                        let totalLoad = 0;
                        for (;;) {
                            let { data: batch, error: errCat } = await supabaseClient
                                .from('productos')
                                .select('codigo,codigo_fabrica,activo')
                                .order('codigo', { ascending: true })
                                .range(from, from + PAGE - 1);
                            if (errCat) throw errCat;
                            if (!batch || !batch.length) break;
                            batch.forEach(function (p) {
                                const c = String(p.codigo || '').trim();
                                if (!c) return;
                                // Ignorar basura tipo SAP como código interno
                                if (/^\d{7,}$/.test(c)) return;
                                codigosExistentes.add(c);
                                byCodigo[c] = p;
                                const f = String(p.codigo_fabrica || '').trim();
                                if (f) {
                                    if (!byFabrica[f]) byFabrica[f] = [];
                                    if (byFabrica[f].indexOf(c) < 0) byFabrica[f].push(c);
                                }
                            });
                            totalLoad += batch.length;
                            if (batch.length < PAGE) break;
                            from += PAGE;
                            if (from >= 100000) break;
                        }
                        showToast('Catálogo en nube: ' + totalLoad + ' · cruzando solo por SAP/fábrica...', 'info');
                    } catch (eLoad) {
                        console.warn(eLoad);
                        (currentData || []).forEach(function (item) {
                            const c = String(getCodigo(item) || '').trim();
                            if (!c || /^\d{7,}$/.test(c)) return;
                            codigosExistentes.add(c);
                            byCodigo[c] = item;
                            const f = String(getCodigoFabrica(item) || '').trim();
                            if (f) {
                                if (!byFabrica[f]) byFabrica[f] = [];
                                if (byFabrica[f].indexOf(c) < 0) byFabrica[f].push(c);
                            }
                        });
                    }
                    if (!codigosExistentes.size) {
                        showToast('No hay catálogo en Supabase. Primero carga el catálogo base (productos).', 'error');
                        return;
                    }

                    const habilitados = new Set();
                    let bloqueados = 0;
                    let filasSap = 0;
                    let sinMatch = 0;

                    function pushHabilitarPorSap(codigo, meta) {
                        if (!codigo || !codigosExistentes.has(codigo)) return false;
                        // Solo activo + confirmar fábrica. NADA de tipo_almacen, nombres, uniflex.
                        const rowUp = {
                            codigo: codigo,
                            codigo_fabrica: meta.sap || null,
                            activo: meta.activo !== false,
                            actualizado_en: new Date().toISOString()
                        };
                        if (!rowUp.activo) bloqueados++;
                        habilitados.add(codigo);
                        if (codigosVistos.has(codigo)) {
                            const idx = productos.findIndex(function (x) { return x.codigo === codigo; });
                            if (idx >= 0) productos[idx] = Object.assign({}, productos[idx], rowUp);
                        } else {
                            codigosVistos.add(codigo);
                            productos.push(rowUp);
                        }
                        return true;
                    }

                    filas.forEach(function (row) {
                        const meta = typeof filaLaiveMeta === 'function' ? filaLaiveMeta(row) : null;
                        if (!meta || !meta.sap) return;
                        filasSap++;
                        sapsEnExcel.add(String(meta.sap).trim());
                        // ÚNICO cruce: codigo_fabrica del producto === SAP del Excel
                        // NO usar códigos Uniflex/cortos del Excel (pueden ser de otras distribuidoras)
                        const porSap = byFabrica[meta.sap] || [];
                        let matched = false;
                        porSap.forEach(function (c) {
                            if (pushHabilitarPorSap(c, meta)) matched = true;
                        });
                        if (!matched) sinMatch++;
                    });

                    if (sinMatch > 0) {
                        showToast('SAP sin match en cód. fábrica del catálogo: ' + sinMatch + ' filas (no se crean productos).', 'info');
                    }

                    // Desactivar solo productos que YA tienen codigo_fabrica y ese SAP no vino en el Excel.
                    // No se tocan productos sin fábrica ni se usan listas Uniflex de otras dist.
                    const desactivarOtros = [];
                    if (sapsEnExcel.size >= 10) {
                        codigosExistentes.forEach(function (c) {
                            if (habilitados.has(c)) return;
                            const prev = byCodigo[c];
                            const fab = String((prev && (prev.codigo_fabrica || prev.CodigoFabrica)) || '').trim();
                            if (!fab) return; // sin SAP asignado: no desactivar
                            if (sapsEnExcel.has(fab)) return; // su SAP está en el Excel pero match falló raro
                            desactivarOtros.push(c);
                        });
                    }
                    if (desactivarOtros.length) {
                        showToast('Deshabilitando ' + desactivarOtros.length + ' con fábrica fuera del Excel Laive...', 'info');
                        const TAM = 200;
                        for (let i = 0; i < desactivarOtros.length; i += TAM) {
                            const lote = desactivarOtros.slice(i, i + TAM);
                            const { error: errDis } = await supabaseClient
                                .from('productos')
                                .update({ activo: false, actualizado_en: new Date().toISOString() })
                                .in('codigo', lote);
                            if (errDis) console.warn(errDis);
                        }
                    }

                    window.__laiveImportStats = {
                        habilitados: habilitados.size,
                        omitidos: sinMatch,
                        desactivados: desactivarOtros.length,
                        bloqueados: bloqueados,
                        tipos: 0
                    };
                } else {
                    filas.forEach(function (row) {
                        const p = filaExcelAProducto(row);
                        if (!p) return;
                        // Nunca tocar Fríos/Secos desde existencias/valorado
                        delete p.tipo_almacen;
                        if (esValorado) {
                            // Solo stock. No pisa línea/nombre/marca/activo/tipo.
                            // Incluye descripcion existente para no violar NOT NULL en upsert;
                            // el envío real de valorado usa UPDATE (ver bucle de subida).
                            let descExist = '';
                            try {
                                const prev = (currentData || []).find(function (it) {
                                    return String(getCodigo(it) || '').trim() === String(p.codigo);
                                });
                                if (prev) descExist = String(getDescripcion(prev) || prev.descripcion || '').trim();
                            } catch (e) {}
                            const solo = {
                                codigo: p.codigo,
                                descripcion: descExist || p.descripcion || p.codigo,
                                stock_teorico: p.stock_teorico,
                                actualizado_en: p.actualizado_en
                            };
                            if (p.codigo_fabrica) solo.codigo_fabrica = p.codigo_fabrica;
                            if (codigosVistos.has(solo.codigo)) {
                                const idx = productos.findIndex(function (x) { return x.codigo === solo.codigo; });
                                if (idx >= 0) productos[idx] = solo;
                            } else {
                                codigosVistos.add(solo.codigo);
                                productos.push(solo);
                            }
                            return;
                        }
                        // Existencias (modo 1): SOLO corrige códigos cortos (ya normalizados en
                        // filaExcelAProducto) y código de fábrica. NO toca nombre, línea, marca,
                        // unidad, factor, activo, tipo ni stock (el stock es del valorado).
                        // No crea productos nuevos: la base ya está armada.
                        let existeEnCat = false;
                        try {
                            existeEnCat = !!(currentData || []).some(function (it) {
                                return String(getCodigo(it) || '').trim() === String(p.codigo);
                            });
                        } catch (eEx) {}
                        // También si ya está en el set de esta importación
                        if (!existeEnCat && codigosVistos.has(p.codigo)) existeEnCat = true;
                        // Cargar set de códigos de nube si se preparó en otro flujo
                        if (!existeEnCat && window.__codigosExistentesImport instanceof Set) {
                            existeEnCat = window.__codigosExistentesImport.has(String(p.codigo));
                        }
                        if (!existeEnCat) {
                            // No insertar códigos nuevos desde existencias
                            return;
                        }
                        let descExist = '';
                        try {
                            const prev = (currentData || []).find(function (it) {
                                return String(getCodigo(it) || '').trim() === String(p.codigo);
                            });
                            if (prev) descExist = String(getDescripcion(prev) || prev.descripcion || '').trim();
                        } catch (e) {}
                        const soloFab = {
                            codigo: p.codigo,
                            // descripcion solo para no romper NOT NULL en upsert; no cambia el nombre real si usamos UPDATE
                            descripcion: descExist || p.descripcion || p.codigo,
                            actualizado_en: p.actualizado_en || new Date().toISOString()
                        };
                        if (p.codigo_fabrica) soloFab.codigo_fabrica = p.codigo_fabrica;
                        // Sin descripcion/linea/marca/unidad/factor/stock/activo del Excel
                        if (codigosVistos.has(soloFab.codigo)) {
                            const idx = productos.findIndex(function (x) { return x.codigo === soloFab.codigo; });
                            if (idx >= 0) {
                                // merge fábrica si viene
                                if (soloFab.codigo_fabrica) productos[idx].codigo_fabrica = soloFab.codigo_fabrica;
                            }
                        } else {
                            codigosVistos.add(soloFab.codigo);
                            productos.push(soloFab);
                        }
                    });
                }

                if (!productos.length) {
                    showToast(
                        esLaive
                            ? 'Ningún código 4–5 dígitos del Excel coincide con tu catálogo. Primero sube existencias; el Excel base solo habilita códigos que ya tienes.'
                            : 'No se encontraron productos con código (Uniflex/SAP o código interno).',
                        'error'
                    );
                    return;
                }
                showToast('⏳ Subiendo ' + productos.length + ' productos a la nube...', 'info');
                const TAMANO_LOTE = 200;
                let subidos = 0;
                for (let i = 0; i < productos.length; i += TAMANO_LOTE) {
                    const lote = productos.slice(i, i + TAMANO_LOTE);
                    let error = null;
                    if (esValorado) {
                        // UPDATE solo stock en paralelo (evita NOT NULL y no se cuelga)
                        const CONCURRENCY = 30;
                        for (let j = 0; j < lote.length; j += CONCURRENCY) {
                            const chunk = lote.slice(j, j + CONCURRENCY);
                            const results = await Promise.all(chunk.map(function (r) {
                                const patch = {
                                    stock_teorico: r.stock_teorico,
                                    actualizado_en: r.actualizado_en || new Date().toISOString()
                                };
                                if (r.codigo_fabrica) patch.codigo_fabrica = r.codigo_fabrica;
                                return supabaseClient
                                    .from('productos')
                                    .update(patch)
                                    .eq('codigo', r.codigo);
                            }));
                            const failed = results.find(function (x) { return x && x.error; });
                            if (failed) {
                                error = failed.error;
                                break;
                            }
                            subidos += chunk.length;
                            if (productos.length > 40) {
                                showToast('⏳ Stock: ' + subidos + ' / ' + productos.length + '...', 'info');
                            }
                        }
                    } else if (esLaive) {
                        // Base Laive: UPDATE campo a campo (no upsert) para no pisar
                        // descripcion / marca / unidad / stock del catálogo de existencias.
                        const CONCURRENCY = 25;
                        for (let j = 0; j < lote.length; j += CONCURRENCY) {
                            const chunk = lote.slice(j, j + CONCURRENCY);
                            const results = await Promise.all(chunk.map(function (r) {
                                // Base Laive: únicamente activo + codigo_fabrica (SAP). Sin tipo_almacen.
                                const patch = {
                                    activo: r.activo !== false,
                                    actualizado_en: r.actualizado_en || new Date().toISOString()
                                };
                                if (r.codigo_fabrica) patch.codigo_fabrica = r.codigo_fabrica;
                                return supabaseClient
                                    .from('productos')
                                    .update(patch)
                                    .eq('codigo', r.codigo);
                            }));
                            const failed = results.find(function (x) { return x && x.error; });
                            if (failed) {
                                // Si falta tipo_almacen, reintentar el lote sin esa columna
                                if (failed.error && /tipo_almacen/i.test(failed.error.message || '')) {
                                    const results2 = await Promise.all(chunk.map(function (r) {
                                        const patch = {
                                            activo: r.activo !== false,
                                            actualizado_en: r.actualizado_en || new Date().toISOString()
                                        };
                                        if (r.codigo_fabrica) patch.codigo_fabrica = r.codigo_fabrica;
                                        return supabaseClient
                                            .from('productos')
                                            .update(patch)
                                            .eq('codigo', r.codigo);
                                    }));
                                    const failed2 = results2.find(function (x) { return x && x.error; });
                                    if (failed2) {
                                        error = failed2.error;
                                        break;
                                    }
                                    showToast('Aviso: crea la columna tipo_almacen en productos (SQL) para guardar Fríos/Secos.', 'info');
                                } else {
                                    error = failed.error;
                                    break;
                                }
                            }
                            subidos += chunk.length;
                            if (productos.length > 40) {
                                showToast('⏳ Base Laive: ' + subidos + ' / ' + productos.length + '...', 'info');
                            }
                        }
                    } else {
                        // Existencias: SOLO código de fábrica (códigos cortos ya normalizados).
                        // UPDATE, nunca upsert: no crea filas ni pisa nombre/línea/marca/stock.
                        const CONCURRENCY = 30;
                        for (let j = 0; j < lote.length; j += CONCURRENCY) {
                            const chunk = lote.slice(j, j + CONCURRENCY);
                            const results = await Promise.all(chunk.map(function (r) {
                                const patch = {
                                    actualizado_en: r.actualizado_en || new Date().toISOString()
                                };
                                if (r.codigo_fabrica) patch.codigo_fabrica = r.codigo_fabrica;
                                // Si no hay fábrica que actualizar, solo toca actualizado_en (mínimo)
                                return supabaseClient
                                    .from('productos')
                                    .update(patch)
                                    .eq('codigo', r.codigo);
                            }));
                            const failed = results.find(function (x) { return x && x.error; });
                            if (failed) {
                                error = failed.error;
                                break;
                            }
                            subidos += chunk.length;
                        }
                    }
                    if (error) throw error;
                }
                // Valorado = foto completa del almacén: lo que NO viene en el Excel queda en 0
                let extraCero = '';
                if (esValorado) {
                    try {
                        const enExcel = new Set();
                        (productos || []).forEach(function (p) {
                            const c = String(p.codigo || '').trim();
                            if (c) enExcel.add(c);
                        });
                        const aCero = [];
                        (currentData || []).forEach(function (it) {
                            const cod = String((typeof getCodigo === 'function' ? getCodigo(it) : it.Codigo) || '').trim();
                            if (!cod || enExcel.has(cod)) return;
                            const stockAnt = (typeof getCantidad === 'function')
                                ? Number(getCantidad(it)) || 0
                                : Number(it.Cantidad || it.stock_teorico || 0) || 0;
                            if (stockAnt <= 0) return;
                            aCero.push(cod);
                        });
                        if (aCero.length) {
                            showToast('⏳ Poniendo a 0 stock de ' + aCero.length + ' productos ausentes en el valorado...', 'info');
                            const CONC = 30;
                            const ahoraIso = new Date().toISOString();
                            for (let zi = 0; zi < aCero.length; zi += CONC) {
                                const chunk = aCero.slice(zi, zi + CONC);
                                const results = await Promise.all(chunk.map(function (cod) {
                                    return supabaseClient
                                        .from('productos')
                                        .update({ stock_teorico: 0, actualizado_en: ahoraIso })
                                        .eq('codigo', cod);
                                }));
                                const failed = results.find(function (x) { return x && x.error; });
                                if (failed) throw failed.error;
                            }
                            // Alinear teórico en conteo físico local
                            aCero.forEach(function (cod) {
                                const reg = (inventarioFisico || []).find(function (d) {
                                    return String(d.codigo || '').trim() === cod;
                                });
                                if (reg) {
                                    const ant = Number(reg.stockTeorico) || 0;
                                    reg.stockTeorico = 0;
                                    reg.diferencia = (Number(reg.stockFisico) || 0) - 0;
                                    if (ant > 0 && typeof aplicarBajasLotesPorTeorico === 'function') {
                                        try {
                                            aplicarBajasLotesPorTeorico([{
                                                codigo: cod,
                                                anterior: ant,
                                                nuevo: 0,
                                                descripcion: reg.descripcion || ''
                                            }]);
                                        } catch (eZ) {}
                                    }
                                }
                            });
                            extraCero = ' · ' + aCero.length + ' ausentes → stock 0';
                            console.info('[IEM] Valorado: stock a 0 por ausencia en Excel', aCero.length, aCero.slice(0, 20));
                        }
                    } catch (eCero) {
                        console.warn('Valorado: no se pudo poner a 0 ausentes', eCero);
                        showToast('Aviso: stock actualizado, pero falló poner a 0 los ausentes: ' + (eCero.message || eCero), 'error');
                    }
                }
                let extra = '';
                if (!esLaive && !esValorado) extra = ' (existencias: solo cód. fábrica / códigos cortos; sin tocar nombres ni stock)';
                if (esValorado) extra = ' (valorado: stock del Excel' + extraCero + ')';
                if (esLaive) {
                    const st = window.__laiveImportStats || {};
                    extra = ' (Base Laive: solo SAP/fábrica · ' + (st.habilitados || subidos) + ' habilitados'
                        + (st.desactivados ? ', ' + st.desactivados + ' desactivados sin SAP en Excel' : '')
                        + (st.omitidos ? ', ' + st.omitidos + ' sin match SAP' : '')
                        + ', sin tocar stock)';
                }
                // Valorado: si el teórico BAJÓ, reducir lotes físicos (FEFO). Aumentos = conteo manual.
                let extraLotes = '';
                if (esValorado && typeof aplicarBajasLotesPorTeorico === 'function' && productos && productos.length) {
                    try {
                        const cambios = [];
                        productos.forEach(function (p) {
                            const cod = String(p.codigo || '').trim();
                            if (!cod) return;
                            const nuevo = Number(p.stock_teorico);
                            if (!isFinite(nuevo)) return;
                            let anterior = null;
                            const prev = (currentData || []).find(function (it) {
                                return String((typeof getCodigo === 'function' ? getCodigo(it) : it.codigo) || '').trim() === cod;
                            });
                            if (prev) {
                                anterior = typeof getCantidad === 'function' ? getCantidad(prev) : Number(prev.Cantidad || prev.stock_teorico || 0);
                            }
                            // También mirar conteo físico guardado
                            const reg = (inventarioFisico || []).find(function (d) {
                                return String(d.codigo || '').trim() === cod;
                            });
                            if (reg && (anterior === null || !isFinite(anterior))) {
                                anterior = Number(reg.stockTeorico);
                            }
                            if (anterior === null || !isFinite(anterior)) return;
                            if (nuevo < anterior) {
                                cambios.push({ codigo: cod, anterior: anterior, nuevo: nuevo, descripcion: p.descripcion || '' });
                            }
                            // Actualizar teórico en registro de conteo si existe (también si subió)
                            if (reg) {
                                reg.stockTeorico = nuevo;
                                reg.diferencia = (Number(reg.stockFisico) || 0) - nuevo;
                            }
                        });
                        const rBaja = aplicarBajasLotesPorTeorico(cambios);
                        if (rBaja && rBaja.productos > 0) {
                            extraLotes = ' · Lotes −' + rBaja.bajados + ' und en ' + rBaja.productos + ' prod. (FEFO)';
                            console.info('Baja automática lotes', rBaja);
                        }
                        try { if (typeof saveInventario === 'function') saveInventario(); } catch (e) {}
                    } catch (eBaja) {
                        console.warn('Baja lotes por valorado', eBaja);
                    }
                }
                showToast('✅ ' + subidos + ' productos actualizados en Supabase' + extra + extraLotes + '.', 'success');
                try {
                    if (typeof window.__iemLastExcelFile === 'object' && window.__iemLastExcelFile) {
                        var f = window.__iemLastExcelFile;
                        var buf = await f.arrayBuffer();
                        await guardarRespaldoMensual('excel_subido', buf, 'excel_actualizacion');
                        window.__iemLastExcelFile = null;
                    }
                } catch (eBackup) { console.warn(eBackup); }
                await loadFromGoogleSheets();
                try { if (typeof renderInventario === 'function') renderInventario(); } catch (e) {}
                try { if (typeof renderReporteSistema === 'function') renderReporteSistema(); } catch (e) {}
            } catch (err) {
                console.error(err);
                showToast('❌ Error al importar: ' + (err.message || err), 'error');
            }
        }


        // ============================================================
        // ESCÁNER CÓDIGO DE BARRAS / QR (admin + usuarios en SCAN_USUARIOS_PERMITIDOS)
        // ============================================================
        let html5QrCode = null;
        let scanModo = 'buscar'; // 'buscar' | 'vincular'
        const BARRAS_LOCAL_KEY = 'iem_codigo_barras_local';
        const BARRAS_LOCAL_PURGED_KEY = 'iem_codigo_barras_purged_v1';

        function cargarBarrasLocal() {
            try {
                return JSON.parse(localStorage.getItem(BARRAS_LOCAL_KEY) || '{}') || {};
            } catch (e) { return {}; }
        }
        function guardarBarrasLocal(mapa) {
            try { localStorage.setItem(BARRAS_LOCAL_KEY, JSON.stringify(mapa || {})); } catch (e) {}
        }
        /** Borra QR/barras guardados en el dispositivo (evitan choque con cód. fábrica). */
        function purgarBarrasLocalConflictivas() {
            try {
                // Una vez: limpiar todo el mapa local de vinculaciones QR
                if (!localStorage.getItem(BARRAS_LOCAL_PURGED_KEY)) {
                    localStorage.removeItem(BARRAS_LOCAL_KEY);
                    localStorage.setItem(BARRAS_LOCAL_PURGED_KEY, '1');
                    console.info('[IEM] Códigos QR/barras locales eliminados para no chocar con fábrica');
                }
            } catch (e) {}
            // Además: si quedara algo, quitar entradas cuyo EAN = algún código de fábrica
            try {
                var mapa = cargarBarrasLocal();
                if (!mapa || !Object.keys(mapa).length) return;
                var fabs = Object.create(null);
                (currentData || []).forEach(function (it) {
                    var f = String(getCodigoFabrica(it) || '').replace(/\D/g, '');
                    if (f) fabs[f] = true;
                    var f2 = String(getCodigoFabrica(it) || '').trim();
                    if (f2) fabs[f2] = true;
                });
                var changed = false;
                Object.keys(mapa).forEach(function (cod) {
                    var ean = String(mapa[cod] || '').trim();
                    var eanD = ean.replace(/\D/g, '');
                    if (fabs[ean] || fabs[eanD]) {
                        delete mapa[cod];
                        changed = true;
                    }
                });
                if (changed) guardarBarrasLocal(mapa);
            } catch (e2) {}
        }
        function aplicarBarrasLocalADatos() {
            purgarBarrasLocalConflictivas();
            const mapa = cargarBarrasLocal();
            if (!mapa || !Object.keys(mapa).length) return;
            (currentData || []).forEach(function (item) {
                const cod = getCodigo(item);
                if (!cod || !mapa[cod]) return;
                var ean = String(mapa[cod] || '').trim();
                var fab = String(getCodigoFabrica(item) || '').trim();
                // No aplicar EAN si es igual al código de fábrica (conflicto)
                if (ean && fab && (ean === fab || ean.replace(/\D/g, '') === fab.replace(/\D/g, ''))) return;
                item.CodigoBarras = ean;
                item.codigo_barras = ean;
            });
        }

        async function detenerEscaner() {
            try {
                if (html5QrCode) {
                    const running = html5QrCode.isScanning;
                    if (running) await html5QrCode.stop();
                    await html5QrCode.clear();
                }
            } catch (e) {}
            html5QrCode = null;
            const ov = document.getElementById('scanOverlay');
            if (ov) {
                ov.classList.remove('visible');
                ov.setAttribute('aria-hidden', 'true');
            }
        }

        async function abrirEscaner(modo) {
            modo = modo || 'buscar';
            if (modo === 'vincular' && !puedeVincularBarras()) {
                showToast('Vincular códigos solo está disponible para el administrador.', 'error');
                return;
            }
            if (!puedeEscanear()) {
                showToast('El escáner no está habilitado para este usuario.', 'error');
                return;
            }
            try {
                await ensureHtml5Qrcode();
            } catch (eQr) {
                showToast('No se cargó el lector. Revisa tu conexión.', 'error');
                return;
            }
            scanModo = modo || 'buscar';
            const ov = document.getElementById('scanOverlay');
            const title = document.getElementById('scanTitle');
            const hint = document.getElementById('scanHint');
            const status = document.getElementById('scanStatus');
            if (title) {
                var ico = '<span class="ico-scan" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M2 7h1.5v10H2V7zm2.5 0H6v10H4.5V7zM7 7h1.2v10H7V7zm2.2 0h2v10h-2V7zm3 0h1.2v10H12.2V7z"/><path fill="currentColor" d="M15 7h3.5v3.5H15V7zm1 1v1.5h1.5V8H16zm2.5 4.5H22V15h-1.5v1.5H18v-1.5h-.5v-1.5H18v-1.5h-.5zM15 15h2v2h-2v-2z"/><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M3 5h3M3 5v3M21 5h-3M21 5v3M3 19h3M3 19v-3M21 19h-3M21 19v-3"/></svg></span> ';
                title.innerHTML = ico + (scanModo === 'vincular' ? 'Vincular código de barras' : 'Escanear código');
            }
            if (hint) {
                let codHint = '';
                if (scanModo === 'vincular') {
                    if (barrasAdminSeleccionado) codHint = getCodigo(barrasAdminSeleccionado);
                    else if (selectedIndex >= 0 && filteredData[selectedIndex]) codHint = getCodigo(filteredData[selectedIndex]);
                }
                hint.textContent = scanModo === 'vincular'
                    ? 'Escanea el código del envase para asociarlo al producto seleccionado' + (codHint ? ' (' + codHint + ')' : '') + '.'
                    : 'Apunta al código de barras o QR. Debe estar guardado en el catálogo para encontrarlo.';
            }
            if (status) status.textContent = 'Iniciando cámara...';
            if (ov) {
                ov.classList.add('visible');
                ov.setAttribute('aria-hidden', 'false');
            }
            try {
                await detenerEscaner();
                if (ov) {
                    ov.classList.add('visible');
                    ov.setAttribute('aria-hidden', 'false');
                }
                html5QrCode = new Html5Qrcode('scanReader');
                await html5QrCode.start(
                    { facingMode: 'environment' },
                    { fps: 8, qrbox: { width: 260, height: 140 } },
                    onScanSuccess,
                    function () {}
                );
                if (status) status.textContent = 'Cámara lista. Apunta al código...';
            } catch (e) {
                console.error(e);
                if (status) status.textContent = 'No se pudo abrir la cámara. Revisa permisos.';
                showToast('Sin acceso a la cámara.', 'error');
            }
        }

        async function onScanSuccess(decodedText) {
            const code = String(decodedText || '').trim();
            if (!code) return;
            try { await detenerEscaner(); } catch (e) {}
            if (scanModo === 'vincular') {
                await vincularCodigoBarras(code);
            } else {
                searchInput.value = code;
                performSearch();
                if (!filteredData.length) {
                    // Puede estar en catálogo con stock 0: forzar búsqueda en todo el catálogo
                    const codeU = code.toUpperCase();
                    const hit = (currentData || []).find(function (item) {
                        return String(getCodigoBarras(item) || '').trim() === code
                            || String(getCodigoBarras(item) || '').toUpperCase().indexOf(codeU) !== -1
                            || String(getCodigo(item) || '').toUpperCase() === codeU;
                    });
                    if (hit) {
                        filteredData = [hit];
                        selectedIndex = 0;
                        renderResults(filteredData);
                        actualizarCantidades(hit);
                        showToast('Encontrado (stock 0): ' + getCodigo(hit), 'success');
                    } else {
                        showToast('Código ' + code + ' no asociado. En Barras/QR elige el producto y asocia el EAN.', 'info');
                    }
                } else {
                    showToast('Encontrado: ' + code, 'success');
                    if (filteredData.length === 1) {
                        selectedIndex = 0;
                        document.querySelectorAll('.result-item').forEach(function (el, i) {
                            el.classList.toggle('selected', i === 0);
                        });
                        actualizarCantidades(filteredData[0]);
                    }
                }
            }
        }

        // Producto seleccionado en la herramienta admin de barras (sin pasar por conteo)
        let barrasAdminSeleccionado = null;

        async function vincularCodigoBarras(ean, codigoForzado) {
            if (!esAdmin()) return;
            ean = String(ean || '').trim();
            if (!ean) {
                showToast('Código de barras vacío.', 'error');
                return;
            }
            let item = null;
            let codigo = codigoForzado ? String(codigoForzado).trim() : '';
            if (codigo) {
                item = (currentData || []).find(function (x) { return getCodigo(x) === codigo; })
                    || (filteredData || []).find(function (x) { return getCodigo(x) === codigo; });
            } else if (barrasAdminSeleccionado) {
                codigo = getCodigo(barrasAdminSeleccionado);
                item = barrasAdminSeleccionado;
            } else if (selectedIndex >= 0 && selectedIndex < filteredData.length) {
                item = filteredData[selectedIndex];
                codigo = getCodigo(item);
            }
            if (!codigo) {
                showToast('Primero busca y selecciona el producto.', 'error');
                return;
            }
            if (!item) {
                item = (currentData || []).find(function (x) { return getCodigo(x) === codigo; });
            }

            // Liberar este EAN de cualquier otro producto (memoria)
            (currentData || []).forEach(function (x) {
                if (String(getCodigoBarras(x) || '').trim() === ean && getCodigo(x) !== codigo) {
                    x.CodigoBarras = '';
                }
            });
            (filteredData || []).forEach(function (x) {
                if (String(getCodigoBarras(x) || '').trim() === ean && getCodigo(x) !== codigo) {
                    x.CodigoBarras = '';
                }
            });

            // Local: quitar otras claves con el mismo EAN
            const mapa = cargarBarrasLocal();
            Object.keys(mapa).forEach(function (k) {
                if (String(mapa[k] || '').trim() === ean && k !== codigo) delete mapa[k];
            });
            mapa[codigo] = ean;
            guardarBarrasLocal(mapa);
            if (item) item.CodigoBarras = ean;

            // Nube: primero liberar EAN en todos, luego asignar al producto
            try {
                await supabaseClient.from('productos').update({
                    codigo_barras: null,
                    actualizado_en: new Date().toISOString()
                }).eq('codigo_barras', ean);

                const { error } = await supabaseClient.from('productos').update({
                    codigo_barras: ean,
                    actualizado_en: new Date().toISOString()
                }).eq('codigo', codigo);
                if (error) throw error;
                showToast('Barras ' + ean + ' → ' + codigo + ' (único en nube).', 'success');
            } catch (e) {
                console.warn(e);
                showToast('Guardado en este dispositivo. Nube: ' + (e.message || e), 'info');
            }

            const orig = (currentData || []).find(function (x) { return getCodigo(x) === codigo; });
            if (orig) orig.CodigoBarras = ean;
            if (barrasAdminSeleccionado && getCodigo(barrasAdminSeleccionado) === codigo) {
                barrasAdminSeleccionado.CodigoBarras = ean;
            }
            actualizarFilaVincular();
            if (typeof renderBarrasAdminSeleccionado === 'function') renderBarrasAdminSeleccionado();
            if (typeof buscarBarrasAdmin === 'function') {
                const inp = document.getElementById('adminBarrasInput');
                buscarBarrasAdmin(inp && inp.value);
            }
        }

        function actualizarFilaVincular() {
            const row = document.getElementById('vincularBarrasRow');
            if (!row) return;
            if (!esAdmin() || selectedIndex < 0 || selectedIndex >= filteredData.length) {
                row.style.display = 'none';
                return;
            }
            row.style.display = 'block';
            const item = filteredData[selectedIndex];
            const ean = getCodigoBarras(item);
            const btn = document.getElementById('btnVincularBarras');
            if (btn) {
                btn.innerHTML = ean
                    ? '<span class="btn-icon">🏷️</span><span class="btn-label"> Barras: ' + ean + ' (cambiar)</span>'
                    : '<span class="btn-icon">🏷️</span><span class="btn-label"> Vincular código de barras a este producto</span>';
            }
        }

        // ============================================================
        // ADMIN: asociar códigos de barras / QR (sin conteo)
        // ============================================================
        function buscarBarrasAdmin(term) {
            const list = document.getElementById('adminBarrasList');
            const countEl = document.getElementById('adminBarrasCount');
            if (!list) return;
            const soloSin = !!(document.getElementById('adminBarrasSoloSin') && document.getElementById('adminBarrasSoloSin').checked);
            const q = String(term || '').trim().toUpperCase();
            let base = (currentData || []).slice();
            if (soloSin) {
                base = base.filter(function (item) { return !getCodigoBarras(item); });
            }
            if (!q) {
                if (soloSin) {
                    const hits0 = base.slice(0, 120);
                    if (countEl) countEl.textContent = String(base.length);
                    if (!hits0.length) {
                        list.innerHTML = '<p class="admin-sesiones-empty">Todos los productos ya tienen código de barras.</p>';
                        return;
                    }
                    list.innerHTML = hits0.map(function (item) { return htmlItemBarrasAdmin(item); }).join('');
                    return;
                }
                list.innerHTML = '<p class="admin-sesiones-empty">Escribe para buscar, o marca «solo sin barras» para listar pendientes.</p>';
                if (countEl) {
                    const sin = (currentData || []).filter(function (it) { return !getCodigoBarras(it); }).length;
                    countEl.textContent = sin + ' sin barras / ' + (currentData || []).length;
                }
                return;
            }
            const palabras = q.split(/\s+/).filter(Boolean);
            const hits = base.filter(function (item) {
                const campos = [
                    getCodigo(item), getCodigoFabrica(item), getDescripcion(item),
                    getLinea(item), getMarca(item), getCodigoBarras(item), getUnidadRef(item)
                ].map(function (x) { return String(x || '').toUpperCase(); });
                return palabras.every(function (p) {
                    return campos.some(function (c) { return c.indexOf(p) !== -1; });
                });
            }).slice(0, 100);
            if (countEl) countEl.textContent = String(hits.length) + (hits.length >= 100 ? '+' : '');
            if (!hits.length) {
                list.innerHTML = '<p class="admin-sesiones-empty">Sin coincidencias.</p>';
                return;
            }
            list.innerHTML = hits.map(function (item) { return htmlItemBarrasAdmin(item); }).join('');
        }

        function htmlItemBarrasAdmin(item) {
            const cod = escapeHtmlSes(getCodigo(item));
            const desc = escapeHtmlSes(getDescripcion(item));
            const lin = escapeHtmlSes(getLinea(item) || '-');
            const mar = escapeHtmlSes(getMarca(item) || '-');
            const ean = getCodigoBarras(item);
            const eanHtml = ean
                ? '<span class="aci-barras ok">🏷️ ' + escapeHtmlSes(ean) + '</span>'
                : '<span class="aci-barras pendiente">Sin barras</span>';
            const sel = barrasAdminSeleccionado && getCodigo(barrasAdminSeleccionado) === getCodigo(item) ? ' selected' : '';
            const sinClass = ean ? '' : ' sin-barras';
            return '<div class="admin-catalog-item admin-barras-item' + sinClass + sel + '" data-codigo="' + cod + '" role="button" tabindex="0">' +
                '<div class="aci-cod">' + cod + '</div>' +
                '<div class="aci-desc">' + desc + '</div>' +
                '<div class="aci-meta">Línea: ' + lin + ' · Marca: ' + mar + ' · ' + eanHtml + '</div></div>';
        }

        function seleccionarProductoBarrasAdmin(codigo) {
            const item = (currentData || []).find(function (x) { return getCodigo(x) === String(codigo); });
            if (!item) {
                showToast('Producto no encontrado en el catálogo.', 'error');
                return;
            }
            barrasAdminSeleccionado = item;
            renderBarrasAdminSeleccionado();
            const inp = document.getElementById('adminBarrasInput');
            buscarBarrasAdmin(inp && inp.value);
            // No forzar focus al input (abre teclado y tapa la pantalla).
            // Solo desplazar la tarjeta del producto a la zona visible.
            const box = document.getElementById('adminBarrasSelected');
            if (box && box.scrollIntoView) {
                setTimeout(function () {
                    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 50);
            }
        }

        function renderBarrasAdminSeleccionado() {
            const box = document.getElementById('adminBarrasSelected');
            if (!box) return;
            if (!barrasAdminSeleccionado) {
                box.innerHTML = '<p class="admin-sesiones-empty">Selecciona un producto de la lista para asociarle un código de barras o QR.</p>';
                box.classList.remove('has-product');
                return;
            }
            const item = barrasAdminSeleccionado;
            const cod = escapeHtmlSes(getCodigo(item));
            const desc = escapeHtmlSes(getDescripcion(item));
            const fab = escapeHtmlSes(getCodigoFabrica(item) || '-');
            const ean = getCodigoBarras(item);
            const eanTxt = ean ? escapeHtmlSes(ean) : '— sin asignar —';
            box.classList.add('has-product');
            box.innerHTML =
                '<div class="barras-sel-info">' +
                '<div class="barras-sel-cod">' + cod + '</div>' +
                '<div class="barras-sel-desc">' + desc + '</div>' +
                '<div class="barras-sel-meta">Cód. fábrica: ' + fab + '</div>' +
                '<div class="barras-sel-ean">Barras actual: <strong>' + eanTxt + '</strong></div>' +
                '</div>' +
                '<div class="barras-sel-actions">' +
                '<button type="button" class="btn btn-primary btn-sm btn-scan" id="adminBarrasScanBtn">' +
                '<span class="btn-icon btn-scan-ico ico-scan" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M2 7h1.5v10H2V7zm2.5 0H6v10H4.5V7zM7 7h1.2v10H7V7zm2.2 0h2v10h-2V7zm3 0h1.2v10H12.2V7z"/><path fill="currentColor" d="M15 7h3.5v3.5H15V7zm1 1v1.5h1.5V8H16zm2.5 4.5H22V15h-1.5v1.5H18v-1.5h-.5v-1.5H18v-1.5h-.5zM15 15h2v2h-2v-2z"/></svg></span>' +
                '<span class="btn-label"> Escanear QR / barras</span></button>' +
                '<div class="barras-manual-row">' +
                '<input type="text" id="adminBarrasManual" class="barras-manual-input" placeholder="O escribe el EAN / QR..." inputmode="numeric" autocomplete="off" value="' + escapeHtmlSes(ean || '') + '">' +
                '<button type="button" class="btn btn-success btn-sm" id="adminBarrasSaveBtn">Asociar</button>' +
                '</div>' +
                (ean ? '<button type="button" class="btn btn-outline btn-sm" id="adminBarrasClearBtn">Quitar código de barras</button>' : '') +
                '</div>';
            const scanBtn = document.getElementById('adminBarrasScanBtn');
            if (scanBtn) scanBtn.addEventListener('click', function () {
                abrirEscaner('vincular');
            });
            const saveBtn = document.getElementById('adminBarrasSaveBtn');
            if (saveBtn) saveBtn.addEventListener('click', function () {
                const v = (document.getElementById('adminBarrasManual') || {}).value;
                const code = String(v || '').trim();
                if (!code) {
                    showToast('Escribe o escanea un código de barras / QR.', 'error');
                    return;
                }
                vincularCodigoBarras(code, getCodigo(item));
            });
            const clearBtn = document.getElementById('adminBarrasClearBtn');
            if (clearBtn) clearBtn.addEventListener('click', function () {
                quitarCodigoBarrasAdmin(getCodigo(item));
            });
            const manual = document.getElementById('adminBarrasManual');
            if (manual) {
                manual.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (saveBtn) saveBtn.click();
                    }
                });
            }
        }

        async function quitarCodigoBarrasAdmin(codigo) {
            if (!esAdmin() || !codigo) return;
            try {
                const { error } = await supabaseClient.from('productos').update({
                    codigo_barras: null,
                    actualizado_en: new Date().toISOString()
                }).eq('codigo', codigo);
                if (error) throw error;
            } catch (e) {
                showToast('No se pudo quitar en la nube: ' + (e.message || e), 'error');
                return;
            }
            const mapa = cargarBarrasLocal();
            delete mapa[codigo];
            guardarBarrasLocal(mapa);
            const orig = (currentData || []).find(function (x) { return getCodigo(x) === codigo; });
            if (orig) orig.CodigoBarras = '';
            if (barrasAdminSeleccionado && getCodigo(barrasAdminSeleccionado) === codigo) {
                barrasAdminSeleccionado.CodigoBarras = '';
            }
            showToast('Código de barras quitado de ' + codigo + '.', 'success');
            renderBarrasAdminSeleccionado();
            const inp = document.getElementById('adminBarrasInput');
            buscarBarrasAdmin(inp && inp.value);
        }

        // ============================================================
        // CATÁLOGO CLIENTES (solo admin)
        // ============================================================
        let clientesData = [];

        function escapeCli(s) {
            return String(s || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        function filaExcelACliente(row) {
            const codigo = String(valorColumna(row, [
                'Codigo', 'codigo', 'Código', 'CÓDIGO', 'CodCliente', 'Cod. Cliente',
                'CodigoCliente', 'Código Cliente', 'Cod', 'ID', 'IdCliente', 'ClienteCodigo'
            ])).trim();
            if (!codigo) return null;
            const nombre = String(valorColumna(row, [
                'Nombre', 'nombre', 'RazonSocial', 'Razón Social', 'Cliente',
                'NombreCliente', 'Razon Social', 'Descripcion', 'Descripción'
            ])).trim();
            if (!nombre) return null;
            return {
                codigo: codigo,
                nombre: nombre,
                categoria: String(valorColumna(row, ['CategoriaCliente', 'Categoria', 'categoría', 'CategoriaCli', 'Categoria Cliente'])).trim() || null,
                tipo_cliente: String(valorColumna(row, ['TipoCliente', 'Tipo', 'tipo_cliente', 'Tipo Cliente'])).trim() || null,
                tipo_doc: String(valorColumna(row, ['TipoDocidentidad', 'TipoDoc', 'Tipo Documento', 'TipoDocIdentidad'])).trim() || null,
                doc_identidad: String(valorColumna(row, ['Docidentidad', 'DocIdentidad', 'DNI', 'RUC', 'Documento', 'NroDocumento', 'Doc'])).trim() || null,
                direccion: String(valorColumna(row, ['Direccion', 'Dirección', 'direccion', 'Dir'])).trim() || null,
                distrito: String(valorColumna(row, ['Distrito', 'distrito'])).trim() || null,
                codigo_zona: String(valorColumna(row, ['CodigoZona', 'CódigoZona', 'CodZona', 'Zona', 'Codigo Zona'])).trim() || null,
                descripcion_zona: String(valorColumna(row, ['DescripcionZona', 'Descripcion1', 'ZonaDesc', 'Descripcion Zona'])).trim() || null,
                linea_credito: (function () {
                    const v = valorColumna(row, ['LineaCredito', 'Linea de Credito', 'Credito', 'Línea Crédito', 'LineaCredito']);
                    if (v === '' || v === undefined || v === null) return null;
                    const n = Number(String(v).replace(/[^\d.,\-]/g, '').replace(',', '.'));
                    return isNaN(n) ? null : n;
                })(),
                actualizado_en: new Date().toISOString()
            };
        }

        function setClientesImportMsg(msg) {
            const st = document.getElementById('adminClientesStatus');
            const st2 = document.getElementById('adminClientesImportStatus');
            if (st) st.textContent = msg;
            if (st2) st2.textContent = msg;
        }

        async function importarClientesExcel(file) {
            if (!esAdmin()) {
                showToast('Solo el administrador puede importar clientes.', 'error');
                return;
            }
            if (!file) return;
            try {
                await ensureXlsx();
            } catch (eX) {
                showToast('No se cargó la librería Excel. Revisa tu conexión.', 'error');
                return;
            }
            const box = document.getElementById('adminClientesImportBox');
            if (box) box.open = true;
            setClientesImportMsg('Leyendo ' + file.name + '...');
            try {
                const buffer = await file.arrayBuffer();
                const wb = XLSX.read(buffer, { type: 'array' });
                if (!wb.SheetNames || !wb.SheetNames.length) {
                    throw new Error('El archivo no tiene hojas.');
                }
                const hoja = wb.Sheets[wb.SheetNames[0]];
                const filas = XLSX.utils.sheet_to_json(hoja, { defval: '', raw: false });
                const lista = [];
                const vistos = new Set();
                filas.forEach(function (row) {
                    const c = filaExcelACliente(row);
                    if (!c) return;
                    if (vistos.has(c.codigo)) {
                        const i = lista.findIndex(function (x) { return x.codigo === c.codigo; });
                        if (i >= 0) lista[i] = c;
                    } else {
                        vistos.add(c.codigo);
                        lista.push(c);
                    }
                });
                if (!lista.length) {
                    const cols = filas[0] ? Object.keys(filas[0]).join(', ') : '(vacío)';
                    setClientesImportMsg('No se leyeron clientes. Columnas del Excel: ' + cols);
                    showToast('Excel sin filas con Código + Nombre.', 'error');
                    return;
                }
                setClientesImportMsg('Subiendo ' + lista.length + ' clientes a Supabase...');
                const TAM = 150;
                let n = 0;
                for (let i = 0; i < lista.length; i += TAM) {
                    const lote = lista.slice(i, i + TAM);
                    const { error } = await supabaseClient
                        .from('clientes')
                        .upsert(lote, { onConflict: 'codigo' });
                    if (error) {
                        const detalle = (error.message || '') + (error.details ? ' — ' + error.details : '') + (error.hint ? ' — ' + error.hint : '');
                        throw new Error(detalle || JSON.stringify(error));
                    }
                    n += lote.length;
                    setClientesImportMsg('Subidos ' + n + ' / ' + lista.length + '...');
                }
                // Volver a leer desde la nube para confirmar que sí quedaron guardados
                setClientesImportMsg('Verificando en la nube...');
                await cargarClientesDesdeNube();
                const enNube = (clientesData && clientesData.length) || 0;
                setClientesImportMsg('✅ Guardados ' + n + ' del Excel. En nube ahora: ' + enNube + '.');
                showToast('✅ ' + n + ' clientes guardados en Supabase.', 'success');
            } catch (e) {
                console.error('importarClientesExcel', e);
                const msg = (e && e.message) ? e.message : String(e);
                setClientesImportMsg('Error: ' + msg);
                showToast('Error al guardar clientes: ' + msg, 'error');
            }
        }

        async function cargarClientesDesdeNube() {
            if (!esAdmin()) return;
            const st = document.getElementById('adminClientesStatus');
            try {
                // Supabase/PostgREST limita ~1000 filas por petición: hay que paginar
                const PAGE = 1000;
                let all = [];
                let from = 0;
                for (;;) {
                    const { data, error } = await supabaseClient
                        .from('clientes')
                        .select('*')
                        .order('nombre', { ascending: true })
                        .range(from, from + PAGE - 1);
                    if (error) throw error;
                    if (!data || !data.length) break;
                    all = all.concat(data);
                    if (data.length < PAGE) break;
                    from += PAGE;
                    // Tope de seguridad
                    if (from >= 50000) break;
                }
                clientesData = all;
                if (st) st.textContent = clientesData.length
                    ? ('✅ ' + clientesData.length + ' clientes en la nube.')
                    : 'Sin clientes en la nube. Usa Actualizar base abajo.';
                const inp = document.getElementById('adminClienteInput');
                buscarClientesAdmin(inp ? inp.value : '');
            } catch (e) {
                if (st) st.textContent = 'No se pudo cargar (¿tabla clientes?). ' + (e.message || '');
                console.warn(e);
            }
        }

        function buscarClientesAdmin(term) {
            const list = document.getElementById('adminClienteList');
            const countEl = document.getElementById('adminClienteCount');
            if (!list) return;
            const q = String(term || '').trim().toUpperCase();
            if (!clientesData.length) {
                list.innerHTML = '<p class="admin-sesiones-empty">No hay clientes cargados. Sube el Excel.</p>';
                if (countEl) countEl.textContent = '0';
                return;
            }
            let hits = clientesData;
            if (q) {
                const palabras = q.split(/\s+/).filter(Boolean);
                hits = clientesData.filter(function (c) {
                    const campos = [
                        c.codigo, c.nombre, c.categoria, c.tipo_cliente,
                        c.doc_identidad, c.direccion, c.distrito,
                        c.codigo_zona, c.descripcion_zona
                    ].map(function (x) { return String(x || '').toUpperCase(); });
                    return palabras.every(function (p) {
                        return campos.some(function (f) { return f.indexOf(p) !== -1; });
                    });
                });
            }
            if (countEl) countEl.textContent = String(hits.length);
            const show = hits.slice(0, 60);
            if (!show.length) {
                list.innerHTML = '<p class="admin-sesiones-empty">Sin coincidencias.</p>';
                return;
            }
            list.innerHTML = show.map(function (c) {
                return '<div class="admin-catalog-item">' +
                    '<div class="aci-cod">' + escapeCli(c.codigo) + ' · ' + escapeCli(c.nombre) + '</div>' +
                    '<div class="aci-desc">' + escapeCli(c.direccion || '-') +
                    (c.distrito ? ' — ' + escapeCli(c.distrito) : '') + '</div>' +
                    '<div class="aci-meta">' +
                    escapeCli(c.tipo_doc || '') + ' ' + escapeCli(c.doc_identidad || '') +
                    ' · ' + escapeCli(c.categoria || c.tipo_cliente || '') +
                    ' · Zona: ' + escapeCli(c.codigo_zona || '-') +
                    (c.descripcion_zona ? ' ' + escapeCli(c.descripcion_zona) : '') +
                    (c.linea_credito != null ? ' · Crédito: ' + c.linea_credito : '') +
                    '</div></div>';
            }).join('');
        }


        function cerrarHeaderMenu() {
            const btn = document.getElementById('headerMenuBtn');
            const dd = document.getElementById('headerMenuDropdown');
            if (dd) dd.hidden = true;
            if (btn) btn.setAttribute('aria-expanded', 'false');
        }
        function toggleHeaderMenu() {
            const btn = document.getElementById('headerMenuBtn');
            const dd = document.getElementById('headerMenuDropdown');
            if (!dd || !btn) return;
            const open = dd.hidden;
            dd.hidden = !open;
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }

        function init() {
            try { purgarBarrasLocalConflictivas(); } catch (e) {}
            cargarTema();
            if (typeof cablearBotonesTema === 'function') cablearBotonesTema();
            else {
                if (themeToggleBtn) themeToggleBtn.addEventListener('click', alternarTema);
                var lt = document.getElementById('loginThemeToggleBtn');
                if (lt) lt.addEventListener('click', alternarTema);
            }
            initCardsPlegables();

            // Menú admin del header (solo opciones administrativas)
            const headerMenuBtn = document.getElementById('headerMenuBtn');
            if (headerMenuBtn) {
                headerMenuBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof cerrarSugerenciasBusqueda === 'function') cerrarSugerenciasBusqueda();
                    toggleHeaderMenu();
                });
                // Acceso rápido: doble toque abre admin directo (por si el desplegable falla)
                headerMenuBtn.addEventListener('dblclick', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof abrirAdminEnSeccion === 'function') abrirAdminEnSeccion('subir');
                });
            }
            const headerMenuDropdown = document.getElementById('headerMenuDropdown');
            if (headerMenuDropdown) {
                headerMenuDropdown.addEventListener('click', function (e) {
                    const actionItem = e.target.closest('[data-header-action]');
                    if (actionItem) {
                        e.preventDefault();
                        e.stopPropagation();
                        const act = actionItem.getAttribute('data-header-action');
                        cerrarHeaderMenu();
                        if (act === 'tema') {
                            const t = document.getElementById('themeToggleBtn');
                            if (t) t.click();
                            else if (typeof alternarTema === 'function') alternarTema();
                        } else if (act === 'logout') {
                            const b = document.getElementById('logoutBtn');
                            if (b) b.click();
                        } else if (act === 'alerta') {
                            // No usar icono del header; ir a listado admin o FAB
                            if (typeof abrirAdminEnSeccion === 'function') {
                                abrirAdminEnSeccion('vencimientos');
                            } else {
                                const fab = document.getElementById('fabAlertaVenc');
                                if (fab) fab.click();
                            }
                        }
                        return;
                    }
                    const item = e.target.closest('[data-admin-goto]');
                    if (!item) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const tab = item.getAttribute('data-admin-goto') || 'subir';
                    cerrarHeaderMenu();
                    // Diferir un tick: en PC el click del document a veces cierra antes de abrir
                    setTimeout(function () {
                        try { abrirAdminEnSeccion(tab); } catch (err) {
                            console.error('abrirAdmin', err);
                            try {
                                var ov = document.getElementById('adminOverlay');
                                if (ov) {
                                    ov.classList.add('visible');
                                    ov.setAttribute('aria-hidden', 'false');
                                    document.body.classList.add('admin-open');
                                }
                                if (typeof window.cambiarTabAdmin === 'function') window.cambiarTabAdmin(tab);
                            } catch (e2) {}
                        }
                    }, 10);
                });
            }
            document.addEventListener('click', function (e) {
                const wrap = document.getElementById('headerMenuWrap');
                if (wrap && !wrap.contains(e.target)) cerrarHeaderMenu();

                // Cerrar sugerencias de productos al tocar fuera del buscador / lista
                try {
                    var t = e.target;
                    var enBuscador = t && t.closest && (
                        t.closest('#searchSection') ||
                        t.closest('#searchSuggestWrap') ||
                        t.closest('#resultList') ||
                        t.closest('.result-item') ||
                        t.id === 'searchInput'
                    );
                    // No cerrar si el clic es en la lista de resultados (selección)
                    if (!enBuscador && typeof cerrarSugerenciasBusqueda === 'function') {
                        // Si hay texto y lista abierta, colapsar
                        if (document.body.classList.contains('search-open') ||
                            (resultList && resultList.classList.contains('result-list-open'))) {
                            cerrarSugerenciasBusqueda();
                        }
                    }
                } catch (errSug) {}
            });
            document.addEventListener('keydown', function (e) {
                if (e.key !== 'Escape') return;
                cerrarHeaderMenu();
                if (typeof cerrarSugerenciasBusqueda === 'function') cerrarSugerenciasBusqueda();
                const ov = document.getElementById('adminOverlay');
                if (ov && ov.classList.contains('visible') && typeof cerrarPanelAdmin === 'function') {
                    cerrarPanelAdmin();
                }
            });

            poblarSelectDia();
            poblarSelectMes();
            poblarYearTabs();
            resetVencimientoAHoy();

            loadInventario();
            renderInventario();
            loadPedido();
            loadFromGoogleSheets();

            const adminCloseBtn = document.getElementById('adminCloseBtn');
            const adminCancelBtn = document.getElementById('adminCancelBtn');
            if (adminCloseBtn) adminCloseBtn.addEventListener('click', cerrarPanelAdmin);
            if (adminCancelBtn) adminCancelBtn.addEventListener('click', cerrarPanelAdmin);

            // Pestañas admin (también hay delegación global más abajo)

            const adminOverlay = document.getElementById('adminOverlay');
            if (adminOverlay) {
                adminOverlay.addEventListener('click', function (e) {
                    if (e.target === adminOverlay) cerrarPanelAdmin();
                });
            }
            const importExcelInput = document.getElementById('importExcelInput');
            const adminDropzone = document.getElementById('adminDropzone');
            if (importExcelInput) {
                importExcelInput.addEventListener('change', function () {
                    const file = this.files && this.files[0];
                    if (file) seleccionarArchivoAdmin(file);
                });
            }
            if (adminDropzone && importExcelInput) {
                adminDropzone.addEventListener('click', function (e) {
                    if (e.target !== importExcelInput) importExcelInput.click();
                });
                adminDropzone.addEventListener('dragover', function (e) {
                    e.preventDefault();
                    adminDropzone.classList.add('dragover');
                });
                adminDropzone.addEventListener('dragleave', function () {
                    adminDropzone.classList.remove('dragover');
                });
                adminDropzone.addEventListener('drop', function (e) {
                    e.preventDefault();
                    adminDropzone.classList.remove('dragover');
                    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                    if (file) seleccionarArchivoAdmin(file);
                });
            }

            const btnLimpiarSap = document.getElementById('btnLimpiarCodigosSap');
            if (btnLimpiarSap) btnLimpiarSap.addEventListener('click', function () { limpiarCodigosSapComoProducto(); });
            const btnExcelSis = document.getElementById('btnDescargarExcelSistema');
            if (btnExcelSis) btnExcelSis.addEventListener('click', function () { descargarExcelSistemaUI(); });
            const btnConteoMes = document.getElementById('btnDescargarConteoMes');
            if (btnConteoMes) btnConteoMes.addEventListener('click', function () { descargarConteoMesUI(); });
            const btnAmbos = document.getElementById('btnDescargarAmbosYLimpiar');
            if (btnAmbos) btnAmbos.addEventListener('click', function () { descargarAmbosYLimpiarUI(); });
            // compat ids viejos
            const btnZipMes = document.getElementById('btnDescargarZipMes');
            if (btnZipMes) btnZipMes.addEventListener('click', function () { descargarAmbosYLimpiarUI(); });
            const btnZipOk = document.getElementById('btnMarcarZipDescargado');
            if (btnZipOk) btnZipOk.addEventListener('click', function () { marcarZipMesDescargado(); });
            const btnLimpiarOld = document.getElementById('btnLimpiarConteosViejos');
            if (btnLimpiarOld) btnLimpiarOld.addEventListener('click', function () { limpiarConteosMesesAnteriores(); });
            try { actualizarEstadoRespaldoUI(); } catch (e) {}

            const adminImportBtn = document.getElementById('adminImportBtn');
            if (adminImportBtn) {
                adminImportBtn.addEventListener('click', async function () {
                    if (!adminSelectedFile) {
                        showToast('Elige un archivo Excel primero.', 'error');
                        return;
                    }
                    adminImportBtn.disabled = true;
                    const statusEl = document.getElementById('adminStatus');
                    if (statusEl) {
                        statusEl.textContent = 'Subiendo a Supabase... espera unos segundos.';
                        statusEl.className = 'admin-status admin-status-info';
                    }
                    try {
                        const solo = document.getElementById('adminSoloCatalogo');
                        const modoBaseEl = document.getElementById('adminModoBase');
                        const modoValEl = document.getElementById('adminModoValorado');
                        const modoBase = !!(modoBaseEl && modoBaseEl.checked);
                        const modoValorado = !!(modoValEl && modoValEl.checked);
                        window.__iemLastExcelFile = adminSelectedFile;
                        await importarExcelASupabase(adminSelectedFile, {
                            soloCatalogo: !!(solo && solo.checked),
                            modoBase: modoBase,
                            modoValorado: modoValorado,
                            modo: modoBase ? 'base' : (modoValorado ? 'valorado' : 'existencias')
                        });
                        if (statusEl) {
                            statusEl.textContent = 'Listo. Revisa el mensaje arriba o el toast.';
                            statusEl.className = 'admin-status admin-status-success';
                        }
                        adminImportBtn.disabled = false;
                    } catch (e) {
                        console.error(e);
                        const msg = 'Error: ' + (e && e.message ? e.message : e);
                        if (statusEl) {
                            statusEl.textContent = msg;
                            statusEl.className = 'admin-status admin-status-error';
                        }
                        showToast(msg, 'error');
                        adminImportBtn.disabled = false;
                    }
                });
            }
            const adminExportInvBtn = document.getElementById('adminExportInvBtn');
            if (adminExportInvBtn) {
                adminExportInvBtn.addEventListener('click', function () {
                    if (!esAdmin()) return;
                    exportarInventario();
                });
            }
            const adminExportUltimoEnviadoBtn = document.getElementById('adminExportUltimoEnviadoBtn');
            if (adminExportUltimoEnviadoBtn) {
                adminExportUltimoEnviadoBtn.addEventListener('click', function () {
                    if (!esAdmin()) return;
                    descargarInventarioEnviadoExcel(null);
                });
            }
            const adminListarEnviadosBtn = document.getElementById('adminListarEnviadosBtn');
            if (adminListarEnviadosBtn) {
                adminListarEnviadosBtn.addEventListener('click', function () {
                    if (!esAdmin()) return;
                    listarInventariosEnviados();
                });
            }
            const adminCatalogInput = document.getElementById('adminCatalogInput');
            if (adminCatalogInput) {
                let tCat = null;
                adminCatalogInput.addEventListener('input', function () {
                    clearTimeout(tCat);
                    const v = this.value;
                    tCat = setTimeout(function () { buscarCatalogoAdmin(v); }, 200);
                });
            }
            const importClientesInput = document.getElementById('importClientesInput');
            const adminClientesImportBtn = document.getElementById('adminClientesImportBtn');
            if (adminClientesImportBtn && importClientesInput) {
                adminClientesImportBtn.addEventListener('click', function () {
                    importClientesInput.click();
                });
            }
            if (importClientesInput) {
                importClientesInput.addEventListener('change', function () {
                    const f = this.files && this.files[0];
                    if (f) importarClientesExcel(f);
                    this.value = '';
                });
            }
            const adminClienteInput = document.getElementById('adminClienteInput');
            if (adminClienteInput) {
                let tCli = null;
                adminClienteInput.addEventListener('input', function () {
                    clearTimeout(tCli);
                    const v = this.value;
                    tCli = setTimeout(function () { buscarClientesAdmin(v); }, 200);
                });
            }

            const adminCatalogSoloCero = document.getElementById('adminCatalogSoloCero');
            if (adminCatalogSoloCero) {
                adminCatalogSoloCero.addEventListener('change', function () {
                    const inp = document.getElementById('adminCatalogInput');
                    buscarCatalogoAdmin(inp ? inp.value : '');
                });
            }
            // Admin catálogo: guardar / limpiar URL de imagen
            const adminCatalogList = document.getElementById('adminCatalogList');
            if (adminCatalogList) {
                adminCatalogList.addEventListener('click', function (e) {
                    const btn = e.target.closest('.aci-img-save, .aci-img-clear');
                    if (!btn) return;
                    e.preventDefault();
                    const cod = btn.getAttribute('data-codigo');
                    if (!cod) return;
                    if (btn.classList.contains('aci-img-clear')) {
                        confirmarAccion('¿Quitar la imagen de este producto?', 'Quitar', 'danger').then(function (ok) {
                            if (ok) guardarImagenProductoAdmin(cod, '');
                        });
                        return;
                    }
                    const row = btn.closest('.admin-catalog-item');
                    const input = row ? row.querySelector('.aci-img-input') : null;
                    const url = input ? input.value : '';
                    btn.disabled = true;
                    guardarImagenProductoAdmin(cod, url).finally(function () {
                        btn.disabled = false;
                    });
                });
            }
            const btnBorrarTodasImagenes = document.getElementById('btnBorrarTodasImagenes');
            if (btnBorrarTodasImagenes) {
                btnBorrarTodasImagenes.addEventListener('click', function () {
                    borrarTodasImagenesAdmin();
                });
            }
            const btnBuscarImagenesLaive = document.getElementById('btnBuscarImagenesLaive');
            if (btnBuscarImagenesLaive) {
                btnBuscarImagenesLaive.addEventListener('click', function () {
                    buscarImagenesFaltantesLaive();
                });
            }
            // Admin: herramienta códigos de barras / QR
            const adminBarrasInput = document.getElementById('adminBarrasInput');
            if (adminBarrasInput) {
                let tBar = null;
                adminBarrasInput.addEventListener('input', function () {
                    clearTimeout(tBar);
                    const v = this.value;
                    tBar = setTimeout(function () { buscarBarrasAdmin(v); }, 200);
                });
            }
            const adminBarrasSoloSin = document.getElementById('adminBarrasSoloSin');
            if (adminBarrasSoloSin) {
                adminBarrasSoloSin.addEventListener('change', function () {
                    const inp = document.getElementById('adminBarrasInput');
                    buscarBarrasAdmin(inp ? inp.value : '');
                });
            }
            const adminBarrasList = document.getElementById('adminBarrasList');
            if (adminBarrasList) {
                adminBarrasList.addEventListener('click', function (e) {
                    const row = e.target.closest('.admin-barras-item');
                    if (!row) return;
                    const cod = row.getAttribute('data-codigo');
                    if (cod) seleccionarProductoBarrasAdmin(cod);
                });
                adminBarrasList.addEventListener('keydown', function (e) {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    const row = e.target.closest('.admin-barras-item');
                    if (!row) return;
                    e.preventDefault();
                    const cod = row.getAttribute('data-codigo');
                    if (cod) seleccionarProductoBarrasAdmin(cod);
                });
            }
            // Frios / Secos: conectar botones (antes no tenían listener)
            document.querySelectorAll('[data-filtro-tipo]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    setFiltroTipoLaive(btn.getAttribute('data-filtro-tipo') || '');
                });
            });

            const adminRefreshVistaBtn = document.getElementById('adminRefreshVistaBtn');
            if (adminRefreshVistaBtn) {
                adminRefreshVistaBtn.addEventListener('click', function () {
                    if (!esAdmin()) return;
                    renderVistaPreviaInventario();
                });
            }
            const adminPdfInvBtn = document.getElementById('adminPdfInvBtn');
            if (adminPdfInvBtn) {
                adminPdfInvBtn.addEventListener('click', function () {
                    if (!esAdmin()) return;
                    exportarInventarioPDF();
                });
            }
            // Reporte del sistema (stock Excel): filtros + PDF
            document.querySelectorAll('[data-filtro-tipo-reporte]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    setFiltroTipoReporte(btn.getAttribute('data-filtro-tipo-reporte') || '');
                });
            });
            const adminRefreshReporteBtn = document.getElementById('adminRefreshReporteBtn');
            if (adminRefreshReporteBtn) {
                adminRefreshReporteBtn.addEventListener('click', function () {
                    if (!esAdmin()) return;
                    renderReporteSistema();
                });
            }
            const adminPdfReporteBtn = document.getElementById('adminPdfReporteBtn');
            if (adminPdfReporteBtn) {
                adminPdfReporteBtn.addEventListener('click', function () {
                    if (!esAdmin()) return;
                    exportarReporteSistemaPDF();
                });
            }
            const adminExportPedidoBtn = document.getElementById('adminExportPedidoBtn');
            if (adminExportPedidoBtn) {
                adminExportPedidoBtn.addEventListener('click', function () {
                    if (!esAdmin()) return;
                    exportarPedido();
                });
            }
            const adminRefreshSesionesBtn = document.getElementById('adminRefreshSesionesBtn');
            if (adminRefreshSesionesBtn) {
                adminRefreshSesionesBtn.addEventListener('click', function () {
                    if (!esAdmin()) return;
                    cargarSesionesActivas();
                });
            }
            const adminLimpiarSesionesBtn = document.getElementById('adminLimpiarSesionesBtn');
            if (adminLimpiarSesionesBtn) {
                adminLimpiarSesionesBtn.addEventListener('click', function () {
                    if (!esAdmin()) return;
                    if (typeof limpiarSesionesInactivas === 'function') limpiarSesionesInactivas();
                });
            }

            // Sincronización en vivo del conteo compartido entre celulares.
            sincronizarDesdeServidor();
            if (syncTimer) clearInterval(syncTimer);
            syncTimer = setInterval(sincronizarDesdeServidor, 10000);
            try {
                supabaseClient.channel('conteos-vivos')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'lotes_conteo' },
                        () => { sincronizarDesdeServidor(); })
                    .subscribe();
            } catch (e) { console.warn('Realtime no disponible', e); }


            refreshBtn.addEventListener('click', function() {
                const icon = this.querySelector('.btn-icon');
                if (icon) icon.textContent = '⏳';
                loadFromGoogleSheets();
                setTimeout(() => { if (icon) icon.textContent = '🔄'; }, 1500);
            });

            if (autoRefreshTimer) clearInterval(autoRefreshTimer);
            autoRefreshTimer = setInterval(loadFromGoogleSheets, 300000);
            // Al volver a la pestaña, refrescar de inmediato solo si el
            // usuario no tiene una búsqueda/selección en curso.
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && !searchInput.value.trim() && selectedIndex === -1) {
                    loadFromGoogleSheets();
                }
            });

            searchButton.addEventListener('click', performSearch);
            const scanBarcodeBtn = document.getElementById('scanBarcodeBtn');
            if (scanBarcodeBtn) scanBarcodeBtn.addEventListener('click', function () { abrirEscaner('buscar'); });
            const scanCloseBtn = document.getElementById('scanCloseBtn');
            const scanCancelBtn = document.getElementById('scanCancelBtn');
            if (scanCloseBtn) scanCloseBtn.addEventListener('click', detenerEscaner);
            if (scanCancelBtn) scanCancelBtn.addEventListener('click', detenerEscaner);
            const btnVincularBarras = document.getElementById('btnVincularBarras');
            if (btnVincularBarras) btnVincularBarras.addEventListener('click', function () {
                if (!puedeVincularBarras()) return;
                abrirEscaner('vincular');
            });
            // Cámara en la tarjeta del producto (zona marcada): vincular o buscar
            const btnScanProducto = document.getElementById('btnScanProducto');
            if (btnScanProducto) btnScanProducto.addEventListener('click', function () {
                if (!puedeEscanear()) return;
                if (puedeVincularBarras() && selectedIndex >= 0 && selectedIndex < filteredData.length) {
                    abrirEscaner('vincular');
                } else {
                    abrirEscaner('buscar');
                }
            });

            searchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') performSearch(); });
            let debounceTimer;
            searchInput.addEventListener('input', () => {
                // Si había un producto seleccionado (tarjeta grande visible) y el
                // usuario vuelve a escribir en el buscador, se sale de ese modo
                // para poder elegir otro producto de la lista.
                if (selectedIndex !== -1) {
                    selectedIndex = -1;
                    limpiarCantidades();
                }
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(performSearch, 180);
            });

            // btnAgregar se enlaza más abajo (modo pedido + agregarProducto)
            txtCajas.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); txtUnidades.focus(); } });
            txtUnidades.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); agregarProducto(); } });
            txtCajas.addEventListener('input', actualizarTotalCalculado);
            txtUnidades.addEventListener('input', actualizarTotalCalculado);
            // Al salir del campo de unidades sueltas, si escribió más de lo
            // que entra en una caja, se reparte solo en cajas + unidades.
            txtUnidades.addEventListener('blur', normalizarUnidadesACajas);

            // Al tocar/enfocar la casilla de Cajas o Unidades, si tiene "0"
            // se borra por completo para que quede vacía y lista para
            // escribir directamente (en vez de sumarse al cero). Si el
            // usuario sale del campo sin escribir nada, vuelve a mostrar "0".
            [txtCajas, txtUnidades].forEach(inp => {
                function limpiarCero() {
                    if (inp.value === '0') inp.value = '';
                }
                inp.addEventListener('focus', limpiarCero);
                inp.addEventListener('click', limpiarCero);
                inp.addEventListener('touchstart', limpiarCero);
                inp.addEventListener('blur', function() {
                    if (inp.value.trim() === '') inp.value = '0';
                });
                inp.addEventListener('input', function() {
                    if (this.value.length > 1 && this.value.startsWith('0')) {
                        this.value = this.value.replace(/^0+/, '') || '0';
                    }
                });
            });

            btnRegistrarFisico.addEventListener('click', registrarFisico);
            btnCambiarProducto.addEventListener('click', volverABuscar);

            // Pedidos viven en app Ventas — listeners solo si existen nodos (código legado)
            if (exportPedidoBtn) exportPedidoBtn.addEventListener('click', exportarPedido);
            if (guardarPedidoDriveBtn) guardarPedidoDriveBtn.addEventListener('click', guardarPedidoEnDrive);
            if (limpiarPedidoBtn) limpiarPedidoBtn.addEventListener('click', limpiarPedido);

            const btnArmarPedido = document.getElementById('btnArmarPedido');
            if (btnArmarPedido) btnArmarPedido.addEventListener('click', function () {
                showToast('Los pedidos se arman en la app Ventas.', 'info');
            });
            const btnSalirModoPedido = document.getElementById('btnSalirModoPedido');
            if (btnSalirModoPedido) btnSalirModoPedido.addEventListener('click', salirModoPedido);
            // btnAgregar (pedido) eliminado del HTML de inventario

            const enviarInventarioBtn = document.getElementById('enviarInventarioBtn');
            if (enviarInventarioBtn) enviarInventarioBtn.addEventListener('click', enviarInventarioCompleto);

            document.querySelectorAll('.diff-filtro-btn[data-diff-filtro]').forEach(btn => {
                btn.addEventListener('click', function () {
                    filtroDiffModo = this.getAttribute('data-diff-filtro') || 'todos';
                    try { localStorage.setItem('iem_filtro_diff', filtroDiffModo); } catch (e) {}
                    renderInventario();
                });
            });
            (function initAlertaVencUI() {
                const btn = document.getElementById('btnAlertaVenc');
                const panel = document.getElementById('panelAlertaVenc');
                const cerrar = document.getElementById('btnCerrarAlertaVenc');
                if (!btn || !panel) return;
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const open = panel.hidden;
                    panel.hidden = !open;
                    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
                    if (open) actualizarPanelAlertaVenc();
                });
                if (cerrar) cerrar.addEventListener('click', function () {
                    panel.hidden = true; btn.setAttribute('aria-expanded', 'false');
                });
                document.addEventListener('click', function (e) {
                    if (panel.hidden) return;
                    if (panel.contains(e.target) || btn.contains(e.target)) return;
                    panel.hidden = true; btn.setAttribute('aria-expanded', 'false');
                });
            })();
            (function initAdminVencUI() {
                document.querySelectorAll('[data-admin-venc-dias]').forEach(btn => {
                    btn.addEventListener('click', function () {
                        adminVencDiasModo = this.getAttribute('data-admin-venc-dias') || '15';
                        renderAdminVencimientos();
                    });
                });
                const ref = document.getElementById('adminRefreshVencBtn');
                if (ref) ref.addEventListener('click', function () { cargarAdminVencimientos(); });
                const filt = document.getElementById('adminVencFiltro');
                if (filt) {
                    let t; filt.addEventListener('input', function () {
                        clearTimeout(t); t = setTimeout(renderAdminVencimientos, 180);
                    });
                }
            })();

            exportDiffBtn.addEventListener('click', exportarInventario);
            clearDiffBtn.addEventListener('click', limpiarInventario);
            if (guardarDriveBtn) guardarDriveBtn.addEventListener('click', guardarInventarioDrive);
        }


        // ============================================================
        // PESTAÑAS DEL PANEL ADMIN (delegación global = siempre clicables)
        // ============================================================
        function mostrarTabAdmin(tabId) {
            if (typeof window.cambiarTabAdmin === 'function') window.cambiarTabAdmin(tabId);
        }

        // Clic / toque en menú lateral admin: cambiar pestaña SIN cerrar el panel
        document.addEventListener('click', function (e) {
            const btn = e.target && e.target.closest && e.target.closest('.admin-nav-btn');
            if (!btn) return;
            // Solo si el panel admin está abierto
            var ov = document.getElementById('adminOverlay');
            if (!ov || !ov.classList.contains('visible')) return;
            e.preventDefault();
            e.stopPropagation();
            const tab = btn.getAttribute('data-admin-tab');
            if (!tab) return;
            if (typeof window.cambiarTabAdmin === 'function') window.cambiarTabAdmin(tab);
            // Hash con replace: no genera "atrás" ni cierra el panel
            try {
                _hashNavSilent = true;
                history.replaceState({ iemGuard: 1, iemAdmin: tab }, '', '#/admin/' + tab);
                setTimeout(function () { _hashNavSilent = false; }, 50);
            } catch (err) {
                _hashNavSilent = false;
            }
        }, true);

        // ============================================================
        // HASH ROUTING — navegación en la misma ventana (sin React)
        // Ejemplos:
        //   #/              → inventario (pantalla principal)
        //   #/admin         → administración (pestaña por defecto)
        //   #/admin/barras  → sección Barras / QR
        // El botón "atrás" del navegador también funciona.
        // ============================================================
        const ADMIN_TABS = ['subir', 'catalogo', 'barras', 'descargas', 'respaldos', 'vista', 'reporte', 'pedidos', 'vencimientos', 'clientes', 'sesiones'];
        let _hashNavSilent = false;

        function parseHashRuta() {
            var raw = String(location.hash || '').replace(/^#/, '').trim();
            if (!raw || raw === '/') return { vista: 'app', tab: null };
            var parts = raw.replace(/^\//, '').split('/').filter(Boolean);
            if (parts[0] === 'admin') {
                var tab = parts[1] && ADMIN_TABS.indexOf(parts[1]) >= 0 ? parts[1] : 'subir';
                return { vista: 'admin', tab: tab };
            }
            return { vista: 'app', tab: null };
        }

        function navegarHash(hash, replace) {
            var h = hash || '#/';
            if (!h.startsWith('#')) h = '#' + h;
            var current = location.hash || '#/';
            if (current === h || current === h + '/') {
                aplicarRutaHash();
                return;
            }
            _hashNavSilent = true;
            if (replace) {
                try { history.replaceState(null, '', h); } catch (e) { location.hash = h; }
            } else {
                location.hash = h;
            }
            aplicarRutaHash();
            setTimeout(function () { _hashNavSilent = false; }, 50);
        }

        function aplicarRutaHash() {
            var ruta = parseHashRuta();
            if (ruta.vista === 'admin') {
                if (typeof esAdmin === 'function' && !esAdmin()) {
                    showToast('Solo el administrador puede entrar aquí.', 'error');
                    navegarHash('#/', true);
                    return;
                }
                const ov = document.getElementById('adminOverlay');
                if (typeof abrirPanelAdmin === 'function') {
                    _abriendoDesdeHash = true;
                    abrirPanelAdmin(ruta.tab);
                    _abriendoDesdeHash = false;
                }
                if (ov) {
                    ov.classList.add('visible');
                    ov.style.display = 'flex';
                    ov.setAttribute('aria-hidden', 'false');
                }
                document.body.classList.add('admin-open');
                if (typeof window.cambiarTabAdmin === 'function') {
                    window.cambiarTabAdmin(ruta.tab);
                }
            } else {
                if (typeof cerrarPanelAdmin === 'function') {
                    _cerrandoDesdeHash = true;
                    cerrarPanelAdmin();
                    _cerrandoDesdeHash = false;
                }
            }
        }

        var _abriendoDesdeHash = false;
        var _cerrandoDesdeHash = false;

        window.addEventListener('hashchange', function () {
            if (_hashNavSilent) return;
            aplicarRutaHash();
        });

        // ============================================================
        // INICIO DE SESIÓN — Supabase Auth
        // ============================================================
        // Login con auth.signInWithPassword (JWT). El rol se lee de la
        // tabla public.perfiles (no de app_usuarios). Ejecuta primero
        // MIGRACION_SUPABASE_AUTH.sql y crea usuarios en Authentication.
        // ============================================================

        const SESSION_KEY = 'iem_sesion_activa';
        const AUTH_EMAIL_DOMAIN = 'iem.local'; // luis → luis@iem.local
        // Sesión válida con actividad reciente (20 min de inactividad real).
        // F5 / recarga NO debe cerrar sesión si aún no venció la inactividad
        // (tocarSesion() se llama también al arrancar/recargar, más abajo).
        // Nota: el "cierre solo" que pasaba antes en PC era porque solo se
        // consideraba actividad el click/tecla; ahora también cuenta
        // mousemove/scroll/wheel (ver listeners de tocarSesionThrottled),
        // así que 20 min reales ya no deberían molestar a alguien que sigue
        // usando la pantalla sin hacer click.
        const SESSION_IDLE_MS = 20 * 60 * 1000;

        // Aplicar clase vendedor desde la URL lo antes posible
        (function () {
            try {
                if (/(?:\?|&)modo=vendedor(?:&|$)/i.test(location.search || '')) {
                    document.body.classList.add('modo-vendedor');
                }
            } catch (e) {}
        })();

        const LOGIN_MAX_INTENTOS = 5;
        const LOGIN_BLOQUEO_MS = 60 * 1000;
        let loginIntentos = 0;
        let loginBloqueoHasta = 0;

        const loginOverlay = document.getElementById('loginOverlay');
        const loginUsuario = document.getElementById('loginUsuario');
        const loginClave = document.getElementById('loginClave');
        const loginError = document.getElementById('loginError');
        const loginBtn = document.getElementById('loginBtn');
        const appContainer = document.getElementById('appContainer');
        const usuarioBadge = document.getElementById('usuarioBadge');
        const usuarioBadgeTexto = document.getElementById('usuarioBadgeTexto');
        let appIniciado = false;

        let usuarioActual = '';
        let rolUsuario = '';

        function mismoDia(ts) {
            const a = new Date(ts);
            const b = new Date();
            return a.getFullYear() === b.getFullYear() &&
                   a.getMonth() === b.getMonth() &&
                   a.getDate() === b.getDate();
        }

        function usuarioAEmail(usuario) {
            const u = String(usuario || '').trim().toLowerCase();
            if (!u) return '';
            if (u.includes('@')) return u;
            return u + '@' + AUTH_EMAIL_DOMAIN;
        }

        function guardarMetaSesion(usuario, rol) {
            try {
                localStorage.setItem(SESSION_KEY, JSON.stringify({
                    ts: Date.now(),
                    usuario: usuario || usuarioActual || '',
                    rol: rol || rolUsuario || '',
                    deviceId: deviceId
                }));
            } catch (e) {}
        }

        /** Renueva el timestamp de actividad (llamar en uso real de la app). */
        function tocarSesion() {
            if (!usuarioActual) return;
            guardarMetaSesion(usuarioActual, rolUsuario);
        }

        function leerMetaSesion() {
            try {
                const raw = localStorage.getItem(SESSION_KEY);
                if (!raw) return null;
                const data = JSON.parse(raw);
                if (!data || !data.ts) return null;
                // Solo inactividad (SESSION_IDLE_MS). No validamos deviceId aquí para que F5 no cierre sesión.
                if (Date.now() - data.ts > SESSION_IDLE_MS) return null;
                return data;
            } catch (e) {
                return null;
            }
        }

        /** Usuarios con acceso admin forzado (además del rol en tabla perfiles).
         * Preferir rol=admin en public.perfiles. Esta lista es respaldo operativo.
         * Se puede ampliar con window.IEM_CONFIG.ADMIN_USUARIOS = ['...'] en config.js */
        var ADMIN_USUARIOS = (window.IEM_CONFIG && Array.isArray(window.IEM_CONFIG.ADMIN_USUARIOS) && window.IEM_CONFIG.ADMIN_USUARIOS.length)
            ? window.IEM_CONFIG.ADMIN_USUARIOS.slice()
            : ['luis', 'andric'];

        function esUsuarioAdminForzado(nombre) {
            var u = String(nombre || usuarioActual || '').toLowerCase().trim();
            if (!u) return false;
            return ADMIN_USUARIOS.some(function (x) {
                return String(x).toLowerCase().trim() === u;
            });
        }

        function esAdmin() {
            if (String(rolUsuario || '').toLowerCase() === 'admin') return true;
            return esUsuarioAdminForzado(usuarioActual);
        }

        /** Usuarios (login) que pueden escanear QR/barras para buscar. Admin siempre puede. */
        var SCAN_USUARIOS_PERMITIDOS = ['adelante'];

        function puedeEscanear() {
            if (esAdmin()) return true;
            var u = String(usuarioActual || '').toLowerCase().trim();
            if (!u) return false;
            return SCAN_USUARIOS_PERMITIDOS.some(function (x) {
                return String(x).toLowerCase().trim() === u;
            });
        }

        /** Solo admin vincula barras a productos; el resto (p.ej. adelante) solo busca. */
        function puedeVincularBarras() {
            return esAdmin();
        }

        function esVendedor() {
            if (String(rolUsuario || '').toLowerCase() === 'vendedor') return true;
            try {
                return /(?:\?|&)modo=vendedor(?:&|$)/i.test(location.search || '');
            } catch (e) { return false; }
        }



        /** Muestra u oculta la tarjeta Inventario según si estás contando. */
        window.__iemSyncInventarioCard = function () {
            try {
                var dh = document.getElementById('diffCardHeader');
                var card = dh && dh.closest('.card, section');
                if (!card) return;
                var contando = document.body.classList.contains('modo-seleccion');
                if (contando) {
                    if (typeof setCardExpandida === 'function') setCardExpandida('diff', false);
                    document.body.classList.remove('inv-fisico-abierto');
                    card.setAttribute('data-hidden-while-counting', '1');
                    card.style.setProperty('display', 'none', 'important');
                } else {
                    card.removeAttribute('data-hidden-while-counting');
                    card.style.removeProperty('display');
                    // queda minimizado (solo cabecera) hasta que el usuario lo abra
                    if (typeof setCardExpandida === 'function') setCardExpandida('diff', false);
                }
            } catch (e) {}
        };

        /** FAB calculadora: solo visible en tarjeta de producto (admin). */
        window.__iemSyncFabCalc = function () {
            try {
                var fab = document.getElementById('fabCalc');
                if (!fab) return;
                var admin = document.body.classList.contains('es-admin');
                var contando = document.body.classList.contains('modo-seleccion');
                if (admin && contando) {
                    fab.removeAttribute('hidden');
                    fab.style.removeProperty('display');
                    fab.style.removeProperty('visibility');
                } else {
                    fab.setAttribute('hidden', '');
                    // si la calc estaba abierta fuera de conteo, cerrar
                    if (!contando) {
                        try {
                            document.body.classList.remove('calc-open');
                            var ov = document.getElementById('calcOverlay');
                            if (ov) {
                                ov.hidden = true;
                                ov.setAttribute('hidden', '');
                                ov.classList.remove('visible');
                                ov.style.display = 'none';
                            }
                        } catch (eC) {}
                    }
                }
            } catch (e) {}
        };

        function actualizarUIPorRol() {
            const es = esAdmin();
            const vend = esVendedor();
            document.body.classList.toggle('es-admin', !!es);
            document.body.classList.toggle('modo-vendedor', !!vend && !es);
            const menuWrap = document.getElementById('headerMenuWrap');
            if (menuWrap) menuWrap.style.display = es ? '' : 'none';
            // Calculadora: solo admin + tarjeta de producto (modo conteo)
            if (typeof window.__iemSyncFabCalc === 'function') window.__iemSyncFabCalc();
            // Excel: disponible para admin y usuarios de conteo (guardar su conteo terminado)
            const exportBtn = document.getElementById('exportDiffBtn');
            if (exportBtn) exportBtn.style.display = (es || !vend) ? '' : 'none';
            // Limpiar, Nube y Pedido: solo admin
            ['clearDiffBtn', 'exportPedidoBtn'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = es ? '' : 'none';
            });
            const puedeScan = (typeof puedeEscanear === 'function') ? puedeEscanear() : es;
            const scanBtn = document.getElementById('scanBarcodeBtn');
            if (scanBtn) scanBtn.style.setProperty('display', puedeScan ? 'inline-flex' : 'none', 'important');
            const vincRow = document.getElementById('vincularBarrasRow');
            if (vincRow) vincRow.style.display = es ? '' : 'none';
            const scanProd = document.getElementById('btnScanProducto');
            // Cámara en tarjeta: admin (vincular) o usuario permitido (buscar)
            if (scanProd) scanProd.style.display = puedeScan ? '' : 'none';
            if (typeof actualizarFilaVincular === 'function') actualizarFilaVincular();

            // Vendedor: solo sugerencia de pedido
            if (vend && !es) {
                document.body.classList.add('modo-vendedor');
                // Ocultar inventario físico (tarjeta completa)
                const diffHeader = document.getElementById('diffCardHeader');
                if (diffHeader) {
                    const card = diffHeader.closest('.card, section');
                    if (card) card.style.display = 'none';
                }
                const diffBody = document.getElementById('diffCardBody');
                if (diffBody) {
                    const card2 = diffBody.closest('.card, section');
                    if (card2) card2.style.display = 'none';
                }
                const venc = document.getElementById('vencBlock');
                if (venc) venc.style.display = 'none';
                const btnFis = document.getElementById('btnRegistrarFisico');
                if (btnFis) btnFis.style.display = 'none';

                // Abrir pedido
                const pedidoSec = document.getElementById('pedidoSection');
                if (pedidoSec) pedidoSec.style.display = '';
                const pedidoBody = document.getElementById('pedidoCardBody');
                if (pedidoBody) {
                    pedidoBody.classList.remove('is-collapsed');
                    pedidoBody.style.display = 'block';
                }
                if (typeof activarModoPedido === 'function') {
                    try { activarModoPedido(); } catch (e) {}
                }
                // Banner
                var ban = document.getElementById('vendedorBanner');
                if (ban) ban.style.display = 'block';
            } else {
                document.body.classList.remove('modo-vendedor');
                var ban2 = document.getElementById('vendedorBanner');
                if (ban2) ban2.style.display = 'none';
            }
        }

        function abrirAdminEnSeccion(tabId) {
            if (!esAdmin()) {
                showToast('Solo el administrador puede abrir este panel.', 'error');
                return;
            }
            var tab = tabId || 'subir';
            if (typeof ADMIN_TABS !== 'undefined' && ADMIN_TABS.indexOf(tab) < 0) {
                tab = 'subir';
            }
            // Cerrar menú ☰ primero
            if (typeof cerrarHeaderMenu === 'function') cerrarHeaderMenu();
            // Abrir panel SIEMPRE de forma directa (no depender solo del hash)
            try {
                if (typeof abrirPanelAdmin === 'function') {
                    _abriendoDesdeHash = true;
                    abrirPanelAdmin(tab);
                    _abriendoDesdeHash = false;
                }
            } catch (e) {
                console.error('abrirAdminEnSeccion', e);
                _abriendoDesdeHash = false;
            }
            // Forzar visibilidad por si CSS no aplicó .visible
            try {
                var ov = document.getElementById('adminOverlay');
                if (ov) {
                    ov.classList.add('visible');
                    ov.style.display = 'flex';
                    ov.style.visibility = 'visible';
                    ov.style.opacity = '1';
                    ov.style.zIndex = '8000';
                    ov.setAttribute('aria-hidden', 'false');
                }
                document.body.classList.add('admin-open');
                document.body.style.overflow = 'hidden';
                if (typeof window.cambiarTabAdmin === 'function') window.cambiarTabAdmin(tab);
            } catch (e2) {
                console.error(e2);
            }
            // Actualizar hash sin popstate (replace)
            try {
                _hashNavSilent = true;
                history.replaceState({ iemGuard: 1, iemAdmin: tab }, '', '#/admin/' + tab);
                setTimeout(function () { _hashNavSilent = false; }, 80);
            } catch (e3) {
                _hashNavSilent = false;
            }
        }

        let adminSelectedFile = null;

        function abrirPanelAdmin(tabId) {
            if (!esAdmin()) {
                showToast('Solo el administrador puede abrir este panel.', 'error');
                return;
            }
            const ov = document.getElementById('adminOverlay');
            if (!ov) {
                console.error('adminOverlay no encontrado en el DOM');
                showToast('Panel admin no disponible. Recarga la app (Ctrl+Shift+R).', 'error');
                return;
            }
            ov.classList.add('visible');
            ov.style.setProperty('display', 'flex', 'important');
            ov.style.setProperty('visibility', 'visible', 'important');
            ov.style.setProperty('opacity', '1', 'important');
            ov.style.setProperty('z-index', '9500', 'important');
            ov.style.setProperty('pointer-events', 'auto', 'important');
            ov.setAttribute('aria-hidden', 'false');
            document.body.classList.add('admin-open');
            document.body.style.overflow = 'hidden';
            adminSelectedFile = null;
            const nameEl = document.getElementById('adminFileName');
            const statusEl = document.getElementById('adminStatus');
            const importBtn = document.getElementById('adminImportBtn');
            if (nameEl) nameEl.textContent = '';
            if (statusEl) statusEl.textContent = '';
            if (importBtn) importBtn.disabled = true;
            const tab = tabId || 'subir';
            if (typeof window.cambiarTabAdmin === 'function') window.cambiarTabAdmin(tab);
            else if (typeof cargarSesionesActivas === 'function') cargarSesionesActivas();
            const body = ov.querySelector('.admin-panel-body');
            if (body) body.scrollTop = 0;
            // Hash en la misma ventana: #/admin/subir
            if (!_abriendoDesdeHash && typeof navegarHash === 'function') {
                var want = '#/admin/' + tab;
                if (location.hash.replace(/\/$/, '') !== want) {
                    navegarHash(want, true);
                }
            }
        }

        function cerrarPanelAdmin() {
            const ov = document.getElementById('adminOverlay');
            if (ov) {
                ov.classList.remove('visible');
                ov.style.display = 'none';
                ov.style.visibility = '';
                ov.style.opacity = '';
                ov.style.zIndex = '';
                ov.setAttribute('aria-hidden', 'true');
            }
            document.body.classList.remove('admin-open');
            document.body.style.overflow = '';
            adminSelectedFile = null;
            const input = document.getElementById('importExcelInput');
            if (input) input.value = '';
            // Limpiar hash admin para que no quede atrapado ni se reabra solo
            if (!_cerrandoDesdeHash) {
                try {
                    if (/^#\/admin/i.test(location.hash || '')) {
                        _cerrandoDesdeHash = true;
                        try {
                            if (typeof navegarHash === 'function') navegarHash('#/', true);
                            else history.replaceState({ iemGuard: 1 }, '', location.pathname + location.search + '#/');
                        } catch (e) {
                            try { location.hash = '#/'; } catch (e2) {}
                        }
                        _cerrandoDesdeHash = false;
                    }
                } catch (e3) {
                    _cerrandoDesdeHash = false;
                }
            }
        }

        function adminEstaAbierto() {
            var ov = document.getElementById('adminOverlay');
            if (ov && ov.classList.contains('visible')) return true;
            if (document.body.classList.contains('admin-open')) return true;
            if (/^#\/admin/i.test(location.hash || '')) return true;
            return false;
        }

        function seleccionarArchivoAdmin(file) {
            if (!file) return;
            adminSelectedFile = file;
            const nameEl = document.getElementById('adminFileName');
            const importBtn = document.getElementById('adminImportBtn');
            if (nameEl) nameEl.textContent = '📄 ' + file.name + ' (' + Math.round(file.size / 1024) + ' KB)';
            if (importBtn) importBtn.disabled = false;
            // Auto-detectar tipo de Excel y marcar el radio
            (async function () {
                try {
                    if (!window.XLSX) return;
                    const buf = await file.arrayBuffer();
                    const wb = XLSX.read(buf, { type: 'array', sheetRows: 25 });
                    const sheet = wb.Sheets[wb.SheetNames[0]];
                    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                    const flat = (raw || []).slice(0, 20).map(function (r) {
                        return (r || []).map(function (c) { return String(c || ''); }).join(' ');
                    }).join(' | ').toUpperCase()
                        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    let modo = 'existencias';
                    if (flat.indexOf('CODIGO SAP') !== -1 || flat.indexOf('CODIGO UNIFLEX') !== -1) {
                        modo = 'base';
                    } else if (
                        flat.indexOf('INVENTARIOPRODUCTO') !== -1 ||
                        flat.indexOf('INVENTARIO PRODUCTO CODIGO') !== -1 ||
                        flat.indexOf('INVENTARIOALMACEN') !== -1 ||
                        flat.indexOf('INVENTARIO ALMACEN') !== -1
                    ) {
                        modo = 'valorado';
                    }
                    const ids = {
                        existencias: 'adminModoExistencias',
                        valorado: 'adminModoValorado',
                        base: 'adminModoBase'
                    };
                    const el = document.getElementById(ids[modo]);
                    if (el) el.checked = true;
                    const labels = { existencias: 'Existencias', valorado: 'Inventario valorado', base: 'Base Laive' };
                    const st = document.getElementById('adminStatus');
                    if (st) {
                        st.textContent = 'Listo · detectado: ' + labels[modo] + ' (puedes cambiar el tipo arriba)';
                        st.className = 'admin-status admin-status-info';
                    }
                } catch (e) { /* ignore */ }
            })();
        }

        function mostrarApp() {
            try {
                if (typeof window.__iemHideLoading === 'function') window.__iemHideLoading();
                else setGlobalLoading(false);
            } catch (e) {}
            loginOverlay.classList.add('hidden');
            appContainer.classList.remove('oculto');
            if (usuarioBadgeTexto) usuarioBadgeTexto.textContent = usuarioActual || '-';
            actualizarUIPorRol();
            registrarSesionActiva();
            try {
                if (typeof window.__iemPushBackGuard === 'function') window.__iemPushBackGuard();
            } catch (eG) {}
            if (!appIniciado) {
                appIniciado = true;
                init();
            }
            // Si la URL ya trae #/admin/..., abrir esa sección
            if (typeof aplicarRutaHash === 'function') {
                setTimeout(aplicarRutaHash, 50);
            }
        }

        function mostrarLogin() {
            try {
                var lv = document.getElementById('loginVersion');
                if (lv) lv.textContent = 'v' + ((window.IEM && IEM.VERSION) || '4.9.3');
            } catch (eVer) {}

            try {
                if (typeof window.__iemHideLoading === 'function') window.__iemHideLoading(700);
                else setGlobalLoading(false);
            } catch (e) {}
            appContainer.classList.add('oculto');
            loginOverlay.classList.remove('hidden');
            if (loginUsuario) loginUsuario.value = '';
            if (loginClave) loginClave.value = '';
            if (loginError) loginError.classList.add('hidden');
            if (loginUsuario) loginUsuario.focus();
        }

        async function cargarPerfil(userId, emailFallback) {
            try {
                const { data, error } = await supabaseClient
                    .from('perfiles')
                    .select('usuario, nombre, rol, activo')
                    .eq('id', userId)
                    .maybeSingle();
                if (error) throw error;
                if (data) {
                    if (data.activo === false) {
                        return { ok: false, motivo: 'Usuario desactivado.' };
                    }
                    return {
                        ok: true,
                        usuario: data.usuario || split_part_email(emailFallback),
                        rol: (function () {
                        var r = String(data.rol || 'usuario').toLowerCase();
                        if (r === 'admin') return 'admin';
                        if (r === 'vendedor') return 'vendedor';
                        return 'usuario';
                    })()
                    };
                }
            } catch (e) {
                console.warn('No se pudo leer perfiles (¿ejecutaste el SQL de migración?)', e);
            }
            // Fallback: sin tabla perfiles → usuario del email, rol usuario
            // (admin forzado para lista ADMIN_USUARIOS: luis, andric, …)
            const u = split_part_email(emailFallback);
            const rol = esUsuarioAdminForzado(u) ? 'admin' : 'usuario';
            return { ok: true, usuario: u, rol: rol };
        }

        function split_part_email(email) {
            return String(email || '').split('@')[0].toLowerCase() || 'usuario';
        }

        async function aplicarSesionAuth(session) {
            if (!session || !session.user) return false;
            const perfil = await cargarPerfil(session.user.id, session.user.email);
            if (!perfil.ok) {
                // Solo cerrar Auth si el usuario está explícitamente desactivado.
                // Errores de red / tabla no deben botar la sesión al jalar/recargar.
                var motivo = String(perfil.motivo || '');
                if (/desactiv/i.test(motivo)) {
                    try { await supabaseClient.auth.signOut(); } catch (e) {}
                    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
                    if (loginError) {
                        loginError.textContent = motivo || 'Usuario no autorizado.';
                        loginError.classList.remove('hidden');
                    }
                    return false;
                }
                // Fallback: mantener sesión con datos del email
                usuarioActual = split_part_email(session.user.email);
                rolUsuario = esUsuarioAdminForzado(usuarioActual) ? 'admin' : 'usuario';
                guardarMetaSesion(usuarioActual, rolUsuario);
                try { setGlobalLoading(true, 'dots'); } catch (e) {}
                mostrarApp();
                return true;
            }
            usuarioActual = perfil.usuario;
            rolUsuario = perfil.rol;
            // Admin forzado por lista (luis, andric, …) aunque perfiles diga otro rol
            if (esUsuarioAdminForzado(usuarioActual)) {
                rolUsuario = 'admin';
            }
            // Cuentas de vendedor NO entran a Inventario (solo a la PWA de pedidos)
            if (String(rolUsuario || '').toLowerCase() === 'vendedor') {
                try { await supabaseClient.auth.signOut(); } catch (e) {}
                try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
                usuarioActual = '';
                rolUsuario = '';
                if (loginError) {
                    loginError.textContent = 'Esta cuenta es de vendedor. Usa la app de Pedidos / Reposición, no Inventario.';
                    loginError.classList.remove('hidden');
                }
                showToast('Cuenta vendedor: entra por la app de pedidos.', 'error');
                return false;
            }
            guardarMetaSesion(usuarioActual, rolUsuario);
            try { setGlobalLoading(true, 'dots'); } catch (e) {}
            mostrarApp();
            return true;
        }

        async function ejecutarSalirSesion() {
            try { await borrarSesionActiva(); } catch (e) {}
            try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
            try { if (supabaseClient) await supabaseClient.auth.signOut(); } catch (e) {}
            usuarioActual = '';
            rolUsuario = '';
            try { setGlobalLoading(false); } catch (e) {}
            mostrarLogin();
        }

        function cerrarSesion() {
            confirmarAccion('¿Salir de la sesión?', 'Salir', 'danger').then(function (ok) {
                if (!ok) return;
                ejecutarSalirSesion();
            });
        }

        // Gesto Atrás tipo app nativa:
        // 1) Cierra capas (menú → alerta → admin)
        // 2) Solo en la pantalla raíz pide Salir + cerrar sesión
        (function initGestoAtras() {
            var preguntandoAtras = false;
            var procesandoAtras = false;

            function haySesionActiva() {
                try {
                    if (usuarioActual && String(usuarioActual).length) return true;
                } catch (e) {}
                try {
                    var meta = localStorage.getItem(SESSION_KEY);
                    if (meta && String(meta).length > 2) return true;
                } catch (e2) {}
                try {
                    var app = document.getElementById('appContainer');
                    var login = document.getElementById('loginOverlay');
                    if (app && !app.classList.contains('oculto') && login && login.classList.contains('hidden')) return true;
                } catch (e3) {}
                return false;
            }

            function pushGuardia() {
                try {
                    history.pushState({ iemGuard: 1, t: Date.now() }, '', location.href);
                } catch (e) {}
            }

            window.__iemPushBackGuard = function () {
                try {
                    history.replaceState({ iemGuard: 1, base: 1 }, '', location.href);
                    history.pushState({ iemGuard: 1, t: Date.now() }, '', location.href);
                } catch (e) {
                    try { pushGuardia(); } catch (e2) {}
                }
            };

            /** Cierra la capa superior. true = había algo que cerrar.
             * Orden: producto seleccionado → búsqueda abierta → menú → alerta → admin.
             * Solo cuando no queda nada se pide cerrar sesión. */
            function cerrarCapaSuperior() {
                // 0) Producto seleccionado → volver a la lista / menú de búsqueda
                try {
                    if (typeof selectedIndex !== 'undefined' && selectedIndex !== -1) {
                        if (typeof volverABuscar === 'function') {
                            volverABuscar();
                            return true;
                        }
                    }
                    if (document.body.classList.contains('modo-seleccion')) {
                        if (typeof volverABuscar === 'function') {
                            volverABuscar();
                            return true;
                        }
                    }
                } catch (eSel) {}

                // 1) Sugerencias de búsqueda abiertas o texto en el buscador
                try {
                    var haySugerencias = document.body.classList.contains('search-open') ||
                        (resultList && resultList.classList.contains('result-list-open')) ||
                        (resultList && resultList.innerHTML && resultList.innerHTML.trim());
                    var inp = (typeof searchInput !== 'undefined' && searchInput) ? searchInput : document.getElementById('searchInput');
                    var hayTexto = inp && String(inp.value || '').trim().length > 0;
                    if (haySugerencias || hayTexto) {
                        if (typeof cerrarSugerenciasBusqueda === 'function') {
                            cerrarSugerenciasBusqueda();
                        }
                        if (inp && hayTexto) {
                            inp.value = '';
                            try {
                                if (typeof filteredData !== 'undefined') filteredData = [];
                            } catch (eF) {}
                            try {
                                var rs = document.getElementById('resultsSection');
                                if (rs) rs.classList.remove('has-results');
                            } catch (eR) {}
                            try {
                                if (typeof selectedIndex !== 'undefined') selectedIndex = -1;
                            } catch (eS) {}
                        }
                        try {
                            if (inp) inp.blur();
                        } catch (eBlur) {}
                        return true;
                    }
                } catch (eSug) {}

                // 2) Menú ☰
                var menu = document.getElementById('headerMenuDropdown');
                if (menu && !menu.hidden) {
                    try {
                        if (typeof cerrarHeaderMenu === 'function') cerrarHeaderMenu();
                        else {
                            menu.hidden = true;
                            menu.classList.remove('open');
                        }
                    } catch (e) {}
                    return true;
                }

                // 3) Panel alerta vencidos
                var alerta = document.getElementById('panelAlertaVenc');
                if (alerta && alerta.hidden === false) {
                    alerta.hidden = true;
                    var btnA = document.getElementById('btnAlertaVenc');
                    if (btnA) btnA.setAttribute('aria-expanded', 'false');
                    return true;
                }

                // 4) Admin abierto → solo cerrar admin (regresar al menú principal, no sesión)
                var adminAbierto = false;
                try {
                    if (typeof adminEstaAbierto === 'function') adminAbierto = adminEstaAbierto();
                } catch (e) {}
                if (!adminAbierto) {
                    var ov0 = document.getElementById('adminOverlay');
                    if (ov0 && (ov0.classList.contains('visible') || ov0.style.display === 'flex')) adminAbierto = true;
                    if (document.body.classList.contains('admin-open')) adminAbierto = true;
                    if (/^#\/admin/i.test(location.hash || '')) adminAbierto = true;
                }
                if (adminAbierto) {
                    try {
                        if (typeof cerrarPanelAdmin === 'function') cerrarPanelAdmin();
                    } catch (e) {}
                    try {
                        var ov = document.getElementById('adminOverlay');
                        if (ov) {
                            ov.classList.remove('visible');
                            ov.style.display = 'none';
                            ov.style.visibility = '';
                            ov.style.opacity = '';
                            ov.setAttribute('aria-hidden', 'true');
                        }
                        document.body.classList.remove('admin-open');
                        document.body.style.overflow = '';
                    } catch (e2) {}
                    try {
                        if (/^#\/admin/i.test(location.hash || '')) {
                            history.replaceState({ iemGuard: 1 }, '', location.pathname + location.search + '#/');
                        }
                    } catch (e3) {}
                    return true;
                }

                // 5) Overlay de confirmación abierto
                try {
                    var conf = document.getElementById('confirmOverlay');
                    if (conf && !conf.classList.contains('hidden') && conf.style.display !== 'none') {
                        if (typeof cerrarConfirmacion === 'function') cerrarConfirmacion(false);
                        return true;
                    }
                } catch (eConf) {}

                return false;
            }

            window.addEventListener('popstate', function () {
                if (!haySesionActiva()) return;
                if (procesandoAtras) {
                    pushGuardia();
                    return;
                }
                procesandoAtras = true;

                try {
                    // Siempre reponer historial YA para que Android no minimice la PWA
                    pushGuardia();

                    // Retroceder una capa (menú / alerta / admin)
                    if (cerrarCapaSuperior()) {
                        procesandoAtras = false;
                        return;
                    }

                    // Pantalla raíz: pedir salir + cerrar sesión
                    if (preguntandoAtras) {
                        procesandoAtras = false;
                        return;
                    }
                    preguntandoAtras = true;

                    var preguntar = (typeof confirmarAccion === 'function')
                        ? confirmarAccion('¿Salir y cerrar sesión?', 'Salir', 'danger')
                        : Promise.resolve(window.confirm('¿Salir y cerrar sesión?'));

                    preguntar.then(function (ok) {
                        preguntandoAtras = false;
                        procesandoAtras = false;
                        if (ok) {
                            try { ejecutarSalirSesion(); } catch (e) {}
                            try {
                                history.replaceState({ iemGuard: 0 }, '', location.pathname + location.search + '#/');
                            } catch (e2) {}
                        } else {
                            if (typeof window.__iemPushBackGuard === 'function') window.__iemPushBackGuard();
                            else pushGuardia();
                        }
                    }).catch(function () {
                        preguntandoAtras = false;
                        procesandoAtras = false;
                        pushGuardia();
                    });
                } catch (err) {
                    procesandoAtras = false;
                    pushGuardia();
                }
            });

            document.addEventListener('visibilitychange', function () {
                if (document.visibilityState === 'visible' && haySesionActiva()) {
                    try {
                        if (typeof window.__iemPushBackGuard === 'function') window.__iemPushBackGuard();
                    } catch (e) {}
                }
            });
        })();

        async function intentarLogin() {
            const ahora = Date.now();
            if (ahora < loginBloqueoHasta) {
                const seg = Math.ceil((loginBloqueoHasta - ahora) / 1000);
                loginError.textContent = 'Demasiados intentos. Espere ' + seg + 's.';
                loginError.classList.remove('hidden');
                return;
            }

            const usuario = (loginUsuario.value || '').trim().toLowerCase().slice(0, 64);
            const clave = (loginClave.value || '').slice(0, 128);
            if (!usuario || !clave) {
                loginError.textContent = 'Ingrese usuario y clave.';
                loginError.classList.remove('hidden');
                return;
            }
            if (!window.supabase || !supabaseClient) {
                loginError.textContent = 'Error: no se cargó Supabase. Revise su conexión o recargue la página.';
                loginError.classList.remove('hidden');
                return;
            }

            loginBtn.disabled = true;
            loginBtn.textContent = 'Verificando...';
            loginError.classList.add('hidden');
            try { setGlobalLoading(true, 'dots'); } catch (eL) {}

            try {
                const email = usuarioAEmail(usuario);
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: clave
                });
                // No reutilizar la clave en memoria más de lo necesario
                try { loginClave.value = ''; } catch (eClr) {}
                if (error) throw error;
                if (!data || !data.session) throw new Error('Sin sesión');

                loginIntentos = 0;
                const ok = await aplicarSesionAuth(data.session);
                if (!ok) {
                    try { setGlobalLoading(false); } catch (eH) {}
                    loginClave.focus();
                }
            } catch (e) {
                try { setGlobalLoading(false); } catch (eH2) {}
                try { loginClave.value = ''; } catch (eClr2) {}
                // No volcar detalles internos al log (pueden filtrar info de Auth)
                console.warn('Login fallido');
                loginIntentos += 1;
                if (loginIntentos >= LOGIN_MAX_INTENTOS) {
                    loginBloqueoHasta = Date.now() + LOGIN_BLOQUEO_MS;
                    loginIntentos = 0;
                    loginError.textContent = 'Demasiados intentos. Espere 60 segundos.';
                } else {
                    const msg = String((e && e.message) || e || '');
                    if (/invalid login|invalid credentials|email not confirmed|invalid_grant/i.test(msg)) {
                        loginError.textContent = 'Usuario o clave incorrectos.';
                    } else if (/failed to fetch|network|Load failed/i.test(msg)) {
                        loginError.textContent = 'Sin conexión. Intente de nuevo.';
                    } else {
                        loginError.textContent = 'No se pudo iniciar sesión. Revise usuario/clave.';
                    }
                }
                loginError.classList.remove('hidden');
                loginClave.value = '';
                loginClave.focus();
            } finally {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Entrar';
            }
        }

        // Solo entra al pulsar Entrar / enviar el formulario (NO auto-login por contraseña guardada)
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', function (e) {
                e.preventDefault();
                intentarLogin();
            });
        } else if (loginBtn) {
            loginBtn.addEventListener('click', intentarLogin);
        }
        loginClave.addEventListener('keyup', (e) => { if (e.key === 'Enter') intentarLogin(); });
        loginUsuario.addEventListener('keyup', (e) => { if (e.key === 'Enter') loginClave.focus(); });
        document.getElementById('logoutBtn').addEventListener('click', function () {
            if (typeof cerrarHeaderMenu === 'function') cerrarHeaderMenu();
            cerrarSesion();
        });

        // Arranque: si Supabase Auth tiene sesión válida → entrar SIEMPRE.
        // F5 / recarga / pull-to-refresh ("jalar") NO debe cerrar sesión.
        // La inactividad (SESSION_IDLE_MS) solo aplica con la app YA abierta, no al recargar.
        let authBootDone = false;
        let arranqueEnCurso = true;

        async function obtenerSesionConReintentos() {
            // Tras pull-to-refresh a veces getSession tarda o llega null un instante
            var intentos = 0;
            while (intentos < 5) {
                try {
                    var res = await supabaseClient.auth.getSession();
                    if (res && res.data && res.data.session && res.data.session.user) {
                        return res.data.session;
                    }
                    // Si hay error de red, reintentar
                    if (res && res.error) console.warn('getSession', res.error);
                } catch (e) {
                    console.warn('getSession try', e);
                }
                intentos++;
                await new Promise(function (r) { setTimeout(r, 200 + intentos * 150); });
            }
            return null;
        }

        (async function arrancarSesion() {
            try {
                var session = await obtenerSesionConReintentos();
                if (session && session.user) {
                    var ok = await aplicarSesionAuth(session);
                    if (ok) {
                        tocarSesion(); // renueva actividad al recargar
                        arranqueEnCurso = false;
                        return;
                    }
                }
            } catch (e) {
                console.warn('arrancarSesion', e);
            }
            arranqueEnCurso = false;
            // Solo login si realmente no hay sesión de Auth
            try {
                var last = await supabaseClient.auth.getSession();
                if (last && last.data && last.data.session && last.data.session.user) {
                    var ok2 = await aplicarSesionAuth(last.data.session);
                    if (ok2) {
                        tocarSesion();
                        return;
                    }
                }
            } catch (e2) {}
            mostrarLogin();
        })();

        // Escuchar cambios de Auth (logout en otra pestaña, etc.)
        // Ignorar SIGNED_OUT durante arranque / pull-to-refresh (carrera con token refresh).
        try {
            setTimeout(function () { authBootDone = true; }, 8000);
            supabaseClient.auth.onAuthStateChange(function (event, session) {
                if (event === 'SIGNED_OUT') {
                    if (!authBootDone || arranqueEnCurso) return;
                    if (!usuarioActual) return;
                    // Falso positivo frecuente en PC (refresh de token / pestaña en segundo plano)
                    if (leerMetaSesion()) {
                        console.warn('SIGNED_OUT ignorado: meta de sesión aún válida');
                        return;
                    }
                    // Intentar recuperar sesión de Auth antes de echar al usuario
                    (async function () {
                        try {
                            var res = await supabaseClient.auth.getSession();
                            var sess = res && res.data && res.data.session;
                            if (sess && sess.user) {
                                console.warn('SIGNED_OUT ignorado: getSession aún tiene usuario');
                                tocarSesion();
                                return;
                            }
                        } catch (eR) {}
                        if (!usuarioActual) return;
                        usuarioActual = '';
                        rolUsuario = '';
                        try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
                        if (appContainer && !appContainer.classList.contains('oculto')) {
                            showToast('Sesión finalizada. Vuelve a entrar.', 'info');
                            mostrarLogin();
                        }
                    })();
                } else if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session) {
                    if (usuarioActual) {
                        tocarSesion();
                    } else if (session.user && !arranqueEnCurso) {
                        aplicarSesionAuth(session).then(function (ok) {
                            if (ok) tocarSesion();
                        });
                    }
                }
            });
        } catch (e) {}

        // Renovar actividad con uso real (incluye mouse en PC)
        var _tocarThrottle = 0;
        function tocarSesionThrottled() {
            if (!usuarioActual) return;
            var now = Date.now();
            if (now - _tocarThrottle < 15000) return; // máx 1 vez / 15 s
            _tocarThrottle = now;
            tocarSesion();
        }
        ['click', 'keydown', 'touchstart', 'pointerdown', 'scroll', 'mousemove', 'wheel'].forEach(function (ev) {
            document.addEventListener(ev, tocarSesionThrottled, { passive: true, capture: true });
        });
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible' && usuarioActual) tocarSesion();
        });
        // Heartbeat: mientras la pestaña está visible, mantener meta viva
        setInterval(function () {
            if (document.visibilityState !== 'visible') return;
            if (!usuarioActual) return;
            if (appContainer && appContainer.classList.contains('oculto')) return;
            tocarSesion();
        }, 5 * 60 * 1000);

        // Cierre por inactividad: si la meta local (SESSION_IDLE_MS) venció,
        // se cierra sesión de una vez.
        // ANTES: si el token de Supabase seguía vivo (lo cual pasa casi
        // siempre, porque el SDK lo renueva solo en segundo plano aunque
        // nadie use la app), se "perdonaba" el vencimiento y se renovaba
        // la meta sin avisar. Eso hacía que la inactividad real (p. ej.
        // dejar el celular toda la noche) nunca cerrara la sesión. Ahora
        // la meta de actividad es la única que manda.
        var appAbiertaDesde = Date.now();
        setInterval(async function () {
            if (Date.now() - appAbiertaDesde < 60000) return;
            if (arranqueEnCurso) return;
            if (!usuarioActual) return;
            if (appContainer && appContainer.classList.contains('oculto')) return;
            if (leerMetaSesion()) return;
            // Meta vencida: cerrar sesión sin excepciones.
            borrarSesionActiva();
            try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
            try { supabaseClient.auth.signOut(); } catch (e) {}
            usuarioActual = '';
            rolUsuario = '';
            showToast('Sesión cerrada por inactividad.', 'info');
            mostrarLogin();
        }, 60000);

        // ============================================================
        // PEDIDOS SUGERIDOS (PWA vendedores → admin)
        // ============================================================
        let _pedidosCache = [];
        let _pedidoDetalleId = null;

        function escHtmlPed(s) {
            return String(s == null ? '' : s)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;')
                .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        async function cargarPedidosSugeridos() {
            const list = document.getElementById('adminPedidosList');
            const det = document.getElementById('adminPedidoDetalle');
            if (det) { det.hidden = true; det.innerHTML = ''; }
            _pedidoDetalleId = null;
            if (!list) return;
            if (!supabaseClient) {
                list.innerHTML = '<p class="admin-sesiones-empty">Sin conexión a Supabase.</p>';
                return;
            }
            list.innerHTML = '<p class="admin-sesiones-empty">Cargando pedidos…</p>';
            try {
                const { data, error } = await supabaseClient
                    .from('pedidos_sugeridos')
                    .select('id,vendedor_codigo,vendedor_nombre,ruta,items,total_cajas,total_unidades,notas,estado,created_at')
                    .order('created_at', { ascending: false })
                    .limit(100);
                if (error) throw error;
                _pedidosCache = data || [];
                renderListaPedidosSugeridos();
            } catch (e) {
                console.error(e);
                list.innerHTML = '<p class="admin-sesiones-empty">No se pudieron cargar. ¿Ejecutaste <code>supabase-vendedores.sql</code>?<br>' +
                    escHtmlPed(e.message || e) + '</p>';
            }
        }


        function consolidarItemsPorCodigo(items) {
            var map = {};
            (items || []).forEach(function (it) {
                var cod = String(it.codigo || '').trim();
                if (!cod) return;
                var k = cod.toUpperCase();
                if (!map[k]) {
                    map[k] = {
                        codigo: cod,
                        descripcion: it.descripcion || '',
                        linea: it.linea || '',
                        imagen_url: it.imagen_url || '',
                        codigo_fabrica: it.codigo_fabrica || '',
                        cajas: 0,
                        unidades: 0,
                        vendedores: []
                    };
                }
                map[k].cajas += Number(it.cajas) || 0;
                map[k].unidades += Number(it.unidades) || 0;
                if (it.descripcion && !map[k].descripcion) map[k].descripcion = it.descripcion;
                if (it.imagen_url && !map[k].imagen_url) map[k].imagen_url = it.imagen_url;
                if (it._vendedor) {
                    var v = String(it._vendedor);
                    if (map[k].vendedores.indexOf(v) === -1) map[k].vendedores.push(v);
                }
            });
            return Object.keys(map).sort().map(function (k) { return map[k]; });
        }

        function renderPedidosConsolidados() {
            const det = document.getElementById('adminPedidoDetalle');
            if (!det) return;
            const estadoSel = (document.getElementById('adminPedidosEstado') || {}).value || 'pendiente';
            let rows = (_pedidosCache || []).slice();
            if (estadoSel) {
                rows = rows.filter(function (r) { return String(r.estado || '') === estadoSel; });
            }
            // Si no hay filtro de estado, por defecto consolidar pendientes
            if (!estadoSel) {
                rows = rows.filter(function (r) { return String(r.estado || '') === 'pendiente'; });
            }
            var all = [];
            rows.forEach(function (r) {
                var vend = (r.vendedor_codigo || '') + (r.vendedor_nombre ? ' ' + r.vendedor_nombre : '');
                (Array.isArray(r.items) ? r.items : []).forEach(function (it) {
                    var copy = Object.assign({}, it, { _vendedor: vend.trim() });
                    all.push(copy);
                });
            });
            var merged = consolidarItemsPorCodigo(all);
            var tc = 0, tu = 0;
            merged.forEach(function (it) { tc += it.cajas; tu += it.unidades; });
            var filas = merged.map(function (it, i) {
                var img = it.imagen_url
                    ? '<img class="apd-thumb" src="' + escHtmlPed(it.imagen_url) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
                    : '<span class="apd-thumb-ph">📦</span>';
                return '<tr>' +
                    '<td>' + (i + 1) + '</td>' +
                    '<td class="apd-img-cell">' + img + '</td>' +
                    '<td class="mono">' + escHtmlPed(it.codigo) + '</td>' +
                    '<td>' + escHtmlPed(it.descripcion) +
                    (it.vendedores && it.vendedores.length
                        ? '<div class="apd-vend-mini">' + escHtmlPed(it.vendedores.join(' · ')) + '</div>'
                        : '') +
                    '</td>' +
                    '<td class="num">' + it.cajas + '</td>' +
                    '<td class="num">' + it.unidades + '</td>' +
                    '<td>' + escHtmlPed(it.linea || '') + '</td>' +
                    '</tr>';
            }).join('');
            if (!filas) filas = '<tr><td colspan="7" class="empty-message">No hay ítems para consolidar</td></tr>';
            det.hidden = false;
            det.innerHTML =
                '<div class="apd-head">' +
                '<h4>Lista consolidada · mismos códigos sumados</h4>' +
                '<button type="button" class="btn btn-outline btn-sm" id="apdCerrar">Cerrar</button>' +
                '</div>' +
                '<p class="apd-meta">' + rows.length + ' pedido(s) · ' + merged.length + ' productos · ' +
                tc + ' cajas · ' + tu + ' unidades' +
                (estadoSel ? ' · filtro: ' + escHtmlPed(estadoSel) : ' · pendientes') + '</p>' +
                '<div class="table-wrap"><table class="diff-table apd-table"><thead><tr>' +
                '<th>#</th><th></th><th>Código</th><th>Descripción / vendedores</th><th>Cajas</th><th>Unid.</th><th>Línea</th>' +
                '</tr></thead><tbody>' + filas + '</tbody></table></div>';
            det.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        function renderListaPedidosSugeridos() {
            const list = document.getElementById('adminPedidosList');
            if (!list) return;
            const estadoSel = (document.getElementById('adminPedidosEstado') || {}).value || '';
            const q = String((document.getElementById('adminPedidosFiltro') || {}).value || '').trim().toUpperCase();

            let rows = _pedidosCache.slice();
            if (estadoSel) {
                rows = rows.filter(function (r) { return String(r.estado || '') === estadoSel; });
            }
            if (q) {
                rows = rows.filter(function (r) {
                    const blob = [
                        r.vendedor_codigo, r.vendedor_nombre, r.ruta, r.notas, r.estado,
                        JSON.stringify(r.items || [])
                    ].join(' ').toUpperCase();
                    return blob.indexOf(q) !== -1;
                });
            }

            if (!rows.length) {
                list.innerHTML = '<p class="admin-sesiones-empty">No hay pedidos' +
                    (estadoSel ? ' en estado <strong>' + escHtmlPed(estadoSel) + '</strong>' : '') + '.</p>';
                return;
            }

            list.innerHTML = rows.map(function (r) {
                const fecha = r.created_at ? new Date(r.created_at).toLocaleString('es-PE') : '-';
                const nItems = Array.isArray(r.items) ? r.items.length : 0;
                const est = String(r.estado || 'pendiente');
                const estCls = est === 'atendido' ? 'ok' : (est === 'rechazado' ? 'bad' : 'pend');
                return (
                    '<div class="admin-pedido-card" data-ped-id="' + escHtmlPed(r.id) + '">' +
                    '<div class="apc-top">' +
                    '<span class="apc-vend"><strong>' + escHtmlPed(r.vendedor_codigo || '') + '</strong> ' +
                    escHtmlPed(r.vendedor_nombre || '') + '</span>' +
                    '<span class="apc-estado ' + estCls + '">' + escHtmlPed(est) + '</span>' +
                    '</div>' +
                    '<div class="apc-meta">' + fecha +
                    (r.ruta ? ' · Ruta ' + escHtmlPed(r.ruta) : '') +
                    ' · ' + nItems + ' ítems · ' +
                    (Number(r.total_cajas) || 0) + ' cj / ' + (Number(r.total_unidades) || 0) + ' u' +
                    '</div>' +
                    (r.notas ? '<div class="apc-notas">' + escHtmlPed(r.notas) + '</div>' : '') +
                    '</div>'
                );
            }).join('');
        }

        function verDetallePedidoSugerido(id) {
            const r = _pedidosCache.find(function (x) { return String(x.id) === String(id); });
            const det = document.getElementById('adminPedidoDetalle');
            if (!det || !r) return;
            _pedidoDetalleId = r.id;
            const items = consolidarItemsPorCodigo(Array.isArray(r.items) ? r.items : []);
            let filas = items.map(function (it, i) {
                var img = it.imagen_url
                    ? '<img class="apd-thumb" src="' + escHtmlPed(it.imagen_url) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
                    : '<span class="apd-thumb-ph">📦</span>';
                return '<tr>' +
                    '<td>' + (i + 1) + '</td>' +
                    '<td class="apd-img-cell">' + img + '</td>' +
                    '<td class="mono">' + escHtmlPed(it.codigo) + '</td>' +
                    '<td>' + escHtmlPed(it.descripcion) + '</td>' +
                    '<td class="num">' + (Number(it.cajas) || 0) + '</td>' +
                    '<td class="num">' + (Number(it.unidades) || 0) + '</td>' +
                    '<td>' + escHtmlPed(it.linea || '') + '</td>' +
                    '</tr>';
            }).join('');
            if (!filas) filas = '<tr><td colspan="7" class="empty-message">Sin ítems</td></tr>';
            det.hidden = false;
            det.innerHTML =
                '<div class="apd-head">' +
                '<h4>Detalle · ' + escHtmlPed(r.vendedor_codigo) + ' ' + escHtmlPed(r.vendedor_nombre || '') + '</h4>' +
                '<button type="button" class="btn btn-outline btn-sm" id="apdCerrar">Cerrar</button>' +
                '</div>' +
                '<p class="apd-meta">' + (r.created_at ? new Date(r.created_at).toLocaleString('es-PE') : '') +
                ' · Estado: <strong>' + escHtmlPed(r.estado || 'pendiente') + '</strong></p>' +
                (r.notas ? '<p class="apd-notas">' + escHtmlPed(r.notas) + '</p>' : '') +
                '<div class="table-wrap"><table class="diff-table apd-table"><thead><tr>' +
                '<th>#</th><th></th><th>Código</th><th>Descripción</th><th>Cajas</th><th>Unid.</th><th>Línea</th>' +
                '</tr></thead><tbody>' + filas + '</tbody></table></div>' +
                '<div class="apd-actions">' +
                '<button type="button" class="btn btn-success btn-sm" data-ped-estado="atendido">✓ Marcar atendido</button> ' +
                '<button type="button" class="btn btn-danger btn-sm" data-ped-estado="rechazado">✕ Rechazar</button> ' +
                '<button type="button" class="btn btn-outline btn-sm" data-ped-estado="pendiente">↩ Pendiente</button>' +
                '</div>';
            det.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        async function actualizarEstadoPedido(id, estado) {
            if (!supabaseClient || !id) return;
            try {
                const { error } = await supabaseClient
                    .from('pedidos_sugeridos')
                    .update({ estado: estado })
                    .eq('id', id);
                if (error) throw error;
                const row = _pedidosCache.find(function (x) { return String(x.id) === String(id); });
                if (row) row.estado = estado;
                renderListaPedidosSugeridos();
                if (_pedidoDetalleId && String(_pedidoDetalleId) === String(id)) {
                    verDetallePedidoSugerido(id);
                }
                if (typeof showToast === 'function') showToast('Estado: ' + estado, 'success');
            } catch (e) {
                console.error(e);
                if (typeof showToast === 'function') {
                    showToast('No se pudo actualizar: ' + (e.message || e), 'error');
                }
            }
        }

        // Listeners pedidos (delegation)
        document.addEventListener('click', function (e) {
            const card = e.target.closest && e.target.closest('.admin-pedido-card');
            if (card && card.getAttribute('data-ped-id')) {
                verDetallePedidoSugerido(card.getAttribute('data-ped-id'));
                return;
            }
            if (e.target && e.target.id === 'apdCerrar') {
                const det = document.getElementById('adminPedidoDetalle');
                if (det) { det.hidden = true; det.innerHTML = ''; }
                _pedidoDetalleId = null;
                return;
            }
            const estBtn = e.target.closest && e.target.closest('[data-ped-estado]');
            if (estBtn && _pedidoDetalleId) {
                actualizarEstadoPedido(_pedidoDetalleId, estBtn.getAttribute('data-ped-estado'));
            }
        });

        document.addEventListener('DOMContentLoaded', function () {
            const btn = document.getElementById('adminRefreshPedidosBtn');
            if (btn) btn.addEventListener('click', cargarPedidosSugeridos);
            const btnCons = document.getElementById('btnPedidosConsolidado');
            if (btnCons) btnCons.addEventListener('click', function () {
                if (typeof renderPedidosConsolidados === 'function') renderPedidosConsolidados();
            });
            const sel = document.getElementById('adminPedidosEstado');
            if (sel) sel.addEventListener('change', renderListaPedidosSugeridos);
            const fil = document.getElementById('adminPedidosFiltro');
            if (fil) {
                let t;
                fil.addEventListener('input', function () {
                    clearTimeout(t);
                    t = setTimeout(renderListaPedidosSugeridos, 200);
                });
            }
        });



    })();


        
        // FAB → listado por vencer (admin)
        document.addEventListener('click', function (e) {
            var fab = e.target.closest && e.target.closest('#fabAlertaVenc');
            if (!fab) return;
            e.preventDefault();
            if (typeof abrirAdminEnSeccion === 'function') abrirAdminEnSeccion('vencimientos');
            else if (typeof window.cambiarTabAdmin === 'function') {
                var ov = document.getElementById('adminOverlay');
                if (ov) { ov.classList.add('visible'); document.body.classList.add('admin-open'); }
                window.cambiarTabAdmin('vencimientos');
            }
        });


        // Asegurar que la lista de resultados vacía no bloquee scroll del inventario
        (function collapseEmptyResults() {
            function run() {
                try {
                    var rl = document.getElementById('resultList');
                    var rs = document.getElementById('resultsSection');
                    var si = document.getElementById('searchInput');
                    var term = (si && si.value) ? si.value.trim() : '';
                    if (!term && rl) {
                        rl.innerHTML = '';
                        rl.classList.add('result-list-collapsed');
                        rl.classList.remove('result-list-open');
                        document.body.classList.remove('search-open');
                        if (rs) rs.classList.remove('has-results');
                    }
                } catch (e) {}
            }
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
            else run();
            setTimeout(run, 400);
            setTimeout(run, 1200);
        })();

        // Pull-to-refresh en la zona superior (móvil): recarga limpia de caché
        (function initPullToRefresh() {
            var startY = 0;
            var pulling = false;
            var armed = false;
            var indicator = null;

            function thresholdPx() {
                // Debe llegar cerca del centro de la pantalla (evita gestos accidentales)
                return Math.max(160, Math.floor(window.innerHeight * 0.42));
            }
            function topZonePx() {
                return Math.max(48, Math.floor(window.innerHeight * 0.12));
            }
            function scrollTopNow() {
                var se = document.scrollingElement || document.documentElement;
                var t = window.pageYOffset || 0;
                if (se && typeof se.scrollTop === 'number') t = Math.max(t, se.scrollTop);
                if (document.body) t = Math.max(t, document.body.scrollTop || 0);
                var app = document.getElementById('appContainer');
                if (app && typeof app.scrollTop === 'number') t = Math.max(t, app.scrollTop);
                return t;
            }
            function ensureIndicator() {
                if (indicator) return indicator;
                indicator = document.createElement('div');
                indicator.id = 'iemPullRefresh';
                indicator.setAttribute('aria-hidden', 'true');
                indicator.innerHTML = '<span class="iem-pr-ico">↓</span> <span class="iem-pr-txt">Desliza hasta el centro</span>';
                document.body.appendChild(indicator);
                return indicator;
            }
            function setProgress(dy) {
                var el = ensureIndicator();
                var th = thresholdPx();
                var p = Math.min(1, Math.max(0, dy / th));
                el.style.opacity = String(0.4 + p * 0.6);
                el.style.transform = 'translate(-50%, ' + Math.min(dy * 0.35, window.innerHeight * 0.35) + 'px)';
                el.classList.toggle('iem-pr-ready', dy >= th);
                var txt = el.querySelector('.iem-pr-txt');
                var ico = el.querySelector('.iem-pr-ico');
                if (txt) txt.textContent = dy >= th ? 'Suelta para actualizar' : 'Desliza hasta el centro…';
                if (ico) ico.textContent = dy >= th ? '↑' : '↓';
            }
            function hideIndicator() {
                if (!indicator) return;
                indicator.style.opacity = '0';
                indicator.style.transform = 'translate(-50%, -40px)';
                indicator.classList.remove('iem-pr-ready');
            }

            window.__iemHardRefresh = function () {
                var el = ensureIndicator();
                el.classList.add('iem-pr-ready');
                el.style.opacity = '1';
                el.style.transform = 'translate(-50%, 48px)';
                var txt = el.querySelector('.iem-pr-txt');
                if (txt) txt.textContent = 'Actualizando…';

                try { localStorage.setItem('iem_force_update', String(Date.now())); } catch (e) {}

                var done = false;
                function finish() {
                    if (done) return;
                    done = true;
                    try {
                        var base = location.pathname || './index.html';
                        if (base.charAt(base.length - 1) === '/') base = base + 'index.html';
                        location.replace(base + '?_r=' + Date.now());
                    } catch (e2) {
                        location.reload();
                    }
                }

                var tasks = [];
                try {
                    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
                        tasks.push(
                            navigator.serviceWorker.getRegistrations().then(function (regs) {
                                return Promise.all(regs.map(function (r) { return r.unregister(); }));
                            })
                        );
                    }
                    if (window.caches && caches.keys) {
                        tasks.push(
                            caches.keys().then(function (keys) {
                                return Promise.all(keys.map(function (k) { return caches.delete(k); }));
                            })
                        );
                    }
                } catch (err) {}

                Promise.all(tasks).then(finish, finish);
                setTimeout(finish, 1500);
            };

            document.addEventListener('touchstart', function (e) {
                if (document.body.classList.contains('admin-open')) return;
                if (scrollTopNow() > 5) return;
                if (!e.touches || e.touches.length !== 1) return;
                var y = e.touches[0].clientY;
                // Solo si el dedo empieza en la franja superior
                if (y > topZonePx()) return;
                var t = e.target;
                if (t && t.closest && t.closest('input, textarea, select, button, a, .header-menu-dropdown, .panel-alerta-venc, .result-item, #diffMobileList, #diffCardBody, #diffCardHeader, .mi-card, .diff-filtro-row, .card-actions-row, #calcOverlay, .fab-calc, .fab-alerta-venc, section.card')) return;
                startY = y;
                pulling = true;
                armed = false;
            }, { passive: true });

            document.addEventListener('touchmove', function (e) {
                if (!pulling) return;
                if (!e.touches || !e.touches[0]) return;
                if (scrollTopNow() > 5) {
                    pulling = false;
                    hideIndicator();
                    return;
                }
                var dy = e.touches[0].clientY - startY;
                if (dy < 20) {
                    hideIndicator();
                    armed = false;
                    return;
                }
                armed = dy >= thresholdPx();
                setProgress(dy);
            }, { passive: true });

            document.addEventListener('touchend', function () {
                if (!pulling) return;
                var should = armed;
                pulling = false;
                armed = false;
                if (should) {
                    if (typeof window.__iemHardRefresh === 'function') window.__iemHardRefresh();
                } else {
                    hideIndicator();
                }
            }, { passive: true });

            document.addEventListener('touchcancel', function () {
                pulling = false;
                armed = false;
                hideIndicator();
            }, { passive: true });
        })();



        // Al tocar Cajas/Unidades: inventario cerrado (no “saltar” a la lista)
        (function bindCantidadFocusCierraInventario() {
            function cerrarInv() {
                try {
                    if (typeof setCardExpandida === 'function') setCardExpandida('diff', false);
                    document.body.classList.remove('inv-fisico-abierto');
                } catch (e) {}
            }
            ['txtCajas', 'txtUnidades'].forEach(function (id) {
                var el = document.getElementById(id);
                if (!el) return;
                ['focus', 'pointerdown', 'touchstart', 'click'].forEach(function (ev) {
                    el.addEventListener(ev, function (e) {
                        cerrarInv();
                        e.stopPropagation();
                    }, { passive: true, capture: true });
                });
            });
            var row = document.querySelector('.cantidad-row');
            if (row) {
                row.addEventListener('pointerdown', function (e) {
                    cerrarInv();
                    e.stopPropagation();
                }, { passive: true, capture: true });
            }
        })();

        // ============================================================
        // Calculadora rápida (admin) → poner resultado en cajas/unidades
        // ============================================================
        (function initCalculadoraIEM() {
            function bootCalc() {
            var fab = document.getElementById('fabCalc');
            var ov = document.getElementById('calcOverlay');
            var display = document.getElementById('calcDisplay');
            var exprEl = document.getElementById('calcExpr');
            if (!fab || !ov || !display) {
                console.warn('[IEM] Calculadora: elementos no encontrados');
                return;
            }
            if (fab._calcBound) return;
            fab._calcBound = true;

            var expr = '';
            var justEvaluated = false;

            function setDisplay(v) {
                display.textContent = v === '' || v == null ? '0' : String(v);
            }
            function setExpr(v) {
                if (exprEl) exprEl.textContent = v || '';
            }
            function openCalc() {
                // Cerrar inventario y bloquear toques del resto de la app
                try {
                    if (typeof setCardExpandida === 'function') setCardExpandida('diff', false);
                    document.body.classList.remove('inv-fisico-abierto');
                } catch (eInv) {}
                // Quitar teclado del sistema (el foco estaba en Cajas/Unidades)
                try {
                    var ae = document.activeElement;
                    if (ae && typeof ae.blur === 'function') ae.blur();
                    ['txtCajas', 'txtUnidades', 'txtDia', 'txtMes', 'searchInput'].forEach(function (id) {
                        var inp = document.getElementById(id);
                        if (inp) {
                            inp.blur();
                            inp.setAttribute('readonly', 'readonly');
                            inp.setAttribute('data-calc-locked', '1');
                        }
                    });
                } catch (eBlur) {}
                document.body.classList.add('calc-open');
                ov.hidden = false;
                ov.removeAttribute('hidden');
                ov.classList.add('visible');
                ov.setAttribute('aria-hidden', 'false');
                ov.style.display = 'flex';
                ov.style.pointerEvents = 'auto';
                try { bindCalcKeys(); } catch (eBk) {}
                // Aislar del documento (fase burbuja: no bloquea las teclas hijas)
                try {
                    var panel = ov.querySelector('.calc-panel');
                    if (panel && !panel._calcIso) {
                        panel._calcIso = true;
                        ['click', 'touchend', 'pointerup'].forEach(function (evN) {
                            panel.addEventListener(evN, function (e) {
                                e.stopPropagation();
                            }, false);
                        });
                    }
                    // Overlay: tocar fuera cierra; tocar panel no
                    if (!ov._calcBgBound) {
                        ov._calcBgBound = true;
                        ov.addEventListener('click', function (e) {
                            if (e.target === ov) closeCalc();
                        });
                    }
                } catch (eIso) {}
            }
            function closeCalc() {
                document.body.classList.remove('calc-open');
                ov.hidden = true;
                ov.setAttribute('hidden', '');
                ov.classList.remove('visible');
                ov.setAttribute('aria-hidden', 'true');
                ov.style.display = 'none';
                // Restaurar campos (quitar readonly del teclado bloqueado)
                try {
                    document.querySelectorAll('[data-calc-locked="1"]').forEach(function (inp) {
                        inp.removeAttribute('readonly');
                        inp.removeAttribute('data-calc-locked');
                    });
                } catch (eR) {}
            }
            function currentValue() {
                var t = (display.textContent || '0').replace(/\s/g, '');
                var n = parseFloat(t);
                return isFinite(n) ? n : 0;
            }
            /** Evalúa solo dígitos y + - * / % . ( ) de forma segura */
            function safeEval(s) {
                s = String(s || '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
                s = s.replace(/\s/g, '');
                if (!s) return 0;
                if (!/^[0-9+\-*/%.()]+$/.test(s)) throw new Error('expr');
                // evita letras / código
                var fn = new Function('return (' + s + ');');
                var r = fn();
                if (typeof r !== 'number' || !isFinite(r)) throw new Error('nan');
                return r;
            }
            function formatResult(n) {
                if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
                var s = String(Math.round(n * 1e6) / 1e6);
                return s;
            }
            function evaluate() {
                try {
                    var src = expr || display.textContent;
                    var r = safeEval(src);
                    setExpr(src + ' =');
                    setDisplay(formatResult(r));
                    expr = formatResult(r);
                    justEvaluated = true;
                } catch (e) {
                    setDisplay('Error');
                    expr = '';
                    justEvaluated = true;
                }
            }
            function press(k) {
                // Por si un toque “pasó” al inventario detrás
                try {
                    if (typeof setCardExpandida === 'function') setCardExpandida('diff', false);
                    document.body.classList.remove('inv-fisico-abierto');
                } catch (eP) {}
                if (k === 'C') {
                    expr = '';
                    justEvaluated = false;
                    setDisplay('0');
                    setExpr('');
                    return;
                }
                if (k === '⌫') {
                    if (justEvaluated) {
                        expr = '';
                        setDisplay('0');
                        setExpr('');
                        justEvaluated = false;
                        return;
                    }
                    expr = expr.slice(0, -1);
                    setDisplay(expr || '0');
                    return;
                }
                if (k === '=') {
                    evaluate();
                    return;
                }
                if (justEvaluated && /[0-9.]/.test(k)) {
                    expr = '';
                    justEvaluated = false;
                }
                if (justEvaluated && /[+\-*/%]/.test(k)) {
                    justEvaluated = false;
                }
                // un solo punto en el número actual
                if (k === '.') {
                    var parts = expr.split(/[+\-*/%]/);
                    var last = parts[parts.length - 1] || '';
                    if (last.indexOf('.') !== -1) return;
                    if (!last) expr += '0';
                }
                expr += k;
                setDisplay(expr);
                setExpr('');
            }
            function putInto(inputId) {
                try { if (typeof setCardExpandida === 'function') setCardExpandida('diff', false); document.body.classList.remove('inv-fisico-abierto'); } catch (ePI) {}
                var el = document.getElementById(inputId);
                if (!el) {
                    if (typeof showToast === 'function') showToast('Campo no disponible.', 'error');
                    return;
                }
                // Si hay producto seleccionado, habilitar el campo destino
                var contando = document.body.classList.contains('modo-seleccion');
                if (el.disabled && contando) {
                    try { el.disabled = false; } catch (eEn) {}
                }
                if (el.disabled) {
                    if (typeof showToast === 'function') showToast('Selecciona un producto primero (busca y tócalo).', 'info');
                    return;
                }
                // Evaluar expresión pendiente (si no pulsó =)
                try {
                    if (expr && /[+\-*/%]/.test(expr)) {
                        evaluate();
                    }
                } catch (eEv) {}
                var n = currentValue();
                if (!isFinite(n) || isNaN(n)) n = 0;
                if (n < 0) n = 0;
                var v = (inputId === 'txtCajas' || inputId === 'txtUnidades')
                    ? String(Math.max(0, Math.round(n)))
                    : formatResult(n);
                el.value = v;
                try {
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                } catch (eD) {}
                // Actualizar total si existe la función de la app
                try {
                    if (typeof actualizarTotalCalculado === 'function') actualizarTotalCalculado();
                    else if (typeof actualizarResumenCantidades === 'function') actualizarResumenCantidades();
                } catch (eT) {}
                try {
                    closeCalc();
                    // No forzar focus: en móvil abre el teclado del sistema encima de todo
                    try { el.blur(); } catch (eB) {}
                    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (eS) {}
                } catch (eF) {}
                if (typeof showToast === 'function') {
                    showToast('Puesto en ' + (inputId === 'txtCajas' ? 'Cajas' : inputId === 'txtUnidades' ? 'Unidades' : inputId) + ': ' + v, 'success');
                }
            }
            function putFocus() {
                var a = document.activeElement;
                if (a && (a.id === 'txtCajas' || a.id === 'txtUnidades') && !a.disabled) {
                    putInto(a.id);
                    return;
                }
                // por defecto cajas si están habilitadas
                var c = document.getElementById('txtCajas');
                if (c && !c.disabled) {
                    putInto('txtCajas');
                    return;
                }
                var u = document.getElementById('txtUnidades');
                if (u && !u.disabled) {
                    putInto('txtUnidades');
                    return;
                }
                if (typeof showToast === 'function') showToast('Selecciona un producto y enfoca Cajas o Unidades.', 'info');
            }

            function onFabOpen(e) {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                }
                openCalc();
            }
            fab.addEventListener('click', onFabOpen, true);
            fab.addEventListener('touchend', function (e) {
                // Evita que el mismo gesto active la barra de Inventario debajo
                onFabOpen(e);
            }, { passive: false, capture: true });
            var closeBtn = document.getElementById('calcCloseBtn');
            if (closeBtn) closeBtn.addEventListener('click', closeCalc);
            ov.addEventListener('click', function (e) {
                if (e.target === ov) closeCalc();
            });
            function bindCalcKeys() {
                ov.querySelectorAll('.calc-key').forEach(function (btn) {
                    if (btn._calcKeyBound) return;
                    btn._calcKeyBound = true;
                    var lastTs = 0;
                    function fire(e) {
                        var now = Date.now();
                        if (now - lastTs < 280) return; // evita doble touch+click
                        lastTs = now;
                        if (e) {
                            try { e.preventDefault(); } catch (e1) {}
                            try { e.stopPropagation(); } catch (e2) {}
                        }
                        press(btn.getAttribute('data-k') || '');
                    }
                    btn.addEventListener('click', fire);
                    btn.addEventListener('touchend', fire, { passive: false });
                });
            }
            bindCalcKeys();
            var toC = document.getElementById('calcToCajas');
            var toU = document.getElementById('calcToUnidades');
            var toF = document.getElementById('calcToFocus');
            function bindAction(btn, fn) {
                if (!btn || btn._calcActBound) return;
                btn._calcActBound = true;
                var lastTs = 0;
                function fire(e) {
                    var now = Date.now();
                    if (now - lastTs < 280) return;
                    lastTs = now;
                    if (e) {
                        try { e.preventDefault(); } catch (e1) {}
                        try { e.stopPropagation(); } catch (e2) {}
                    }
                    fn();
                }
                btn.addEventListener('click', fire);
                btn.addEventListener('touchend', fire, { passive: false });
            }
            bindAction(toC, function () { putInto('txtCajas'); });
            bindAction(toU, function () { putInto('txtUnidades'); });
            bindAction(toF, putFocus);
            var closeBtn2 = document.getElementById('calcCloseBtn');
            bindAction(closeBtn2, closeCalc);
            // Delegación extra por si el FAB se recrea
            document.addEventListener('click', function (e) {
                var b = e.target && e.target.closest && e.target.closest('#fabCalc');
                if (!b) return;
                e.preventDefault();
                e.stopPropagation();
                if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                openCalc();
            }, true);
            } // end bootCalc
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootCalc);
            else bootCalc();
            setTimeout(bootCalc, 0);
            setTimeout(bootCalc, 500);
        })();


        // Al reabrir la app: pedir SW actualizado y recargar una vez si hay versión nueva.
        // Nota: index.html ya tiene su propio listener de 'controllerchange' que hace
        // este mismo trabajo (con las protecciones de abajo). Este de aquí se deja
        // como respaldo por si ese otro no llegó a registrarse, pero DEBE usar las
        // mismas protecciones o vuelve a introducir el recargo no deseado:
        // - no recargar en la primera activación del Service Worker en el
        //   dispositivo (no había nada viejo que refrescar; recargar solo
        //   interrumpe al usuario, por ejemplo borrándole el login a medio escribir)
        // - no recargar dos veces si el listener de index.html ya lo hizo
        (function initSwUpdate() {
            if (!('serviceWorker' in navigator)) return;
            var teniaControllerAlEntrar = !!navigator.serviceWorker.controller;
            var reloading = false;
            navigator.serviceWorker.addEventListener('controllerchange', function () {
                if (reloading) return;
                if (!teniaControllerAlEntrar) {
                    teniaControllerAlEntrar = true;
                    return;
                }
                try {
                    if (sessionStorage.getItem('iem_sw_reloaded')) return;
                    sessionStorage.setItem('iem_sw_reloaded', '1');
                } catch (e) {}
                reloading = true;
                try { location.reload(); } catch (e) {}
            });
            function tryUpdate() {
                navigator.serviceWorker.getRegistration('./sw.js').then(function (reg) {
                    if (reg && reg.update) reg.update().catch(function () {});
                }).catch(function () {});
            }
            window.addEventListener('load', tryUpdate);
            document.addEventListener('visibilitychange', function () {
                if (document.visibilityState === 'visible') tryUpdate();
            });
            // Si el usuario forzó actualización, limpiar flag
            try {
                if (localStorage.getItem('iem_force_update')) {
                    localStorage.removeItem('iem_force_update');
                }
            } catch (e) {}
        })();

        // Ocultar pantalla de carga cuando la app ya pintó
        document.addEventListener('DOMContentLoaded', function () {
            /* Puntos de carga: solo tras login → búsqueda; no al abrir la app */
        });
