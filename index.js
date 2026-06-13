let totalPeliculas = 0;
const titulosRegistrados = new Set();
let peliculasDatos = []; 

let listaGeneros = new Set();
let listaDecadas = new Set();
let filtroActivo = { tipo: "TODOS", valor: "TODOS" };

let elementoEnfocadoActual = null;
let tarjetaUltimoClick = null;

// GESTIÓN DE PAGINACIÓN REAL
let paginaActual = 1;
const peliculasPorPagina = 24; // Número perfecto para cuadrículas simétricas (móvil y tablet)
let peliculasFiltradasCache = [];

document.addEventListener('deviceready', () => {
    cargarTodoElCatalogoInicial();
}, false);

async function cargarTodoElCatalogoInicial() {
    const estadoTitulo = document.getElementById('estado-titulo');
    if(estadoTitulo) estadoTitulo.innerText = "Conectando con Blogger...";
    
    // Descarga masiva inicial de los 3 bloques principales de tu servidor Blogger
    await cargarBloque(1);
    await cargarBloque(151);
    await cargarBloque(301);
    
    // Inicializamos las listas de filtrado y las cachés
    actualizarPeliculasFiltradasCache();
    renderizarPaginaActual();
    construirPanelFiltros();
    
    setTimeout(() => {
        const buscador = document.getElementById('buscador-cine');
        if (buscador) {
            buscador.focus();
            elementoEnfocadoActual = buscador;
        }
    }, 500);
}

async function cargarBloque(startIndex) {
    const url = `https://www.classicofilm.com/feeds/posts/default?alt=json&start-index=${startIndex}&max-results=150`;

    return new Promise((resolve) => {
        if (window.cordova && window.cordova.plugin && window.cordova.plugin.http) {
            window.cordova.plugin.http.get(url, {}, {}, function(response) {
                try {
                    const data = JSON.parse(response.data);
                    if (data.feed && data.feed.entry) procesarEntradasBlogger(data.feed.entry);
                } catch (e) { console.error(e); }
                resolve();
            }, function(err) { resolve(); });
        } else {
            fetch(url).then(res => res.json()).then(data => {
                if (data.feed && data.feed.entry) procesarEntradasBlogger(data.feed.entry);
                resolve();
            }).catch(() => resolve());
        }
    });
}

function procesarEntradasBlogger(entradas) {
    if (!entradas) return;

    entradas.forEach((entry) => {
        const titulo = entry.title.$t;
        if (titulosRegistrados.has(titulo)) return;
        titulosRegistrados.add(titulo);

        let imagenUrl = "https://via.placeholder.com/200x280?text=Cine";
        if (entry.media$thumbnail) imagenUrl = entry.media$thumbnail.url.replace('/s72-c/', '/s400/');

        let opcionesServidores = [];
        const contenidoPost = entry.content ? entry.content.$t : "";
        const matches = [...contenidoPost.matchAll(/<iframe[^>]+src="([^">]+)"/g)];
        
        if (matches.length > 0) {
            matches.forEach(m => {
                let urlClean = m[1].startsWith('//') ? 'https:' + m[1] : m[1];
                if (urlClean.includes("odysee.com")) {
                    opcionesServidores.push({ tipo: "Odysee", url: urlClean });
                } else if (urlClean.includes("dzen.ru") || urlClean.includes("vk.com")) {
                    opcionesServidores.push({ tipo: "Dzen.ru", url: urlClean });
                }
            });
        }

        if (opcionesServidores.length === 0 && matches.length > 0) {
            opcionesServidores.push({ tipo: "Principal", url: (matches[0][1].startsWith('//') ? 'https:' + matches[0][1] : matches[0][1]) });
        }

        if (opcionesServidores.length === 0) return; // Se ignoran entradas vacías o sin reproductor

        let categoriasPeli = [];
        if (entry.category) {
            categoriasPeli = entry.category.map(cat => cat.term.trim());
            categoriasPeli.forEach(tag => {
                if (tag.toLowerCase().includes("años") || tag.toLowerCase().includes("siglo") || /\b(19|20)\d{2}\b/.test(tag)) {
                    listaDecadas.add(tag);
                } else {
                    listaGeneros.add(tag);
                }
            });
        }

        peliculasDatos.push({ 
            titulo: titulo,
            tituloMinuscula: titulo.toLowerCase(), 
            imagen: imagenUrl,
            servidores: opcionesServidores,
            categorias: categoriasPeli
        });
        totalPeliculas++;
    });
}

// Actualiza qué películas cumplen las condiciones de búsqueda o filtros
function actualizarPeliculasFiltradasCache() {
    const buscador = document.getElementById('buscador-cine');
    const textoBusqueda = buscador ? buscador.value.toLowerCase().trim() : "";

    peliculasFiltradasCache = peliculasDatos.filter(peli => {
        const coincideTexto = peli.tituloMinuscula.includes(textoBusqueda);
        const coincideFiltro = (filtroActivo.tipo === "TODOS") || peli.categorias.includes(filtroActivo.valor);
        return coincideTexto && coincideFiltro;
    });

    paginaActual = 1; // Siempre regresamos a la página 1 cuando se realiza un filtro o búsqueda
}

// Dibuja la página exacta limpiando la anterior
function renderizarPaginaActual() {
    const contenedor = document.getElementById('catalogo-tv');
    if (!contenedor) return;
    contenedor.innerHTML = "";

    const totalPelisFiltradas = peliculasFiltradasCache.length;
    const totalPaginas = Math.ceil(totalPelisFiltradas / peliculasPorPagina) || 1;

    // Calcular índices del corte de paginación
    const indiceInicio = (paginaActual - 1) * peliculasPorPagina;
    const indiceFin = Math.min(indiceInicio + peliculasPorPagina, totalPelisFiltradas);
    const peliculasPagina = peliculasFiltradasCache.slice(indiceInicio, indiceFin);

    peliculasPagina.forEach(peli => {
        const tarjeta = document.createElement('a');
        tarjeta.href = "#";
        tarjeta.className = 'movie-card';
        tarjeta.tabIndex = 0;
        tarjeta.innerHTML = `<img src="${peli.imagen}" alt="${peli.titulo}"><p>${peli.titulo}</p>`;
        
        tarjeta.addEventListener('click', (e) => {
            e.preventDefault();
            tarjetaUltimoClick = tarjeta; 
            abrirFichaTecnica(peli);
        });
        contenedor.appendChild(tarjeta);
    });

    // Actualizar los textos y contadores en la interfaz
    const estadoTitulo = document.getElementById('estado-titulo');
    if (estadoTitulo) {
        estadoTitulo.innerText = `Catálogo (${totalPelisFiltradas} películas)`;
    }

    document.getElementById('txt-page-actual').innerText = paginaActual;
    document.getElementById('txt-page-total').innerText = totalPaginas;

    // Bloquear o desbloquear botones de navegación según posición
    document.getElementById('btn-page-prev').disabled = (paginaActual === 1);
    document.getElementById('btn-page-next').disabled = (paginaActual === totalPaginas);
}

function cambiarPagina(direccion) {
    if (direccion === "siguiente") {
        paginaActual++;
    } else if (direccion === "anterior") {
        paginaActual--;
    }
    renderizarPaginaActual();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Auto-enfoca la primera película de la nueva página para el mando de la TV
    setTimeout(() => {
        const primeraCard = document.querySelector('.movie-card');
        if(primeraCard) primeraCard.focus();
    }, 200);
}

// --- NUEVA LÓGICA DE FICHA TÉCNICA AVANZADA ---
function abrirFichaTecnica(peli) {
    const modal = document.getElementById('modal-ficha-tecnica');
    document.getElementById('ficha-titulo').innerText = peli.titulo;
    document.getElementById('ficha-poster').src = peli.imagen;

    // Colocar etiquetas / géneros de la película
    const contenedorTags = document.getElementById('ficha-tags');
    contenedorTags.innerHTML = "";
    peli.categorias.forEach(cat => {
        const badge = document.createElement('span');
        badge.className = "tag-badge";
        badge.innerText = cat;
        contenedorTags.appendChild(badge);
    });

    // Generar botones independientes para lanzar servidores
    const contenedorServidores = document.getElementById('ficha-contenedor-servidores');
    contenedorServidores.innerHTML = "";

    peli.servidores.forEach(srv => {
        const btn = document.createElement('button');
        // Estilo de color según servidor
        let claseSrv = "generic";
        if(srv.tipo.toLowerCase().includes("odysee")) claseSrv = "odysee";
        if(srv.tipo.toLowerCase().includes("dzen")) claseSrv = "dzenru";

        btn.className = `btn-action-play ${claseSrv}`;
        btn.innerText = `▶️ Reproducir en ${srv.tipo}`;
        btn.tabIndex = 0;
        btn.onclick = function() {
            modal.style.display = "none";
            lanzarCinePantallaCompleta(srv.url);
        };
        contenedorServidores.appendChild(btn);
    });

    modal.style.display = "flex";
    
    // Enfoca el primer botón de reproducción generado automáticamente
    setTimeout(() => {
        if(contenedorServidores.firstChild) contenedorServidores.firstChild.focus();
    }, 100);
}

function cerrarFichaTecnica() {
    document.getElementById('modal-ficha-tecnica').style.display = "none";
    if (tarjetaUltimoClick) tarjetaUltimoClick.focus();
}

function construirPanelFiltros() {
    const gridG = document.getElementById('grid-generos');
    const gridD = document.getElementById('grid-decadas');
    if (!gridG || !gridD) return;

    gridG.innerHTML = "";
    gridD.innerHTML = "";

    const btnTodos = document.createElement('button');
    btnTodos.className = "btn-filtro activo";
    btnTodos.innerText = "🔄 Mostrar Todo";
    btnTodos.onclick = function() { activarFiltro("TODOS", "TODOS", this); };
    gridG.appendChild(btnTodos);

    Array.from(listaGeneros).sort().forEach(gen => {
        const btn = document.createElement('button');
        btn.className = "btn-filtro";
        btn.innerText = gen;
        btn.onclick = function() { activarFiltro("GENERO", gen, this); };
        gridG.appendChild(btn);
    });

    Array.from(listaDecadas).sort().forEach(dec => {
        const btn = document.createElement('button');
        btn.className = "btn-filtro";
        btn.innerText = dec;
        btn.onclick = function() { activarFiltro("DECADA", dec, this); };
        gridD.appendChild(btn);
    });
}

function activarFiltro(tipo, valor, boton) {
    filtroActivo = { tipo: tipo, valor: valor };
    document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('activo'));
    boton.classList.add('activo');
    
    const buscador = document.getElementById('buscador-cine');
    if (buscador && tipo !== "TODOS") buscador.value = "";

    actualizarPeliculasFiltradasCache();
    renderizarPaginaActual();
    cerrarPanelFiltros();
}

function aplicarFiltrosYBusqueda() {
    actualizarPeliculasFiltradasCache();
    renderizarPaginaActual();
}

function abrirPanelFiltros() {
    document.getElementById('panel-filtros').style.display = "block";
    const primerBoton = document.querySelector('.btn-filtro');
    if(primerBoton) primerBoton.focus();
}

function cerrarPanelFiltros() {
    document.getElementById('panel-filtros').style.display = "none";
    const btnMenu = document.getElementById('btn-abrir-menu');
    if(btnMenu) btnMenu.focus();
}

function lanzarCinePantallaCompleta(url) {
    document.body.style.overflow = "hidden";
    const player = document.getElementById('reproductor-pantalla-completa');
    const container = document.getElementById('video-container-tv');
    
    if (player && container) {
        container.innerHTML = `
            <iframe 
                src="${url}" 
                sandbox="allow-scripts allow-same-origin allow-forms"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock;" 
                frameborder="0" 
                allowfullscreen 
                loading="eager" 
                referrerpolicy="no-referrer">
            </iframe>`;
            
        player.style.display = "flex";
        
        const closeBtn = document.getElementById('close-player-btn');
        if (closeBtn) closeBtn.focus();
    }
}

function cerrarReproductor() {
    const player = document.getElementById('reproductor-pantalla-completa');
    const container = document.getElementById('video-container-tv');

    if (player && container) {
        player.style.display = "none";
        container.innerHTML = ""; 
        document.body.style.overflowY = "auto";
        
        if (tarjetaUltimoClick) {
            tarjetaUltimoClick.focus();
            elementoEnfocadoActual = tarjetaUltimoClick;
        } else {
            const btnMenu = document.getElementById('btn-abrir-menu');
            if(btnMenu) btnMenu.focus();
        }
    }
}

// CONTROL DE MOVIMIENTOS D-PAD / TECLADO REMOTO
document.addEventListener('keydown', (e) => {
    const buscador = document.getElementById('buscador-cine');
    const panelFiltros = document.getElementById('panel-filtros');
    const modalFicha = document.getElementById('modal-ficha-tecnica');
    const reproductor = document.getElementById('reproductor-pantalla-completa');

    if (e.key === "Escape" || e.key === "BrowserBack" || e.code === "GoBack") {
        if (reproductor && reproductor.style.display === "flex") {
            cerrarReproductor();
            e.preventDefault();
            return;
        }
        if (modalFicha && modalFicha.style.display === "flex") {
            cerrarFichaTecnica();
            e.preventDefault();
            return;
        }
        if (panelFiltros && panelFiltros.style.display === "block") {
            cerrarPanelFiltros();
            e.preventDefault();
            return;
        }
    }

    if (reproductor && reproductor.style.display === "flex") {
        if (e.key === "Enter") {
            cerrarReproductor();
            e.preventDefault();
        }
        return; 
    }

    if (document.activeElement === buscador && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        return; 
    }

    let elementosEnfocables = [];
    
    if (modalFicha && modalFicha.style.display === "flex") {
        elementosEnfocables = Array.from(modalFicha.querySelectorAll('.btn-action-play'));
    } else if (panelFiltros && panelFiltros.style.display === "block") {
        elementosEnfocables = Array.from(panelFiltros.querySelectorAll('.btn-filtro, #btn-cerrar-panel'));
    } else {
        elementosEnfocables = Array.from(document.querySelectorAll('#buscador-cine, #btn-abrir-menu, .movie-card, .btn-page-nav:not(:disabled)'));
    }

    let index = elementosEnfocables.indexOf(document.activeElement);
    if (index === -1) {
        if (elementosEnfocables.length > 0) elementosEnfocables[0].focus();
        return;
    }

    let proximoElemento = null;

    if (e.key === "ArrowRight") {
        proximoElemento = elementosEnfocables[index + 1] || elementosEnfocables[0];
    } else if (e.key === "ArrowLeft") {
        proximoElemento = elementosEnfocables[index - 1] || elementosEnfocables[elementosEnfocables.length - 1];
    } else if (e.key === "ArrowDown") {
        proximoElemento = buscarElementoAbajoOArriba(elementosEnfocables, index, "abajo");
    } else if (e.key === "ArrowUp") {
        proximoElemento = buscarElementoAbajoOArriba(elementosEnfocables, index, "arriba");
    } else if (e.key === "Enter") {
        document.activeElement.click();
        e.preventDefault();
    }

    if (proximoElemento) {
        proximoElemento.focus();
        elementoEnfocadoActual = proximoElemento;
        proximoElemento.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        e.preventDefault();
    }
});

function buscarElementoAbajoOArriba(lista, indexActual, direccion) {
    const actualRect = lista[indexActual].getBoundingClientRect();
    let mejorOpcion = null;
    let distanciaMinima = Infinity;

    lista.forEach((elem, idx) => {
        if (idx === indexActual) return;
        const elemRect = elem.getBoundingClientRect();
        
        const condDireccion = (direccion === "abajo") 
            ? (elemRect.top >= actualRect.bottom - 5) 
            : (elemRect.bottom <= actualRect.top + 5);

        if (condDireccion) {
            const centroActualX = actualRect.left + (actualRect.width / 2);
            const centroElemX = elemRect.left + (elemRect.width / 2);
            const distanciaX = Math.abs(centroActualX - centroElemX);
            const distanciaY = Math.abs(elemRect.top - actualRect.top);
            
            const distanciaTotal = distanciaX + (distanciaY * 2); 

            if (distanciaTotal < distanciaMinima) {
                distanciaMinima = distanciaTotal;
                mejorOpcion = elem;
            }
        }
    });

    return mejorOpcion;
}

document.addEventListener('DOMContentLoaded', () => {
    const buscador = document.getElementById('buscador-cine');
    if(buscador) buscador.addEventListener('input', aplicarFiltrosYBusqueda);
    
    const closeBtn = document.getElementById('close-player-btn');
    if(closeBtn) closeBtn.addEventListener('click', cerrarReproductor);

    const btnAbrir = document.getElementById('btn-abrir-menu');
    if(btnAbrir) btnAbrir.addEventListener('click', abrirPanelFiltros);

    const btnCerrarP = document.getElementById('btn-cerrar-panel');
    if(btnCerrarP) btnCerrarP.addEventListener('click', cerrarPanelFiltros);

    const btnCerrarF = document.getElementById('btn-cerrar-ficha');
    if(btnCerrarF) btnCerrarF.addEventListener('click', cerrarFichaTecnica);

    // Botones del Paginador Real
    document.getElementById('btn-page-prev').addEventListener('click', () => cambiarPagina("anterior"));
    document.getElementById('btn-page-next').addEventListener('click', () => cambiarPagina("siguiente"));
});
