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

    let todasLasReservas = [];
    let vistaActual = 'PROXIMAS';

    const container = document.getElementById('listaReservasContainer');
    const tabProximas = document.getElementById('tabProximas');
    const tabAnteriores = document.getElementById('tabAnteriores');

    try {
        const res = await fetch(`${API_URL}/reservas/mis-reservas?codigoAlumno=${encodeURIComponent(codigoAlumno)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            container.innerHTML = '<p style="text-align:center;color:#64748b;padding:2rem;">No se pudieron cargar las reservas.</p>';
            return;
        }

        const data = await res.json();
        todasLasReservas = Array.isArray(data)
            ? data
            : (Array.isArray(data?.reservas) ? data.reservas : []);

        renderizar();
    } catch (e) {
        container.innerHTML = '<p style="text-align:center;color:#dc2626;padding:2rem;">Error al comunicarse con el servidor.</p>';
    }

    tabProximas?.addEventListener('click', () => {
        tabProximas.classList.add('active');
        tabAnteriores?.classList.remove('active');
        vistaActual = 'PROXIMAS';
        renderizar();
    });

    tabAnteriores?.addEventListener('click', () => {
        tabAnteriores.classList.add('active');
        tabProximas?.classList.remove('active');
        vistaActual = 'ANTERIORES';
        renderizar();
    });

    function renderizar() {
        const hoyLima = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

        const filtradas = todasLasReservas.filter(r => {
            const fRes = String(r.fecha_reserva || '').split('T')[0];
            return vistaActual === 'PROXIMAS' ? fRes >= hoyLima : fRes < hoyLima;
        });

        if (filtradas.length === 0) {
            container.innerHTML = `<p style="text-align:center;color:#64748b;padding:2rem;">No tienes reservas ${vistaActual.toLowerCase()}.</p>`;
            return;
        }

        container.innerHTML = filtradas.map(r => {
            const fecha = String(r.fecha_reserva || '').split('T')[0];
            const hora = String(r.hora_llegada_programada || '').substring(0, 5);
            const estado = r.estado_reserva || 'PENDIENTE';

            let badgeClass = 'badge-pendiente';
            if (estado === 'COMPLETADA' || estado === 'EN_CURSO' || estado === 'FINALIZADA') {
                badgeClass = 'badge-confirmada';
            } else if (estado === 'EXPIRADA' || estado === 'CANCELADA') {
                badgeClass = 'badge-expirada';
            }

            return `
                <div class="reserva-item">
                    <div>
                        <strong>${fecha} · ${hora} · Aforo General</strong><br>
                        <span class="badge-estado ${badgeClass}">${estado}</span>
                    </div>
                    <div>
                        ${estado === 'PENDIENTE' ? `<button type="button" class="btn-cancel" onclick="cancelarReserva('${fecha}')">Cancelar</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    window.cancelarReserva = async (fecha) => {
        if (!confirm(`¿Deseas cancelar la reserva del ${fecha}?`)) return;

        try {
            const res = await fetch(`${API_URL}/reservas/cancelar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    codigo_alumno: codigoAlumno,
                    fecha_reserva: fecha
                })
            });

            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                alert(data.mensaje || 'Reserva cancelada con éxito.');
                location.reload();
            } else {
                alert(data.error || 'No se pudo cancelar la reserva.');
            }
        } catch (error) {
            alert('Error de comunicación con el servidor.');
        }
    };

    const btnLogout = document.getElementById('btnCerrarSesion');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            sessionStorage.clear();
            window.location.href = 'login.html';
        });
    }
});