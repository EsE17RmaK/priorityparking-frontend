const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : 'postgresql://postgres:NcWkIBCnbNIjjZjqzOHMkTlCYavqccWd@altaria.proxy.rlwy.net:45383/railway';

document.addEventListener('DOMContentLoaded', () => {
    const operador = sessionStorage.getItem('operadorLogueado');
    const rol = sessionStorage.getItem('rolUsuario');

    if (!operador || rol !== 'GARITA') {
        alert('Acceso restringido. Solo personal de seguridad autorizado.');
        window.location.href = 'login-garita.html';
        return;
    }

    document.getElementById('btnRegistrarIngreso').addEventListener('click', registrarIngreso);
    document.getElementById('btnGuardarBloqueo').addEventListener('click', registrarBloqueoDiario);
    document.getElementById('btnRefrescarMonitor').addEventListener('click', refrescarTodoGarita);

    const btnLogout = document.getElementById('btnCerrarSesion');
    if (btnLogout) btnLogout.addEventListener('click', cerrarSesion);

    refrescarTodoGarita();
});

function cerrarSesion() {
    sessionStorage.removeItem('operadorLogueado');
    sessionStorage.removeItem('tokenSession');
    sessionStorage.removeItem('rolUsuario');
    window.location.href = 'login-garita.html';
}

function mostrarAlerta(mensaje, tipo) {
    const el = document.getElementById('globalAlert');
    el.innerText = mensaje;
    el.className = `alert ${tipo}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
}

async function refrescarTodoGarita() {
    await Promise.all([cargarAforoGarita(), cargarMonitorOperativo()]);
}

async function cargarAforoGarita() {
    const tokenJWT = sessionStorage.getItem('tokenSession');
    try {
        const res = await fetch(`${API_URL}/admin/aforo`, {
            headers: { 'Authorization': `Bearer ${tokenJWT}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al consultar aforo.');

        document.getElementById('garitaCapacidad').textContent = data.capacidadMensual ?? 70;
        document.getElementById('garitaOcupados').textContent = data.ocupadosActuales ?? 0;
        document.getElementById('garitaEsperados').textContent = data.reservasEsperadasHoy ?? 0;
        document.getElementById('garitaBloqueados').textContent = data.bloqueadosHoy ?? 0;
        document.getElementById('garitaDisponibles').textContent = data.disponiblesHoy ?? 0;

        document.getElementById('cupos_bloqueados').value = data.bloqueadosHoy ?? 0;
        if (data.motivoBloqueoHoy) {
            document.getElementById('motivo_bloqueo').value = data.motivoBloqueoHoy;
        }
    } catch (err) {
        mostrarAlerta(err.message, 'error');
    }
}

async function registrarBloqueoDiario() {
    const tokenJWT = sessionStorage.getItem('tokenSession');
    const cuposBloqueados = parseInt(document.getElementById('cupos_bloqueados').value, 10);
    const motivo = document.getElementById('motivo_bloqueo').value.trim();

    if (isNaN(cuposBloqueados) || cuposBloqueados < 0) {
        mostrarAlerta('Ingrese una cantidad válida de lugares a bloquear (0 o más).', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/garita/bloqueo-diario`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenJWT}`
            },
            body: JSON.stringify({ cuposBloqueados, motivo })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el bloqueo diario.');

        mostrarAlerta(data.mensaje, 'success');
        await refrescarTodoGarita();
    } catch (err) {
        mostrarAlerta(err.message, 'error');
    }
}

async function cargarMonitorOperativo() {
    const container = document.getElementById('monitorLista');
    container.innerHTML = '<p style="text-align:center;color:#a0aec0;">Consultando movimiento del día...</p>';
    const tokenJWT = sessionStorage.getItem('tokenSession');

    try {
        const res = await fetch(`${API_URL}/garita/espacios`, {
            headers: { 'Authorization': `Bearer ${tokenJWT}` }
        });

        if (res.status === 401 || res.status === 403) {
            throw new Error('No autorizado. Inicie sesión desde el portal de garita.');
        }

        const lista = await res.json();
        container.innerHTML = '';

        if (!lista.length) {
            container.innerHTML = '<p style="text-align:center;color:#a0aec0;">No hay vehículos en planta ni reservas pendientes para hoy.</p>';
            return;
        }

        lista.forEach(item => {
            const enPlanta = item.estado_reserva === 'EN_CURSO' || item.estado_reserva === 'COMPLETADA';
            const row = document.createElement('div');
            row.className = `fila-reserva ${enPlanta ? 'en-planta' : 'pendiente'}`;

            const info = document.createElement('div');
            const titulo = document.createElement('strong');
            titulo.textContent = `${item.codigo_alumno}${item.nombre_completo ? ' — ' + item.nombre_completo : ''}`;

            const sub = document.createElement('div');
            sub.style.fontSize = '13px';
            sub.style.color = '#a0aec0';
            const hora = item.hora_llegada_programada ? String(item.hora_llegada_programada).slice(0, 5) : '--:--';
            sub.textContent = `Hora programada: ${hora}`;

            info.append(titulo, sub);

            const acciones = document.createElement('div');
            acciones.style.display = 'flex';
            acciones.style.alignItems = 'center';
            acciones.style.gap = '10px';

            const badge = document.createElement('span');
            badge.className = `badge-estado ${enPlanta ? 'badge-dentro' : 'badge-pendiente'}`;
            badge.textContent = enPlanta ? 'EN PLANTA' : 'ESPERANDO INGRESO';
            acciones.appendChild(badge);

            if (enPlanta) {
                const btnSalida = document.createElement('button');
                btnSalida.className = 'btn-liberar btn-sm';
                btnSalida.style.marginTop = '0';
                btnSalida.textContent = 'Registrar Salida (-1)';
                btnSalida.addEventListener('click', () => registrarSalida(item.codigo_alumno));
                acciones.appendChild(btnSalida);
            }

            row.append(info, acciones);
            container.appendChild(row);
        });
    } catch (err) {
        container.innerHTML = `<p style="text-align:center;color:#f56565;">${err.message}</p>`;
    }
}

async function registrarIngreso() {
    const codigoInput = document.getElementById('codigo_alumno');
    const codigo_alumno = codigoInput.value.trim().toUpperCase();
    const tokenJWT = sessionStorage.getItem('tokenSession');

    if (!codigo_alumno) {
        mostrarAlerta('Ingrese el código de alumno o escanee el QR.', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/garita/registrar-ingreso`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenJWT}`
            },
            body: JSON.stringify({ codigo_alumno })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'No se pudo procesar el ingreso.');

        mostrarAlerta(data.mensaje, 'success');
        codigoInput.value = '';
        await refrescarTodoGarita();
    } catch (err) {
        mostrarAlerta(err.message, 'error');
    }
}

async function registrarSalida(codigoAlumno) {
    if (!confirm(`¿Confirmas la salida del vehículo del estudiante ${codigoAlumno}?`)) return;
    const tokenJWT = sessionStorage.getItem('tokenSession');

    try {
        const res = await fetch(`${API_URL}/garita/registrar-salida`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenJWT}`
            },
            body: JSON.stringify({ codigo_alumno: codigoAlumno })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'No se pudo procesar la salida.');

        mostrarAlerta(data.mensaje, 'success');
        await refrescarTodoGarita();
    } catch (err) {
        mostrarAlerta(err.message, 'error');
    }
}