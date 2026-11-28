const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api'
    : 'https://priorityparking-mvp-production.up.railway.app/api';

document.addEventListener('DOMContentLoaded', async () => {
    const token = sessionStorage.getItem('tokenSession');
    const codigoAlumno = sessionStorage.getItem('alumnoLogueado');

    if (!token || !codigoAlumno) {
        window.location.href = 'login.html';
        return;
    }

    const userNameLabel = document.getElementById('userNameLabel');
    if (userNameLabel) {
        userNameLabel.textContent = codigoAlumno;
    }

    let historialCompleto = [];
    let filtroActivo = 'TODOS';

    const tbody = document.getElementById('tablaHistorialBody');
    const botonesFiltro = document.querySelectorAll('.btn-filtro');

    try {
        const res = await fetch(`${API_URL}/reservas/mis-reservas?codigoAlumno=${encodeURIComponent(codigoAlumno)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No se pudo cargar el historial.</td></tr>';
            return;
        }

        const data = await res.json();
        const reservas = Array.isArray(data)
            ? data
            : (Array.isArray(data?.reservas) ? data.reservas : []);

        historialCompleto = reservas.map(r => {
            let tipo = 'Reserva';
            let estadoTexto = 'Confirmada';
            let badgeClass = 'badge-confirmada';
            let descripcion = 'Reserva de cupo por aforo';

            if (r.estado_reserva === 'CANCELADA') {
                tipo = 'Cancelación';
                estadoTexto = 'Cancelada';
                badgeClass = 'badge-cancelada';
                descripcion = 'Cancelada por el estudiante';
            } else if (r.estado_reserva === 'EXPIRADA') {
                tipo = 'Penalidad';
                estadoTexto = 'Expirada';
                badgeClass = 'badge-penalizado';
                descripcion = 'Tolerancia vencida / inasistencia';
            } else if (r.estado_reserva === 'PENDIENTE') {
                tipo = 'Reserva';
                estadoTexto = 'Pendiente';
                badgeClass = 'badge-pendiente';
            } else if (['EN_CURSO', 'COMPLETADA', 'FINALIZADA'].includes(r.estado_reserva)) {
                tipo = 'Reserva';
                estadoTexto = r.estado_reserva;
                badgeClass = 'badge-confirmada';
            }

            const fechaParte = String(r.fecha_reserva || '').split('T')[0];
            const [y, m, d] = fechaParte.split('-');
            const fechaObj = new Date(Number(y), Number(m) - 1, Number(d));
            const fechaStr = isNaN(fechaObj.getTime())
                ? fechaParte
                : fechaObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

            return {
                fecha: fechaStr,
                tipo,
                descripcion,
                estado: estadoTexto,
                badgeClass
            };
        });

        renderizarTabla();
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state" style="color:#dc2626;">Error de conexión con el servidor.</td></tr>';
    }

    botonesFiltro.forEach(btn => {
        btn.addEventListener('click', () => {
            botonesFiltro.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filtroActivo = btn.dataset.filtro;
            renderizarTabla();
        });
    });

    function renderizarTabla() {
        const filtrados = historialCompleto.filter(item => {
            if (filtroActivo === 'TODOS') return true;
            if (filtroActivo === 'RESERVAS') return item.tipo === 'Reserva';
            if (filtroActivo === 'CANCELACIONES') return item.tipo === 'Cancelación';
            if (filtroActivo === 'PENALIDADES') return item.tipo === 'Penalidad';
            return true;
        });

        if (filtrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No hay registros para este filtro.</td></tr>';
            return;
        }

        tbody.innerHTML = filtrados.map(item => `
            <tr>
                <td>${item.fecha}</td>
                <td>${item.tipo}</td>
                <td>${item.descripcion}</td>
                <td><span class="badge-status ${item.badgeClass}">${item.estado}</span></td>
            </tr>
        `).join('');
    }

    const btnLogout = document.getElementById('btnCerrarSesion');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            sessionStorage.clear();
            window.location.href = 'login.html';
        });
    }
});