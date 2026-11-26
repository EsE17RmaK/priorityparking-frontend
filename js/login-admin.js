// js/login-admin.js
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : 'https://TU-BACKEND-EN-RAILWAY.up.railway.app/api'; // Reemplaza con tu URL real de Railway

document.getElementById('formAdminLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuario = document.getElementById('adminUsuario').value.trim();
    const password = document.getElementById('adminPassword').value.trim();
    const alertBox = document.getElementById('alertBox');

    if (!usuario || !password) {
        alertBox.innerText = 'Por favor, ingrese todas las credenciales.';
        alertBox.className = 'alert error';
        alertBox.classList.remove('hidden');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/verificar-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codigoAlumno: usuario, otp: password })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Credenciales administrativas inválidas.');

        if (data.rol !== 'ADMIN') {
            throw new Error('Acceso denegado: esta cuenta no tiene permisos de Administrador.');
        }

        sessionStorage.setItem('operadorLogueado', usuario);
        sessionStorage.setItem('tokenSession', data.token);
        sessionStorage.setItem('rolUsuario', data.rol);

        alertBox.innerText = 'Autenticación exitosa. Redirigiendo al panel...';
        alertBox.className = 'alert success';
        alertBox.classList.remove('hidden');

        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 1000);

    } catch (err) {
        alertBox.innerText = err.message;
        alertBox.className = 'alert error';
        alertBox.classList.remove('hidden');
    }
});