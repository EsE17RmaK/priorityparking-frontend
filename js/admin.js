// js/admin.js
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : 'https://TU-BACKEND-EN-RAILWAY.up.railway.app/api'; // Reemplaza con tu URL real de Railway

function decodificarJwt(token) {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch {
        return null;
    }
}

function mostrarAlerta(elemento, mensaje, tipo) {
    elemento.innerText = mensaje;
    elemento.className = `alert ${tipo}`;
    elemento.classList.remove('hidden');
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

    // Navegación simple entre pestañas del sidebar
    document.querySelectorAll('.nav-item').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            link.classList.add('active');

            const targetId = link.getAttribute('data-tab');
            document.querySelectorAll('.admin-section').forEach(sec => sec.classList.add('hidden'));
            document.getElementById(targetId).classList.remove('hidden');
        });
    });

    // Cargar lista inicial de operadores
    cargarOperadoresGarita(token);

    // 1. Subida masiva CSV
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
        } catch (err) {
            mostrarAlerta(alertaCsv, err.message, 'error');
        }
    });

    // 2. Crear operador de Garita
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