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

    const penalidadesNumEl = document.querySelector('.penalidades-num');
    const linkVerDetalle = document.getElementById('linkVerDetalle');

    try {
        const res = await fetch(`${API_URL}/reservas/mis-reservas?codigoAlumno=${encodeURIComponent(codigoAlumno)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            const totalPenalizaciones = Number(data?.totalPenalizaciones ?? 0);

            if (penalidadesNumEl) {
                penalidadesNumEl.textContent = String(totalPenalizaciones);
            }

            if (linkVerDetalle) {
                linkVerDetalle.setAttribute('href', 'historial.html');
                linkVerDetalle.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.location.href = 'historial.html';
                });
            }
        }
    } catch (err) {
        console.error('No se pudo consultar el detalle de penalidades:', err);
    }

    const btnLogout = document.getElementById('btnCerrarSesion');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            sessionStorage.clear();
            window.location.href = 'login.html';
        });
    }
});