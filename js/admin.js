const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api'
    : 'https://priorityparking-mvp-production.up.railway.app/api';

const TITULOS_VISTAS = {
    'seccion-dashboard': 'Panel General de Aforo y Capacidad',
    'seccion-padron': 'Gestión del Padrón Estudiantil (.CSV)',
    'seccion-garitas': 'Gestión de Operadores de Garita'
};

function decodificarJwt(token) {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch {
        return null;
    }
}

function mostrarAlerta(elemento, mensaje, tipo) {
    if (!elemento) return;
    elemento.innerText = mensaje;
    elemento.className = `alert ${tipo}`;
    elemento.classList.remove('hidden');
}

function activarPestana(targetId, token) {
    const link = document.querySelector(`.nav-item[data-tab="${targetId}"]`);
    const seccion = document.getElementById(targetId);
    if (!link || !seccion) return;

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    link.classList.add('active');

    document.querySelectorAll('.admin-section').forEach(sec => sec.classList.add('hidden'));
    seccion.classList.remove('hidden');

    const tituloEl = document.getElementById('tituloVistaAdmin');
    if (tituloEl && TITULOS_VISTAS[targetId]) {
        tituloEl.innerText = TITULOS_VISTAS[targetId];
    }

    if (targetId === 'seccion-dashboard') cargarEstadoAforo(token);
    if (targetId === 'seccion-garitas') cargarOperadoresGarita(token);
}

function inicializarValidacionGarita() {
    const inputNombre = document.getElementById('garitaNombre');
    const inputUser = document.getElementById('garitaUsername');
    const inputPass = document.getElementById('garitaPassword');
    const btnToggle = document.getElementById('btnToggleGaritaPass');
    const btnSubmit = document.getElementById('btnCrearGarita');
    const hintUser = document.getElementById('hintUsuarioGarita');
    const barra = document.getElementById('barraFuerzaGarita');
    const txtFuerza = document.getElementById('textoFuerzaGarita');

    if (!inputPass || !btnToggle) return;

    btnToggle.addEventListener('click', () => {
        const oculto = inputPass.type === 'password';
        inputPass.type = oculto ? 'text' : 'password';
        btnToggle.textContent = oculto ? '🙈' : '👁️';
    });

    const marcarRegla = (id, cumple, texto) => {
        const li = document.getElementById(id);
        if (!li) return;
        li.className = cumple ? 'valido' : 'invalido';
        li.textContent = `${cumple ? '✔' : '✖'} ${texto}`;
    };

    const validar = () => {
        const nombre = inputNombre.value.trim();
        const user = inputUser.value.trim().toUpperCase();
        const pass = inputPass.value;

        const userOk = /^[A-Z0-9_-]{4,25}$/.test(user);
        if (!user) {
            hintUser.className = 'hint-estado';
            hintUser.textContent = 'Mínimo 4 caracteres (letras, números o guiones).';
        } else if (userOk) {
            hintUser.className = 'hint-estado ok';
            hintUser.textContent = `✔ Usuario válido (${user})`;
        } else {
            hintUser.className = 'hint-estado err';
            hintUser.textContent = '✖ Formato inválido (4-25 caracteres, sin espacios).';
        }

        const cLen = pass.length >= 8;
        const cMayus = /[A-Z]/.test(pass);
        const cMinus = /[a-z]/.test(pass);
        const cNum = /\d/.test(pass);
        const cSimb = /[^A-Za-z0-9]/.test(pass);

        const passLower = pass.toLowerCase();
        const usaUsuario = user.length >= 3 && passLower.includes(user.toLowerCase());
        const usaNombre = nombre.toLowerCase().split(/\s+/).some(p => p.length >= 3 && passLower.includes(p));
        const cPersonal = pass.length > 0 && !usaUsuario && !usaNombre;

        marcarRegla('chkLen', cLen, 'Mínimo 8 caracteres');
        marcarRegla('chkMayus', cMayus, 'Al menos 1 letra mayúscula (A-Z)');
        marcarRegla('chkMinus', cMinus, 'Al menos 1 letra minúscula (a-z)');
        marcarRegla('chkNum', cNum, 'Al menos 1 número (0-9)');
        marcarRegla('chkSimb', cSimb, 'Al menos 1 símbolo especial');
        marcarRegla('chkPersonal', cPersonal, 'No contiene usuario ni nombre');

        const puntos = [cLen, cMayus, cMinus, cNum, cSimb, cPersonal].filter(Boolean).length;
        barra.style.width = `${Math.round((puntos / 6) * 100)}%`;

        if (pass.length === 0) {
            barra.style.backgroundColor = '#dc2626';
            txtFuerza.textContent = 'Nivel de seguridad: Sin ingresar';
            txtFuerza.style.color = '#475569';
        } else if (puntos < 4) {
            barra.style.backgroundColor = '#dc2626';
            txtFuerza.textContent = 'Nivel de seguridad: Débil';
            txtFuerza.style.color = '#dc2626';
        } else if (puntos < 6) {
            barra.style.backgroundColor = '#d97706';
            txtFuerza.textContent = 'Nivel de seguridad: Media (completa los requisitos)';
            txtFuerza.style.color = '#d97706';
        } else {
            barra.style.backgroundColor = '#16a34a';
            txtFuerza.textContent = '✔ Contraseña segura validada';
            txtFuerza.style.color = '#15803d';
        }

        btnSubmit.disabled = !(nombre.length >= 3 && userOk && puntos === 6);
    };

    [inputNombre, inputUser, inputPass].forEach(el => el.addEventListener('input', validar));
    document.getElementById('formCrearGarita').addEventListener('reset', () => setTimeout(validar, 0));
}

document.addEventListener('DOMContentLoaded', () => {
    const token = sessionStorage.getItem('tokenSession');
    const usuario = token ? decodificarJwt(token) : null;

    if (!token || !usuario || usuario.rol !== 'ADMIN') {
        sessionStorage.clear();
        window.location.href = 'login-admin.html';
        return;
    }

    const nombreAdmin = usuario.nombreCompleto || sessionStorage.getItem('operadorLogueado') || 'Administrador';
    document.getElementById('adminNameLabel').innerText = nombreAdmin;
    document.getElementById('avatarAdmin').innerText = nombreAdmin.substring(0, 2).toUpperCase();

    document.getElementById('btnCerrarSesion').addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = 'login-admin.html';
    });

    document.querySelectorAll('.nav-item').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-tab');
            window.history.replaceState(null, '', `#${targetId}`);
            activarPestana(targetId, token);
        });
    });

    inicializarValidacionGarita();

    const hashInicial = window.location.hash.replace('#', '');
    if (hashInicial && document.getElementById(hashInicial)) {
        activarPestana(hashInicial, token);
    } else {
        cargarEstadoAforo(token);
        cargarOperadoresGarita(token);
    }

    document.getElementById('formConfigurarAforo').addEventListener('submit', async (e) => {
        e.preventDefault();
        const alertaAforo = document.getElementById('alertaAforo');
        const mesAnio = document.getElementById('inputMesAforo').value;
        const capacidadMensual = parseInt(document.getElementById('inputCapacidadMensual').value, 10);

        try {
            const res = await fetch(`${API_URL}/admin/aforo`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ mesAnio, capacidadMensual })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Error al actualizar el aforo mensual.');

            mostrarAlerta(alertaAforo, data.mensaje, 'success');
            await cargarEstadoAforo(token);
        } catch (err) {
            mostrarAlerta(alertaAforo, err.message, 'error');
        }
    });

    document.getElementById('formCargaCsv').addEventListener('submit', async (e) => {
        e.preventDefault();
        const inputArchivo = document.getElementById('inputCsvPadron');
        const alertaCsv = document.getElementById('alertaCsv');
        const archivo = inputArchivo.files[0];

        if (!archivo || !archivo.name.toLowerCase().endsWith('.csv')) {
            mostrarAlerta(alertaCsv, 'Seleccione un archivo .csv válido.', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('archivoCsv', archivo);

        try {
            const res = await fetch(`${API_URL}/admin/estudiantes/csv`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Error al procesar el archivo CSV.');

            mostrarAlerta(alertaCsv, data.mensaje, 'success');
            const { resumen } = data;
            document.getElementById('statProcesados').innerText = resumen.totalProcesados;
            document.getElementById('statAptos').innerText = resumen.totalAptos;
            document.getElementById('statNoAptos').innerText = resumen.noAptosPorDeudaOEstado;
            document.getElementById('statQuinto').innerText = resumen.distribucionPrioridad.altaQuintoSuperior;
            document.getElementById('statTercio').innerText = resumen.distribucionPrioridad.mediaTercioSuperior;
            document.getElementById('statEstandar').innerText = resumen.distribucionPrioridad.estandar;
            document.getElementById('resumenCargaCsv').classList.remove('hidden');
            inputArchivo.value = '';
            await cargarEstadoAforo(token);
        } catch (err) {
            mostrarAlerta(alertaCsv, err.message, 'error');
        }
    });

    document.getElementById('formCrearGarita').addEventListener('submit', async (e) => {
        e.preventDefault();
        const alertaGarita = document.getElementById('alertaGarita');
        const payload = {
            nombreCompleto: document.getElementById('garitaNombre').value.trim(),
            username: document.getElementById('garitaUsername').value.trim(),
            password: document.getElementById('garitaPassword').value
        };

        try {
            const res = await fetch(`${API_URL}/admin/garitas`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'No se pudo registrar el operador.');

            mostrarAlerta(alertaGarita, data.mensaje, 'success');
            document.getElementById('formCrearGarita').reset();
            await cargarOperadoresGarita(token);
        } catch (err) {
            mostrarAlerta(alertaGarita, err.message, 'error');
        }
    });
});

async function cargarEstadoAforo(token) {
    try {
        const res = await fetch(`${API_URL}/admin/aforo`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Error al cargar estado del aforo.');

        const cap = data.capacidadMensual || 70;
        const ocupados = data.ocupadosActuales || 0;
        const reservados = data.reservasEsperadasHoy || 0;
        const bloqueados = data.bloqueadosHoy || 0;
        const disponibles = data.disponiblesHoy ?? Math.max(0, cap - ocupados - reservados - bloqueados);

        document.getElementById('kpiCapacidadMensual').innerText = cap;
        document.getElementById('kpiMesVigente').innerText = `Periodo: ${data.mesAnio}`;
        document.getElementById('kpiOcupados').innerText = ocupados;
        document.getElementById('kpiReservasHoy').innerText = reservados;
        document.getElementById('kpiBloqueadosHoy').innerText = bloqueados;
        document.getElementById('kpiMotivoBloqueo').innerText = data.motivoBloqueoHoy || 'Sin bloqueos hoy';
        document.getElementById('kpiDisponiblesHoy').innerText = disponibles;
        document.getElementById('kpiEstudiantesAptos').innerText = data.totalEstudiantesAptos ?? 0;

        const inputMes = document.getElementById('inputMesAforo');
        const inputCap = document.getElementById('inputCapacidadMensual');
        if (inputMes && !inputMes.value) inputMes.value = data.mesAnio;
        if (inputCap) inputCap.value = cap;

        const pctOcupados = Math.min(100, (ocupados / cap) * 100);
        const pctReservados = Math.min(100 - pctOcupados, (reservados / cap) * 100);
        const pctBloqueados = Math.min(100 - pctOcupados - pctReservados, (bloqueados / cap) * 100);
        const pctDisponibles = Math.max(0, 100 - pctOcupados - pctReservados - pctBloqueados);

        document.getElementById('barOcupados').style.width = `${pctOcupados}%`;
        document.getElementById('barReservados').style.width = `${pctReservados}%`;
        document.getElementById('barBloqueados').style.width = `${pctBloqueados}%`;
        document.getElementById('barDisponibles').style.width = `${pctDisponibles}%`;

        document.getElementById('legOcupados').innerText = ocupados;
        document.getElementById('legReservados').innerText = reservados;
        document.getElementById('legBloqueados').innerText = bloqueados;
        document.getElementById('legDisponibles').innerText = disponibles;

        const comprometido = Math.round(((ocupados + reservados + bloqueados) / cap) * 100);
        document.getElementById('pillPorcentajeUso').innerText = `${comprometido}% comprometido (${ocupados + reservados + bloqueados}/${cap})`;
        document.getElementById('subtituloAforoFecha').innerText = `Fecha operativa: ${data.fecha} — Control por cantidad total sin asignación física.`;
    } catch (err) {
        mostrarAlerta(document.getElementById('alertaAforo'), err.message, 'error');
    }
}

async function cargarOperadoresGarita(token) {
    const tbody = document.getElementById('tbodyGaritas');
    try {
        const res = await fetch(`${API_URL}/admin/garitas`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const operadores = await res.json();

        if (!res.ok) throw new Error(operadores.error || 'Error al cargar operadores.');

        if (operadores.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No hay operadores de Garita registrados.</td></tr>';
            return;
        }

        tbody.innerHTML = operadores.map(op => `
            <tr>
                <td>${op.idUsuario}</td>
                <td><strong>${op.username}</strong></td>
                <td>${op.nombreCompleto}</td>
                <td><span class="card-badge badge-green">${op.activo ? 'Activo' : 'Inactivo'}</span></td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4">${err.message}</td></tr>`;
    }
}