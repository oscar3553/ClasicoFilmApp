let totalPeliculas = 0;
const titulosRegistrados = new Set();
let peliculasDatos = []; 

let listaGeneros = new Set();
let listaDecadas = new Set();
let filtroActivo = { tipo: "TODOS", valor: "TODOS" };

let elementoEnfocadoActual = null;
let tarjetaUltimoClick = null;
let temporizadorOcultarBoton = null;

// Inicialización nativa con Cordova
document.addEventListener('deviceready', () => {
    cargarTodoElCatalogo();
}, false);

async function cargarTodoElCatalogo() {
    const estadoTitulo = document.getElementById('estado-titulo');
    if(estadoTitulo) estadoTitulo.innerText = "Conectando con Blogger...";
    
    await cargarBloque(1);
    await cargarBloque(151);
    await cargarBloque(301);
    
    if(estadoTitulo) {
        if (totalPeliculas === 0) {
            estadoTitulo.innerText = "Error: Sin conexión al catálogo";
        } else {
            estadoTitulo.innerText = `Catálogo (${totalPeliculas} películas)`;
        }
    }
    
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

function agregarPeliculasAlCatalogo(entradas) {
    const contenedor = document.getElementById('catalogo-tv');
    if (!entradas || !contenedor) return;

    entradas.forEach((entry) => {
        const titulo = entry.title.$t;
        if (titulosRegistrados.has(titulo)) return;
        titulosRegistrados.add(titulo);

        let imagenUrl = "https://via.placeholder.com/200x280?text=Cine";
        if (entry.media$thumbnail) imagenUrl = entry.media$thumbnail.url.replace('/s72-c/', '/s400/');

        let urlVideo = "";
        const contenidoPost = entry.content ? entry.content.$t : "";
        const coincidencia = contenidoPost.match(/<iframe[^>]+src="([^">]+)"/);
        if (coincidencia && coincidencia[1]) {
            urlVideo = coincidencia[1].startsWith('//') ? 'https:' + coincidencia[1] : coincidencia[1];
        }
        if (!urlVideo) return;

        // Separar inteligentemente Géneros de Décadas
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
            lanzarCinePantallaCompleta(urlVideo);
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

function construirPanelFiltros() {
    const gridG = document.getElementById('grid-generos');
    const gridD = document.getElementById('grid-decadas');
    if (!gridG || !gridD) return;

    gridG.innerHTML = "";
    gridD.innerHTML = "";

    // Botón por defecto para limpiar filtros
    const btnTodos = document.createElement('button');
    btnTodos.className = "btn-filtro activo";
    btnTodos.innerText = "🔄 Mostrar Todo";
    btnTodos.onclick = function() { activarFiltro("TODOS", "TODOS", this); };
    gridG.appendChild(btnTodos);

    // Pintar lista de géneros ordenados
    Array.from(listaGeneros).sort().forEach(gen => {
        const btn = document.createElement('button');
        btn.className = "btn-filtro";
        btn.innerText = gen;
        btn.onclick = function() { activarFiltro("GENERO", gen, this); };
        gridG.appendChild(btn);
    });

    // Pintar lista de décadas ordenadas
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

    // Actualizar contador visual
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

// CONTROL DE INTERFAZ DEL PANEL DE FILTROS
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

// REPRODUCTOR FLUIDO Y OPTIMIZADO PARA ODYSEE
function lanzarCinePantallaCompleta(url) {
    document.body.style.overflow = "hidden";
    const player = document.getElementById('reproductor-pantalla-completa');
    const container = document.getElementById('video-container-tv');
    
    if (player && container) {
        // Atributos de optimización y sandbox para Odysee / Aceleración de Hardware WebView
        container.innerHTML = `<iframe src="${url}" allow="autoplay; fullscreen" allowfullscreen loading="eager" referrerpolicy="no-referrer"></iframe>`;
        player.style.display = "block";
        
        const closeBtn = document.getElementById('close-player-btn');
        if (closeBtn) closeBtn.focus();

        // Inicializar el sistema de ocultación automática del botón (Autohide)
        reiniciarTemporizadorBotonCerrar();
        
        // Eventos para detectar interacción del usuario (móvil o mando) y mostrar la X
        player.addEventListener('mousemove', mostrarBotonTemporalmente);
        player.addEventListener('click', mostrarBotonTemporalmente);
        player.addEventListener('touchstart', mostrarBotonTemporalmente);
    }
}

function mostrarBotonTemporalmente() {
    const player = document.getElementById('reproductor-pantalla-completa');
    if(player && player.classList.contains('user-inactive')) {
        player.classList.remove('user-inactive');
        player.classList.add('user-active');
    }
    reiniciarTemporizadorBotonCerrar();
}

function reiniciarTemporizadorBotonCerrar() {
    clearTimeout(temporizadorOcultarBoton);
    temporizadorOcultarBoton = setTimeout(() => {
        const player = document.getElementById('reproductor-pantalla-completa');
        if(player && document.activeElement !== document.getElementById('close-player-btn')) {
            player.classList.remove('user-active');
            player.classList.add('user-inactive');
        }
    }, 3500); // Se oculta solo a los 3.5 segundos de inactividad
}

function cerrarReproductor() {
    const player = document.getElementById('reproductor-pantalla-completa');
    const container = document.getElementById('video-container-tv');
    clearTimeout(temporizadorOcultarBoton);

    if (player && container) {
        player.style.display = "none";
        container.innerHTML = ""; 
        document.body.style.overflowY = "auto";
        
        // ¡SOLUCIÓN CRÍTICA!: Al cerrar devolvemos el foco a la carátula, impidiendo que salte el teclado
        if (tarjetaUltimoClick) {
            tarjetaUltimoClick.focus();
            elementoEnfocadoActual = tarjetaUltimoClick;
        } else {
            const btnMenu = document.getElementById('btn-abrir-menu');
            if(btnMenu) btnMenu.focus();
        }
    }
}

// SISTEMA DE CONTROL DE TECLADO / MANDO DE TELEVISIÓN (DPAD)
document.addEventListener('keydown', (e) => {
    const buscador = document.getElementById('buscador-cine');
    const panelFiltros = document.getElementById('panel-filtros');
    const reproductor = document.getElementById('reproductor-pantalla-completa');

    // Si el reproductor está activo, cualquier interacción despierta al botón cerrar
    if (reproductor && reproductor.style.display === "block") {
        mostrarBotonTemporalmente();
        if (e.key === "Escape" || e.key === "BrowserBack" || e.code === "GoBack") {
            cerrarReproductor();
            e.preventDefault();
        }
        return; 
    }

    if (document.activeElement === buscador && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        return; 
    }

    let elementosEnfocables = [];
    
    if (panelFiltros && panelFiltros.style.display === "block") {
        elementosEnfocables = Array.from(panelFiltros.querySelectorAll('.btn-filtro, #btn-cerrar-panel'));
    } else {
        elementosEnfocables = Array.from(document.querySelectorAll('#buscador-cine, #btn-abrir-menu, .movie-card:not([style*="display: none"])'));
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
    } else if (e.key === "Escape" || e.key === "BrowserBack" || e.code === "GoBack") {
        if (panelFiltros && panelFiltros.style.display === "block") {
            cerrarPanelFiltros();
            e.preventDefault();
        }
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
});
