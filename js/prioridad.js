document.addEventListener('DOMContentLoaded', () => {
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

    const linkVerDetalle = document.getElementById('linkVerDetalle');
    if (linkVerDetalle) {
        linkVerDetalle.addEventListener('click', (e) => {
            e.preventDefault();
            alert("No registras penalizaciones activas por tolerancia en garita.");
        });
    }

    const btnLogout = document.getElementById('btnCerrarSesion');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            sessionStorage.clear();
            window.location.href = 'login.html';
        });
    }
});