const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api'
    : 'https://priorityparking-mvp-production.up.railway.app/api';

document.addEventListener('DOMContentLoaded', async () => {
    const token = sessionStorage.getItem('tokenSession');
    const codigoAlumno = sessionStorage.getItem('alumnoLogueado');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    if (codigoAlumno) {
        document.getElementById('userNameLabel').textContent = codigoAlumno;
        document.getElementById('nombreCorto').textContent = codigoAlumno;
        const avatar = document.getElementById('avatarUsuario');
        if (avatar) avatar.textContent = codigoAlumno.slice(0, 2).toUpperCase();
    }

    await Promise.all([
        cargarDisponibilidadHoy(token),
        cargarProximaReservaYPenalizacion(token, codigoAlumno)
    ]);

    document.getElementById('btnHistorial')?.addEventListener('click', () => {
        window.location.href = 'historial.html';
    });

    document.getElementById('btnCerrarSesion').addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = 'login.html';
    });
});

async function cargarDisponibilidadHoy(token) {
    try {
        const res = await fetch(`${API_URL}/admin/aforo`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;

        const data = await res.json();
        const cap = data.capacidadMensual ?? 70;
        const usados = (data.ocupadosActuales ?? 0) + (data.reservasEsperadasHoy ?? 0) + (data.bloqueadosHoy ?? 0);
        const disponibles = data.disponiblesHoy ?? Math.max(0, cap - usados);

        document.getElementById('metricEspacios').textContent = disponibles;
    } catch (err) {
        console.error('No se pudo cargar la disponibilidad:', err);
    }
}

async function cargarProximaReservaYPenalizacion(token, codigoAlumno) {
    if (!codigoAlumno) return;

    try {
        const res = await fetch(`${API_URL}/reservas/mis-reservas?codigoAlumno=${encodeURIComponent(codigoAlumno)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;

        const payload = await res.json();
        const reservas = Array.isArray(payload) ? payload : (payload.reservas || []);
        const penalizacion = Array.isArray(payload) ? null : payload.penalizacionActiva;
        const totalPenalizaciones = Array.isArray(payload) ? 0 : (payload.totalPenalizaciones ?? 0);

        const activa = reservas.find(r => ['PENDIENTE', 'EN_CURSO'].includes(r.estado_reserva));
        if (activa) {
            const fecha = String(activa.fecha_reserva).slice(0, 10);
            const hora = String(activa.hora_llegada_programada).slice(0, 5);
            document.getElementById('lblProximaReserva').textContent = `${fecha} · ${hora}`;
            document.getElementById('lblEstadoReserva').textContent = activa.estado_reserva;
        }

        if (penalizacion) {
            mostrarAvisoPenalizacion(penalizacion, totalPenalizaciones);
        }
    } catch (err) {
        console.error('No se pudo cargar la información del alumno:', err);
    }
}

function mostrarAvisoPenalizacion(penalizacion, totalPenalizaciones = 1) {
    const banner = document.getElementById('alertaPenalizacion');
    const detalle = document.getElementById('detallePenalizacion');
    const estadoEl = document.getElementById('lblEstadoReserva');
    if (!banner || !detalle) return;

    const fechaHasta = penalizacion.fechaFin
        ? new Date(penalizacion.fechaFin).toLocaleString('es-PE')
        : 'tiempo vigente';
    const motivo = penalizacion.motivo || 'Inasistencia / penalización registrada por Garita.';
    const duracionTexto = penalizacion.duracionDias
        ? `Duración: ${penalizacion.duracionDias} día(s) (${penalizacion.diasRestantes ?? 1} día(s) restantes, hasta el ${fechaHasta})`
        : `Vigente hasta el ${fechaHasta}`;

    detalle.textContent = `Motivo: "${motivo}". ${duracionTexto}. Penalizaciones acumuladas: ${totalPenalizaciones} (restan puntos en tu cálculo de prioridad).`;
    banner.classList.remove('hidden');

    if (estadoEl) {
        estadoEl.textContent = 'Penalizado';
        estadoEl.className = 'card-status status-red';
    }
}