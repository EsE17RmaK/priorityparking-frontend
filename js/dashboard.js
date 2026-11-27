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
    }

    try {
        const res = await fetch(`${API_URL}/garita/espacios`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const espacios = await res.json();
            const disponibles = espacios.filter(e => e.estado === 'DISPONIBLE').length;
            document.getElementById('metricEspacios').textContent = disponibles;
        }
    } catch (err) {
        console.error('No se pudo cargar la métrica de espacios:', err);
    }

    document.getElementById('btnHistorial')?.addEventListener('click', () => {
        window.location.href = 'historial.html';
    });

    document.getElementById('btnCerrarSesion').addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = 'login.html';
    });
});