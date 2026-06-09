let totalPeliculas = 0;
const titulosRegistrados = new Set();
let peliculasDatos = []; 
let todasLasEtiquetas = new Set();
let generoActivo = "TODOS";

// Variables para el control del mando a distancia (Navegación por teclado/DPAD)
let elementoEnfocadoActual = null;

// Inicialización nativa de la App con Cordova
document.addEventListener('deviceready', () => {
    // Aquí se pueden añadir configuraciones nativas de Android si hiciera falta
    console.log("Cordova está listo.");
}, false);

async function cargarTodoElCatalogo() {
    const estadoTitulo = document.getElementById('estado-titulo');
    if(estadoTitulo) estadoTitulo.innerText = "Cargando catálogo...";
    
    await cargarBloque(1);
    await cargarBloque(151);
    await cargarBloque(301);
    
    if(estadoTitulo) estadoTitulo.innerText = `Catálogo (${totalPeliculas} películas)`;
    crearBotonesDeGeneros();
    
    // Al terminar de cargar, enfocamos automáticamente el buscador para empezar a navegar con el mando
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
    try {
        const response = await fetch(url);
        if (!response.ok) return;
        const data = await response.json();
        if (data.feed && data.feed.entry) agregarPeliculasAlCatalogo(data.feed.entry);
    } catch (e) { console.error("Error en bloque: ", e); }
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

        let generosPeli = [];
        if (entry.category) {
            generosPeli = entry.category.map(cat => cat.term.trim());
            generosPeli.forEach(g => todasLasEtiquetas.add(g));
        }

        const tarjeta = document.createElement('a');
        tarjeta.href = "#";
        tarjeta.className = 'movie-card';
        tarjeta.tabIndex = 0; // Permite que sea enfocable por el mando
        tarjeta.innerHTML = `<img src="${imagenUrl}" alt="${titulo}"><p>${titulo}</p>`;
        
        tarjeta.addEventListener('click', (e) => {
            e.preventDefault();
            lanzarCinePantallaCompleta(urlVideo);
        });

        contenedor.appendChild(tarjeta);
        totalPeliculas++;

        peliculasDatos.push({ 
            elemento: tarjeta, 
            titulo: titulo.toLowerCase(), 
            generos: generosPeli 
        });
    });
}

function crearBotonesDeGeneros() {
    const contenedorG = document.getElementById('lista-generos');
    if (!contenedorG) return;
    contenedorG.innerHTML = "";
    
    const botonTodos = document.createElement('button');
    botonTodos.id = "btn-genero-todos"; 
    botonTodos.className = "btn-genero activo";
    botonTodos.tabIndex = 0;
    botonTodos.innerText = "Todas las películas";
    botonTodos.onclick = function() { filtrarPorGenero("TODOS", this); };
    contenedorG.appendChild(botonTodos);

    Array.from(todasLasEtiquetas).sort().forEach(genero => {
        const btn = document.createElement('button');
        btn.className = "btn-genero";
        btn.tabIndex = 0;
        btn.innerText = genero;
        btn.onclick = function() { filtrarPorGenero(genero, this); };
        contenedorG.appendChild(btn);
    });
}

function filtrarPorGenero(genero, botonSeleccionado) {
    generoActivo = genero;
    const buscador = document.getElementById('buscador-cine');
    if (buscador) buscador.value = "";
    
    document.querySelectorAll('.btn-genero').forEach(b => b.classList.remove('activo'));
    botonSeleccionado.classList.add('activo');
    aplicarFiltrosYBusqueda();
}

function aplicarFiltrosYBusqueda() {
    const buscador = document.getElementById('buscador-cine');
    const textoBusqueda = buscador ? buscador.value.toLowerCase().trim() : "";
    
    if (textoBusqueda !== "" && generoActivo !== "TODOS") {
        generoActivo = "TODOS";
        document.querySelectorAll('.btn-genero').forEach(b => b.classList.remove('activo'));
        const btnTodos = document.getElementById('btn-genero-todos');
        if (btnTodos) btnTodos.classList.add('activo');
    }

    peliculasDatos.forEach(peli => {
        const coincideBusqueda = peli.titulo.includes(textoBusqueda);
        const coincideGenero = (generoActivo === "TODOS" || peli.generos.includes(generoActivo));

        if (coincideBusqueda && coincideGenero) {
            peli.elemento.style.display = "block";
        } else {
            peli.elemento.style.display = "none";
        }
    });
}

function lanzarCinePantallaCompleta(url) {
    document.body.style.overflow = "hidden";
    const container = document.getElementById('video-container-tv');
    const player = document.getElementById('reproductor-pantalla-completa');
    if (container && player) {
        container.innerHTML = `<iframe src="${url}" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
        player.style.display = "block";
        const closeBtn = document.getElementById('close-player-btn');
        if (closeBtn) closeBtn.focus(); // Enfocar botón cerrar para el mando
    }
}

function cerrarReproductor() {
    const player = document.getElementById('reproductor-pantalla-completa');
    const container = document.getElementById('video-container-tv');
    if (player && container) {
        player.style.display = "none";
        container.innerHTML = ""; 
        document.body.style.overflowY = "auto";
        if (elementoEnfocadoActual) elementoEnfocadoActual.focus();
    }
}

// ==========================================
// SCRIPT DE CONTROL REMOTO (MANDO DE LA TV)
// ==========================================
document.addEventListener('keydown', (e) => {
    const buscador = document.getElementById('buscador-cine');
    
    // Si el usuario está escribiendo en el buscador, permitimos que las flechas izquierda/derecha se muevan por el texto
    if (document.activeElement === buscador && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        return; 
    }

    let elementosEnfocables = Array.from(document.querySelectorAll('#buscador-cine, .btn-genero, .movie-card:not([style*="display: none"])'));
    if (document.getElementById('reproductor-pantalla-completa').style.display === "block") {
        elementosEnfocables = [document.getElementById('close-player-btn')];
    }

    let index = elementosEnfocables.indexOf(document.activeElement);

    if (index === -1) {
        if (elementosEnfocables.length > 0) elementosEnfocables[0].focus();
        return;
    }

    let proximoElemento = null;

    // Lógica inteligente de salto según la tecla del mando
    if (e.key === "ArrowRight") {
        proximoElemento = elementosEnfocables[index + 1] || elementosEnfocables[0];
    } else if (e.key === "ArrowLeft") {
        proximoElemento = elementosEnfocables[index - 1] || elementosEnfocables[elementosEnfocables.length - 1];
    } else if (e.key === "ArrowDown") {
        // En parrilla, saltar a la fila de abajo aproximando la posición geométrica
        proximoElemento = buscarElementoAbajoOArriba(elementosEnfocables, index, "abajo");
    } else if (e.key === "ArrowUp") {
        proximoElemento = buscarElementoAbajoOArriba(elementosEnfocables, index, "arriba");
    } else if (e.key === "Enter") {
        // El botón central del mando ejecuta la acción
        document.activeElement.click();
        e.preventDefault();
    } else if (e.key === "Escape" || e.key === "BrowserBack" || e.code === "GoBack") {
        // Manejar el botón "Atrás" del mando a distancia
        if (document.getElementById('reproductor-pantalla-completa').style.display === "block") {
            cerrarReproductor();
            e.preventDefault();
        }
    }

    if (proximoElemento) {
        proximoElemento.focus();
        elementoEnfocadoActual = proximoElemento;
        // Hacer scroll automático suave para que el elemento enfocado esté a la vista
        proximoElemento.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        e.preventDefault();
    }
});

// Función auxiliar para calcular saltos verticales en la rejilla de la TV
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
            // Calcular distancia matemática entre centros horizontales (X)
            const centroActualX = actualRect.left + (actualRect.width / 2);
            const centroElemX = elemRect.left + (elemRect.width / 2);
            const distanciaX = Math.abs(centroActualX - centroElemX);
            const distanciaY = Math.abs(elemRect.top - actualRect.top);
            
            // Peso para priorizar elementos en la misma vertical
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
    
    cargarTodoElCatalogo();
});
