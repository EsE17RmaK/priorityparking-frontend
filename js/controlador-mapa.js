const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api'
    : 'https://priorityparking-mvp-production.up.railway.app/api';

let estudianteLogueado = {
    codigo: localStorage.getItem('codigo_alumno') || sessionStorage.getItem('codigo_alumno') || null,
    autenticado: !!(localStorage.getItem('token_parking') || sessionStorage.getItem('token_parking'))
};

async function solicitarAccesoParking(event) {
    if (event) event.preventDefault();
    
    const inputCorreo = document.getElementById('correoEstudiante')?.value;
    const zonaMensajes = document.getElementById('zonaMensajesError');

    if (!inputCorreo) {
        if (zonaMensajes) {
            zonaMensajes.style.color = '#e74c3c';
            zonaMensajes.innerText = 'Por favor ingresa tu correo institucional.';
        }
        return;
    }

    try {
        const respuesta = await fetch(`${API_URL}/auth/solicitar-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo: inputCorreo })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            if (zonaMensajes) {
                zonaMensajes.style.color = '#e74c3c';
                zonaMensajes.innerText = datos.error || 'Error al solicitar código OTP.';
            }
            return;
        }

        if (zonaMensajes) {
            zonaMensajes.style.color = '#2ecc71';
            zonaMensajes.innerText = datos.mensaje || 'Código OTP enviado con éxito.';
        }
        
        estudianteLogueado.codigo = datos.codigoAlumno;
        localStorage.setItem('codigo_alumno', datos.codigoAlumno);

        const seccionOtp = document.getElementById('seccionIngresoOtp');
        if (seccionOtp) seccionOtp.style.display = 'block';

    } catch (error) {
        console.error('Error en Frontend:', error);
        if (zonaMensajes) {
            zonaMensajes.style.color = '#e74c3c';
            zonaMensajes.innerText = 'Error al conectar con el servidor de la UTP.';
        }
    }
}

async function verificarCodigoOtp(event) {
    if (event) event.preventDefault();
    
    const tokenDigitado = document.getElementById('campoOtp')?.value;
    const zonaMensajes = document.getElementById('zonaMensajesError');

    try {
        const respuesta = await fetch(`${API_URL}/auth/verificar-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                codigo_alumno: estudianteLogueado.codigo, 
                codigo_otp: tokenDigitado 
            })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            if (zonaMensajes) {
                zonaMensajes.style.color = '#e74c3c';
                zonaMensajes.innerText = datos.error || 'Código OTP inválido.';
            }
            return;
        }

        estudianteLogueado.autenticado = true;
        localStorage.setItem('token_parking', datos.token);
        localStorage.setItem('codigo_otp', tokenDigitado);

        if (zonaMensajes) {
            zonaMensajes.style.color = '#2ecc71';
            zonaMensajes.innerText = datos.mensaje || 'Acceso verificado correctamente.';
        }

        renderizarMapaEstacionamientos();

    } catch (error) {
        console.error('Error en verificación OTP:', error);
        if (zonaMensajes) {
            zonaMensajes.style.color = '#e74c3c';
            zonaMensajes.innerText = 'Fallo en la verificación del token.';
        }
    }
}

async function renderizarMapaEstacionamientos() {
    const gridContenedor = document.getElementById('gridMapa');
    const token = localStorage.getItem('token_parking');

    try {
        const respuesta = await fetch(`${API_URL}/garita/espacios`, {
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });
        
        if (!respuesta.ok) {
            throw new Error('Error al consultar espacios');
        }

        const espacios = await respuesta.json();

        if (!gridContenedor) return;
        gridContenedor.innerHTML = ''; 

        espacios.forEach(slot => {
            const cuadroHtml = document.createElement('div');
            cuadroHtml.className = `espacio ${slot.estado}`;
            cuadroHtml.innerHTML = `<strong>${slot.id_espacio}</strong><br><small>${slot.estado}</small>`;
            
            if (slot.estado === 'DISPONIBLE') {
                cuadroHtml.style.cursor = 'pointer';
                cuadroHtml.onclick = () => confirmarReservaEspacio(slot.id_espacio);
            }

            gridContenedor.appendChild(cuadroHtml);
        });
    } catch (error) {
        console.error('Error al cargar espacios:', error);
        if (gridContenedor) {
            gridContenedor.innerHTML = '<p style="color: red;">Error de conexión al cargar la cochera.</p>';
        }
    }
}

async function confirmarReservaEspacio(idEspacioSeleccionado) {
    const token = localStorage.getItem('token_parking');
    const codigoAlumno = estudianteLogueado.codigo || localStorage.getItem('codigo_alumno') || 'U20304050';
    const codigoOtp = localStorage.getItem('codigo_otp') || '123456';

    const inputFecha = document.getElementById('fecha-reserva') || document.querySelector('input[type="date"]');
    const inputHora = document.getElementById('hora-llegada') || document.querySelector('input[type="time"]');

    const fechaReserva = inputFecha?.value || new Date().toISOString().split('T')[0];
    const horaLlegada = inputHora?.value ? (inputHora.value.length === 5 ? `${inputHora.value}:00` : inputHora.value) : '08:30:00';

    const payload = {
        codigo_alumno: codigoAlumno,
        id_espacio: idEspacioSeleccionado,
        otp_verificado: codigoOtp,
        fecha_reserva: fechaReserva,
        hora_llegada: horaLlegada
    };

    try {
        const respuesta = await fetch(`${API_URL}/reservas/crear`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify(payload)
        });

        const data = await respuesta.json();

        if (respuesta.ok && data.qrCode) {
            const imgElement = document.getElementById('qr-reserva-img');
            if (imgElement) imgElement.src = data.qrCode;

            const txtPlaza = document.getElementById('qr-plaza-id');
            const txtFecha = document.getElementById('qr-fecha');
            if (txtPlaza) txtPlaza.textContent = idEspacioSeleccionado;
            if (txtFecha) txtFecha.textContent = fechaReserva;

            const modal = document.getElementById('modal-confirmacion-qr');
            if (modal) modal.style.display = 'flex';

            renderizarMapaEstacionamientos();
        } else {
            alert(`Error al reservar: ${data.error || data.mensaje || 'No se pudo completar la operación'}`);
        }
    } catch (error) {
        console.error('Error de red al registrar reserva:', error);
        alert('Ocurrió un error al procesar la reserva. Intente nuevamente.');
    }
}

document.getElementById('btn-cerrar-qr')?.addEventListener('click', () => {
    const modal = document.getElementById('modal-confirmacion-qr');
    if (modal) modal.style.display = 'none';
});

document.addEventListener('DOMContentLoaded', () => {
    renderizarMapaEstacionamientos();
});