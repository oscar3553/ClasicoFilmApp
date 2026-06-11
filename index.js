let totalPeliculas = 0;
const titulosRegistrados = new Set();
let peliculasDatos = []; 

let listaGeneros = new Set();
let listaDecadas = new Set();
let filtroActivo = { tipo: "TODOS", valor: "TODOS" };

let elementoEnfocadoActual = null;
let tarjetaUltimoClick = null;
let siguienteIndiceCarga = 451; // Empezamos la paginación en el siguiente bloque disponible

document.addEventListener('deviceready', () => {
    cargarTodoElCatalogoInicial();
}, false);

async function cargarTodoElCatalogoInicial() {
    const estadoTitulo = document.getElementById('estado-titulo');
    if(estadoTitulo) estadoTitulo.innerText = "Conectando con Blogger...";
    
    // Carga inicial masiva de bloques 1, 2 y 3
    await cargarBloque(1);
    await cargarBloque(151);
    await cargarBloque(301);
    
    actualizarContadorVisual();
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
                    if (data.feed && data.feed.entry) agregarPeliculasAlCatalogo(data.feed.entry);
                } catch (e) { console.error(e); }
                resolve();
            }, function(err) { resolve(); });
        } else {
            fetch(url).then(res => res.json()).then(data => {
                if (data.feed && data.feed.entry) agregarPeliculasAlCatalogo(data.feed.entry);
                resolve();
            }).catch(() => resolve());
        }
    });
}

// Función del botón de paginación manual ("Cargar más páginas")
async function cargarSiguientePagina() {
    const btn = document.getElementById('btn-cargar-mas');
    if(btn) { btn.innerText = "⏳ CARGANDO..."; btn.disabled = true; }

    await cargarBloque(siguienteIndiceCarga);
    siguienteIndiceCarga += 150; // Desplazamos el puntero para el próximo clic

    actualizarContadorVisual();
    construirPanelFiltros(); // Actualizar categorías por si hay nuevos géneros
    aplicarFiltrosYBusqueda();

    if(btn) { btn.innerText = "🔽 MOSTRAR MÁS PELÍCULAS"; btn.disabled = false; }
}

function agregarPeliculasAlCatalogo(entradas) {
    const contenedor = document.getElementById('catalogo-tv');
    if (!entradas || !contenedor) return;

    entradas.forEach((entry) => {
        const titulo = entry.title.$t;
        if (titulosRegistrados.has(titulo)) return;
        titulosRegistrados.add(titulo);

        let imagenUrl = "https://via.placeholder.com/200x280?text=Cine";
        if (entry.media$thumbnail) imagenUrl = entry.media$thumbnail.url.replace('/s72-c/', '/s400/');

        // --- SISTEMA MULTI-SERVIDOR DUAL ---
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

        // Si no encontramos servidores válidos específicos, buscamos cualquier iframe genérico
        if (opcionesServidores.length === 0 && matches.length > 0) {
            opcionesServidores.push({ tipo: "Servidor Principal", url: (matches[0][1].startsWith('//') ? 'https:' + matches[0][1] : matches[0][1]) });
        }

        if (opcionesServidores.length === 0) return; // Saltamos posts sin video

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

        const tarjeta = document.createElement('a');
        tarjeta.href = "#";
        tarjeta.className = 'movie-card';
        tarjeta.tabIndex = 0;
        tarjeta.innerHTML = `<img src="${imagenUrl}" alt="${titulo}"><p>${titulo}</p>`;
        
        tarjeta.addEventListener('click', (e) => {
            e.preventDefault();
            tarjetaUltimoClick = tarjeta; 
            gestionarAperturaVideo(titulo, opcionesServidores);
        });

        contenedor.appendChild(tarjeta);
        totalPeliculas++;

        peliculasDatos.push({ 
            elemento: tarjeta, 
            titulo: titulo.toLowerCase(), 
            categorias: categoriasPeli 
        });
    });
}

// Lógica decisiva: Si hay un servidor va directo, si hay varios despliega el diálogo flotante
function gestionarAperturaVideo(titulo, servidores) {
    if (servidores.length === 1) {
        lanzarCinePantallaCompleta(servidores[0].url);
    } else {
        const modal = document.getElementById('modal-servidores');
        const modalTitulo = document.getElementById('modal-titulo-peli');
        const contenedorBotones = document.getElementById('modal-botones-opciones');
        
        if(!modal || !contenedorBotones) return;

        modalTitulo.innerText = titulo;
        contenedorBotones.innerHTML = "";

        servidores.forEach(srv => {
            const btn = document.createElement('button');
            btn.className = `btn-servidor ${srv.tipo.toLowerCase().replace('.', '')}`;
            btn.innerText = `Reproducir en ${srv.tipo}`;
            btn.tabIndex = 0;
            btn.onclick = function() {
                modal.style.display = "none";
                lanzarCinePantallaCompleta(srv.url);
            };
            contenedorBotones.appendChild(btn);
        });

        modal.style.display = "flex";
        contenedorBotones.firstChild.focus(); // Enfoca la primera opción de reproducción automáticamente
    }
}

function actualizarContadorVisual() {
    const estadoTitulo = document.getElementById('estado-titulo');
    if (estadoTitulo) {
        if (totalPeliculas === 0) {
            estadoTitulo.innerText = "Error: Sin conexión al catálogo";
        } else {
            estadoTitulo.innerText = `Catálogo (${totalPeliculas} películas)`;
        }
    }
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

    aplicarFiltrosYBusqueda();
    cerrarPanelFiltros();
}

function aplicarFiltrosYBusqueda() {
    const buscador = document.getElementById('buscador-cine');
    const texto = buscador ? buscador.value.toLowerCase().trim() : "";

    peliculasDatos.forEach(peli => {
        const coincideTexto = peli.titulo.includes(texto);
        let coincideFiltro = false;

        if (filtroActivo.tipo === "TODOS") {
            coincideFiltro = true;
        } else {
            coincideFiltro = peli.categorias.includes(filtroActivo.valor);
        }

        if (coincideTexto && coincideFiltro) {
            peli.elemento.style.display = "block";
        } else {
            peli.elemento.style.display = "none";
        }
    });

    const visibles = peliculasDatos.filter(p => p.elemento.style.display !== "none").length;
    const estadoTitulo = document.getElementById('estado-titulo');
    if (estadoTitulo) {
        if(filtroActivo.tipo === "TODOS" && texto === "") {
            estadoTitulo.innerText = `Catálogo (${totalPeliculas} películas)`;
        } else {
            estadoTitulo.innerText = `Resultados (${visibles} películas)`;
        }
    }
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

// REPRODUCTOR CON MÁXIMA PERSISTENCIA DE CONTROL "VOLVER"
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
            
        player.style.display = "block";
        
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

// CONTROL REMOTO GLOBAL DE TECLADO / MANDO DE TELEVISIÓN
document.addEventListener('keydown', (e) => {
    const buscador = document.getElementById('buscador-cine');
    const panelFiltros = document.getElementById('panel-filtros');
    const modalServidores = document.getElementById('modal-servidores');
    const reproductor = document.getElementById('reproductor-pantalla-completa');

    // Botón físico "Atrás" del mando / móvil siempre cierra el reproductor o modales
    if (e.key === "Escape" || e.key === "BrowserBack" || e.code === "GoBack") {
        if (reproductor && reproductor.style.display === "block") {
            cerrarReproductor();
            e.preventDefault();
            return;
        }
        if (modalServidores && modalServidores.style.display === "flex") {
            modalServidores.style.display = "none";
            if (tarjetaUltimoClick) tarjetaUltimoClick.focus();
            e.preventDefault();
            return;
        }
        if (panelFiltros && panelFiltros.style.display === "block") {
            cerrarPanelFiltros();
            e.preventDefault();
            return;
        }
    }

    // Si el reproductor está activo en pantalla, el botón Volver virtual es el único que responde
    if (reproductor && reproductor.style.display === "block") {
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
    
    if (modalServidores && modalServidores.style.display === "flex") {
        elementosEnfocables = Array.from(modalServidores.querySelectorAll('.btn-servidor'));
    } else if (panelFiltros && panelFiltros.style.display === "block") {
        elementosEnfocables = Array.from(panelFiltros.querySelectorAll('.btn-filtro, #btn-cerrar-panel'));
    } else {
        elementosEnfocables = Array.from(document.querySelectorAll('#buscador-cine, #btn-abrir-menu, .movie-card:not([style*="display: none"]), #btn-cargar-mas'));
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

    const btnCargarMas = document.getElementById('btn-cargar-mas');
    if(btnCargarMas) btnCargarMas.addEventListener('click', cargarSiguientePagina);

    const btnCancelarSrv = document.getElementById('btn-cancelar-server');
    if(btnCancelarSrv) btnCancelarSrv.addEventListener('click', () => {
        document.getElementById('modal-servidores').style.display = "none";
        if (tarjetaUltimoClick) tarjetaUltimoClick.focus();
    });
});
