const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api'
    : 'https://priorityparking-mvp-production.up.railway.app/api';

let streamCamaraQr = null;
let timerLecturaQr = null;

document.addEventListener('DOMContentLoaded', () => {
    const operador = sessionStorage.getItem('operadorLogueado');
    const rol = sessionStorage.getItem('rolUsuario');

    if (!operador || rol !== 'GARITA') {
        alert('Acceso restringido. Solo personal de seguridad autorizado.');
        window.location.href = 'login-garita.html';
        return;
    }

    // Submenú y modal de ajuste de capacidad
    const btnSubmenu = document.getElementById('btnSubmenuCapacidad');
    const menuCapacidad = document.getElementById('menuCapacidadGarita');

    btnSubmenu?.addEventListener('click', (e) => {
        e.stopPropagation();
        const estaAbierto = !menuCapacidad.classList.contains('hidden');
        menuCapacidad.classList.toggle('hidden', estaAbierto);
        btnSubmenu.setAttribute('aria-expanded', String(!estaAbierto));
    });

    document.addEventListener('click', (e) => {
        if (menuCapacidad && !menuCapacidad.classList.contains('hidden') && !e.target.closest('.submenu-container')) {
            menuCapacidad.classList.add('hidden');
            btnSubmenu?.setAttribute('aria-expanded', 'false');
        }
    });

    document.getElementById('btnAbrirModalReducir')?.addEventListener('click', () => {
        cerrarSubmenuCapacidad();
        abrirModalBloqueo();
    });

    document.getElementById('btnLiberarCuposRapido')?.addEventListener('click', async () => {
        cerrarSubmenuCapacidad();
        await liberarCuposBloqueadosHoy();
    });

    document.getElementById('btnCerrarModalBloqueo')?.addEventListener('click', cerrarModalBloqueo);
    document.getElementById('btnCancelarModalBloqueo')?.addEventListener('click', cerrarModalBloqueo);
    document.getElementById('modalBloqueoDia')?.addEventListener('click', (e) => {
        if (e.target.id === 'modalBloqueoDia') cerrarModalBloqueo();
    });

    // Escáner QR con cámara opcional
    document.getElementById('btnToggleCamaraQr')?.addEventListener('click', alternarCamaraQr);
    document.getElementById('btnDetenerCamaraQr')?.addEventListener('click', detenerCamaraQr);

    // Acciones de puerta y monitor
    document.getElementById('btnRegistrarIngreso')?.addEventListener('click', registrarIngreso);
    document.getElementById('btnRegistrarSalidaRapida')?.addEventListener('click', registrarSalidaDesdeInput);
    document.getElementById('btnGuardarBloqueo')?.addEventListener('click', registrarBloqueoDiario);
    document.getElementById('btnRefrescarMonitor')?.addEventListener('click', refrescarTodoGarita);
    document.getElementById('btnCerrarSesion')?.addEventListener('click', () => {
        detenerCamaraQr();
        cerrarSesion();
    });

    refrescarTodoGarita();
});

function extraerCodigoAlumnoDeEntrada(valorRaw) {
    const limpio = String(valorRaw || '').trim();
    if (!limpio) return '';

    try {
        const parsed = JSON.parse(limpio);
        if (parsed && parsed.codigoAlumno) {
            return String(parsed.codigoAlumno).trim().toUpperCase();
        }
    } catch (_) {
        // Si no es JSON, se trata como código directo de alumno
    }

    return limpio.replace(/@utp\.edu\.pe$/i, '').toUpperCase();
}

async function alternarCamaraQr() {
    const box = document.getElementById('lectorQrBox');
    if (box && !box.classList.contains('hidden')) {
        detenerCamaraQr();
        return;
    }

    const estadoEl = document.getElementById('estadoCamaraQr');
    const videoEl = document.getElementById('videoQr');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        mostrarAlerta('Este navegador o contexto no permite abrir la cámara. Ingresa el código del alumno manualmente.', 'error');
        return;
    }

    try {
        streamCamaraQr = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        videoEl.srcObject = streamCamaraQr;
        await videoEl.play();
        box?.classList.remove('hidden');

        if ('BarcodeDetector' in window) {
            const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            estadoEl.textContent = 'Cámara activa: apunta al código QR...';

            timerLecturaQr = setInterval(async () => {
                if (!videoEl || videoEl.readyState < 2) return;
                try {
                    const codigos = await detector.detect(videoEl);
                    if (codigos.length > 0 && codigos[0].rawValue) {
                        const codigoDetectado = extraerCodigoAlumnoDeEntrada(codigos[0].rawValue);
                        if (codigoDetectado) {
                            document.getElementById('codigo_alumno').value = codigoDetectado;
                            detenerCamaraQr();
                            await registrarIngreso();
                        }
                    }
                } catch (_) {
                    // Ignora cuadros sin lectura
                }
            }, 400);
        } else {
            estadoEl.textContent = 'Cámara abierta. Si no detecta QR automáticamente, escribe o pega el código del alumno.';
        }
    } catch (err) {
        detenerCamaraQr();
        mostrarAlerta(`No se pudo activar la cámara: ${err.message}`, 'error');
    }
}

function detenerCamaraQr() {
    if (timerLecturaQr) {
        clearInterval(timerLecturaQr);
        timerLecturaQr = null;
    }
    if (streamCamaraQr) {
        streamCamaraQr.getTracks().forEach(t => t.stop());
        streamCamaraQr = null;
    }
    const videoEl = document.getElementById('videoQr');
    if (videoEl) videoEl.srcObject = null;
    document.getElementById('lectorQrBox')?.classList.add('hidden');
}

function cerrarSubmenuCapacidad() {
    document.getElementById('menuCapacidadGarita')?.classList.add('hidden');
    document.getElementById('btnSubmenuCapacidad')?.setAttribute('aria-expanded', 'false');
}

function abrirModalBloqueo() {
    document.getElementById('modalBloqueoDia')?.classList.remove('hidden');
    document.getElementById('cupos_bloqueados')?.focus();
}

function cerrarModalBloqueo() {
    document.getElementById('modalBloqueoDia')?.classList.add('hidden');
}

function cerrarSesion() {
    sessionStorage.removeItem('operadorLogueado');
    sessionStorage.removeItem('tokenSession');
    sessionStorage.removeItem('rolUsuario');
    window.location.href = 'login-garita.html';
}

function mostrarAlerta(mensaje, tipo) {
    const el = document.getElementById('globalAlert');
    if (!el) return;
    el.textContent = mensaje;
    el.className = `alert ${tipo}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
}

async function refrescarTodoGarita() {
    await Promise.all([cargarAforoGarita(), cargarMonitorOperativo()]);
}

async function cargarAforoGarita() {
    const tokenJWT = sessionStorage.getItem('tokenSession');
    try {
        const res = await fetch(`${API_URL}/admin/aforo`, {
            headers: { 'Authorization': `Bearer ${tokenJWT}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al consultar aforo.');

        const bloqueados = data.bloqueadosHoy ?? 0;
        document.getElementById('garitaCapacidad').textContent = data.capacidadMensual ?? 70;
        document.getElementById('garitaOcupados').textContent = data.ocupadosActuales ?? 0;
        document.getElementById('garitaEsperados').textContent = data.reservasEsperadasHoy ?? 0;
        document.getElementById('garitaBloqueados').textContent = bloqueados;
        document.getElementById('garitaDisponibles').textContent = data.disponiblesHoy ?? 0;

        const badgeHeader = document.getElementById('badgeReduccionHeader');
        if (badgeHeader) {
            badgeHeader.textContent = bloqueados > 0 ? `(-${bloqueados})` : '';
        }

        document.getElementById('cupos_bloqueados').value = bloqueados;
        document.getElementById('motivo_bloqueo').value = data.motivoBloqueoHoy || '';
    } catch (err) {
        mostrarAlerta(err.message, 'error');
    }
}

async function enviarBloqueoDiario(cuposBloqueados, motivo) {
    const tokenJWT = sessionStorage.getItem('tokenSession');
    const res = await fetch(`${API_URL}/garita/bloqueo-diario`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenJWT}`
        },
        body: JSON.stringify({ cuposBloqueados, motivo })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo actualizar la capacidad del día.');
    return data;
}

async function registrarBloqueoDiario() {
    const cuposBloqueados = parseInt(document.getElementById('cupos_bloqueados').value, 10);
    const motivo = document.getElementById('motivo_bloqueo').value.trim();

    if (isNaN(cuposBloqueados) || cuposBloqueados < 0) {
        mostrarAlerta('Ingrese una cantidad válida de cupos (0 o más).', 'error');
        return;
    }

    try {
        const data = await enviarBloqueoDiario(cuposBloqueados, motivo);
        cerrarModalBloqueo();
        mostrarAlerta(data.mensaje || 'Capacidad del día actualizada.', 'success');
        await refrescarTodoGarita();
    } catch (err) {
        mostrarAlerta(err.message, 'error');
    }
}

async function liberarCuposBloqueadosHoy() {
    try {
        await enviarBloqueoDiario(0, '');
        document.getElementById('cupos_bloqueados').value = 0;
        document.getElementById('motivo_bloqueo').value = '';
        mostrarAlerta('Cupos bloqueados liberados. El aforo disponible volvió a su capacidad normal.', 'success');
        await refrescarTodoGarita();
    } catch (err) {
        mostrarAlerta(err.message, 'error');
    }
}

async function cargarMonitorOperativo() {
    const container = document.getElementById('monitorLista');
    container.innerHTML = '<p style="text-align:center;color:#a0aec0;">Consultando movimiento del día...</p>';
    const tokenJWT = sessionStorage.getItem('tokenSession');

    try {
        const res = await fetch(`${API_URL}/garita/espacios`, {
            headers: { 'Authorization': `Bearer ${tokenJWT}` }
        });

        if (res.status === 401 || res.status === 403) {
            throw new Error('No autorizado. Inicie sesión desde el portal de garita.');
        }

        const lista = await res.json();
        container.innerHTML = '';

        if (!lista.length) {
            container.innerHTML = '<p style="text-align:center;color:#a0aec0;">No hay vehículos en planta ni reservas pendientes para hoy.</p>';
            return;
        }

        lista.forEach(item => {
            const enPlanta = item.estado_reserva === 'EN_CURSO' || item.estado_reserva === 'COMPLETADA';
            const vencida = !enPlanta && Boolean(item.tolerancia_vencida);

            const row = document.createElement('div');
            row.className = `fila-reserva ${enPlanta ? 'en-planta' : (vencida ? 'tolerancia-vencida' : 'pendiente')}`;

            const info = document.createElement('div');
            const titulo = document.createElement('strong');
            titulo.textContent = `${item.codigo_alumno}${item.nombre_completo ? ' — ' + item.nombre_completo : ''}`;

            const sub = document.createElement('div');
            sub.style.fontSize = '13px';
            sub.style.color = vencida ? '#feb2b2' : '#a0aec0';
            const hora = item.hora_llegada_programada ? String(item.hora_llegada_programada).slice(0, 5) : '--:--';
            sub.textContent = vencida
                ? `Hora programada: ${hora} · Tolerancia de 20 min vencida (+${item.minutos_excedidos || 0} min)`
                : `Hora programada: ${hora}`;

            info.append(titulo, sub);

            const acciones = document.createElement('div');
            acciones.style.display = 'flex';
            acciones.style.alignItems = 'center';
            acciones.style.gap = '10px';
            acciones.style.flexWrap = 'wrap';

            const badge = document.createElement('span');
            if (enPlanta) {
                badge.className = 'badge-estado badge-dentro';
                badge.textContent = 'EN PLANTA';
            } else if (vencida) {
                badge.className = 'badge-estado badge-vencida';
                badge.textContent = 'TOLERANCIA VENCIDA';
            } else {
                badge.className = 'badge-estado badge-pendiente';
                badge.textContent = 'ESPERANDO INGRESO';
            }
            acciones.appendChild(badge);

            if (enPlanta) {
                const btnSalida = document.createElement('button');
                btnSalida.type = 'button';
                btnSalida.className = 'btn-logout btn-sm';
                btnSalida.textContent = 'Registrar Salida (-1)';
                btnSalida.addEventListener('click', () => registrarSalida(item.codigo_alumno));
                acciones.appendChild(btnSalida);
            } else if (vencida && item.id_reserva) {
                const btnPenalizar = document.createElement('button');
                btnPenalizar.type = 'button';
                btnPenalizar.className = 'btn-penalizar btn-sm';
                btnPenalizar.textContent = '⚠️ Penalizar No-Show';
                btnPenalizar.addEventListener('click', () => penalizarReserva(item.id_reserva, item.codigo_alumno));
                acciones.appendChild(btnPenalizar);
            }

            row.append(info, acciones);
            container.appendChild(row);
        });
    } catch (err) {
        container.innerHTML = `<p style="text-align:center;color:#f56565;">${err.message}</p>`;
    }
}

async function penalizarReserva(idReserva, codigoAlumno) {
    if (!confirm(`¿Registrar penalización por inasistencia / tolerancia vencida al estudiante ${codigoAlumno}?`)) return;
    const tokenJWT = sessionStorage.getItem('tokenSession');

    try {
        const res = await fetch(`${API_URL}/garita/penalizar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenJWT}`
            },
            body: JSON.stringify({
                id_reserva: idReserva,
                motivo: 'Inasistencia: excedió los 20 minutos de tolerancia en garita.'
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo registrar la penalización.');

        mostrarAlerta(data.mensaje || `Penalización aplicada a ${codigoAlumno}.`, 'success');
        await refrescarTodoGarita();
    } catch (err) {
        mostrarAlerta(err.message, 'error');
    }
}

async function registrarIngreso() {
    const codigoInput = document.getElementById('codigo_alumno');
    const codigo_alumno = extraerCodigoAlumnoDeEntrada(codigoInput.value);
    const tokenJWT = sessionStorage.getItem('tokenSession');

    if (!codigo_alumno) {
        mostrarAlerta('Ingrese el código de alumno o escanee el QR.', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/garita/registrar-ingreso`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenJWT}`
            },
            body: JSON.stringify({ codigo_alumno })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'No se pudo procesar el ingreso.');

        mostrarAlerta(data.mensaje, 'success');
        codigoInput.value = '';
        await refrescarTodoGarita();
    } catch (err) {
        mostrarAlerta(err.message, 'error');
    }
}

async function registrarSalidaDesdeInput() {
    const codigoInput = document.getElementById('codigo_alumno');
    const codigo_alumno = extraerCodigoAlumnoDeEntrada(codigoInput.value);

    if (!codigo_alumno) {
        mostrarAlerta('Ingrese el código de alumno para registrar su salida.', 'error');
        return;
    }

    await registrarSalida(codigo_alumno, false);
    codigoInput.value = '';
}

async function registrarSalida(codigoAlumno, pedirConfirmacion = true) {
    if (pedirConfirmacion && !confirm(`¿Confirmas la salida del vehículo del estudiante ${codigoAlumno}?`)) return;
    const tokenJWT = sessionStorage.getItem('tokenSession');

    try {
        const res = await fetch(`${API_URL}/garita/registrar-salida`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenJWT}`
            },
            body: JSON.stringify({ codigo_alumno: codigoAlumno })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'No se pudo procesar la salida.');

        mostrarAlerta(data.mensaje, 'success');
        await refrescarTodoGarita();
    } catch (err) {
        mostrarAlerta(err.message, 'error');
    }
}