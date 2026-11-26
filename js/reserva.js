const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : 'https://priorityparking-backend-production.up.railway.app/api';

let codigoAlumno = '';

document.addEventListener('DOMContentLoaded', () => {
    codigoAlumno = sessionStorage.getItem('alumnoLogueado');
    if (!codigoAlumno) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('displayCodigo').innerText = codigoAlumno;

    document.getElementById('btnLogout').addEventListener('click', cerrarSesion);
    document.getElementById('btnConfirmarCupo').addEventListener('click', solicitarReservaCupo);
    document.getElementById('btnAbrirModalCancelar').addEventListener('click', abrirModalCancelar);

    document.getElementById('btn-cerrar-qr').addEventListener('click', () => {
        document.getElementById('modal-confirmacion-qr').style.display = 'none';
        cargarDisponibilidadAforo();
    });

    document.getElementById('btn-volver-modal').addEventListener('click', () => {
        document.getElementById('modal-cancelar-reserva').style.display = 'none';
    });

    document.getElementById('btn-confirmar-cancelacion').addEventListener('click', ejecutarCancelacionConfirmada);

    configurarCamposFechaHora();
    cargarDisponibilidadAforo();
});

function configurarCamposFechaHora() {
    const inputFecha = document.getElementById('fechaLlegada');
    const selectHora = document.getElementById('horaLlegada');

    const hoy = new Date();
    const formatoHoy = hoy.toLocaleDateString('sv-SE');

    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const formatoManana = manana.toLocaleDateString('sv-SE');

    inputFecha.value = formatoHoy;
    inputFecha.min = formatoHoy;
    inputFecha.max = formatoManana;

    // Seleccionar la siguiente hora en punto por defecto dentro del rango 07:00 - 21:00
    const siguienteHora = Math.min(21, Math.max(7, hoy.getHours() + 1));
    selectHora.value = `${String(siguienteHora).padStart(2, '0')}:00`;
}

function cerrarSesion() {
    sessionStorage.removeItem('alumnoLogueado');
    sessionStorage.removeItem('tokenSession');
    sessionStorage.removeItem('rolUsuario');
    window.location.href = 'login.html';
}

function mostrarNotificacion(texto, tipo) {
    const box = document.getElementById('panelAlert');
    box.innerText = texto;
    box.className = `alert ${tipo}`;
    box.classList.remove('hidden');
    setTimeout(() => box.classList.add('hidden'), 5000);
}

async function cargarDisponibilidadAforo() {
    const tokenJWT = sessionStorage.getItem('tokenSession');
    const btnReservar = document.getElementById('btnConfirmarCupo');

    try {
        const res = await fetch(`${API_URL}/admin/aforo`, {
            headers: { 'Authorization': `Bearer ${tokenJWT}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo consultar la disponibilidad.');

        const cap = data.capacidadMensual ?? 70;
        const usados = (data.ocupadosActuales ?? 0) + (data.reservasEsperadasHoy ?? 0) + (data.bloqueadosHoy ?? 0);
        const libres = data.disponiblesHoy ?? Math.max(0, cap - usados);

        document.getElementById('resUsados').textContent = usados;
        document.getElementById('resDisponibles').textContent = libres;

        if (libres <= 0) {
            btnReservar.disabled = true;
            btnReservar.textContent = '🚫 Sin Disponibilidad';
        } else {
            btnReservar.disabled = false;
            btnReservar.textContent = '✅ Reservar Cupo';
        }
    } catch (err) {
        mostrarNotificacion(err.message, 'error');
    }
}

async function solicitarReservaCupo() {
    const fechaElegida = document.getElementById('fechaLlegada').value;
    const horaElegida = document.getElementById('horaLlegada').value;
    const tokenJWT = sessionStorage.getItem('tokenSession');

    if (!fechaElegida || !horaElegida) {
        return mostrarNotificacion('Selecciona la fecha y hora de llegada.', 'error');
    }

    try {
        const res = await fetch(`${API_URL}/reservas/crear`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenJWT}`
            },
            body: JSON.stringify({
                codigo_alumno: codigoAlumno,
                otp_verificado: '000000',
                fecha_reserva: fechaElegida,
                hora_llegada: horaElegida
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo procesar tu reserva.');

        if (data.qrCode) {
            document.getElementById('qr-reserva-img').src = data.qrCode;
            document.getElementById('qr-plaza-id').textContent = 'Sede Lima Centro';
            document.getElementById('qr-fecha').textContent = `${fechaElegida} a las ${horaElegida}`;
            document.getElementById('modal-confirmacion-qr').style.display = 'flex';
        }

        mostrarNotificacion(data.mensaje, 'success');
        await cargarDisponibilidadAforo();
    } catch (err) {
        mostrarNotificacion(err.message, 'error');
    }
}

async function abrirModalCancelar() {
    const fechaElegida = document.getElementById('fechaLlegada').value;
    const tokenJWT = sessionStorage.getItem('tokenSession');

    if (!fechaElegida) {
        return mostrarNotificacion('Selecciona una fecha primero.', 'error');
    }

    try {
        const res = await fetch(`${API_URL}/reservas/mis-reservas?codigoAlumno=${encodeURIComponent(codigoAlumno)}`, {
            headers: { 'Authorization': `Bearer ${tokenJWT}` }
        });
        const reservas = await res.json();
        if (!res.ok) throw new Error(reservas.error || 'No se pudo consultar tus reservas.');

        const reservaActiva = reservas.find(r => {
            const fechaItem = String(r.fecha_reserva).slice(0, 10);
            return fechaItem === fechaElegida && r.estado_reserva === 'PENDIENTE';
        });

        if (!reservaActiva) {
            return mostrarNotificacion(`No tienes ninguna reserva pendiente para el ${fechaElegida}.`, 'error');
        }

        const horaFormateada = String(reservaActiva.hora_llegada_programada).slice(0, 5);
        document.getElementById('cancel-codigo').textContent = reservaActiva.codigo_alumno;
        document.getElementById('cancel-fecha').textContent = fechaElegida;
        document.getElementById('cancel-hora').textContent = `${horaFormateada} hrs`;
        document.getElementById('cancel-estado').textContent = reservaActiva.estado_reserva;

        document.getElementById('modal-cancelar-reserva').style.display = 'flex';
    } catch (err) {
        mostrarNotificacion(err.message, 'error');
    }
}

async function ejecutarCancelacionConfirmada() {
    const fechaElegida = document.getElementById('fechaLlegada').value;
    const tokenJWT = sessionStorage.getItem('tokenSession');

    try {
        const res = await fetch(`${API_URL}/reservas/cancelar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenJWT}`
            },
            body: JSON.stringify({
                codigo_alumno: codigoAlumno,
                fecha_reserva: fechaElegida
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo cancelar la reserva.');

        document.getElementById('modal-cancelar-reserva').style.display = 'none';
        mostrarNotificacion(data.mensaje, 'success');
        await cargarDisponibilidadAforo();
    } catch (err) {
        document.getElementById('modal-cancelar-reserva').style.display = 'none';
        mostrarNotificacion(err.message, 'error');
    }
}