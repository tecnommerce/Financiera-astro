/**
 * Financiera Astro
 * Script principal para la evaluación crediticia
 * Autor: David Ferreyra
 */

(function() {
    'use strict';

    // ============================================================
    // CONFIGURACIÓN
    // ============================================================
    
    // ⚠️ REEMPLAZÁ ESTA URL CON LA QUE TE DÉ FORMSPREE ⚠️
    // Si la que te dieron no funciona, andá a formspree.io y creá una nueva sin registro
    const FORMSPREE_URL = 'https://formspree.io/f/xbdvzlqd';

    // ============================================================
    // DOM ELEMENTS
    // ============================================================
    
    const form = document.getElementById('creditoForm');
    const btnEnviar = document.getElementById('btnEnviar');
    const successMsg = document.getElementById('successMsg');
    const errorMsg = document.getElementById('errorMsg');
    const errorText = document.getElementById('errorText');
    const formSection = document.getElementById('formSection');
    const btnHeaderCta = document.getElementById('btnHeaderCta');
    const btnHeroCta = document.getElementById('btnHeroCta');

    // ============================================================
    // FUNCIONES PARA MOSTRAR/OCULTAR FORMULARIO
    // ============================================================
    
    function toggleForm() {
        formSection.classList.toggle('visible');
        if (formSection.classList.contains('visible')) {
            formSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // Event listeners para los botones "Solicitar crédito"
    btnHeaderCta.addEventListener('click', toggleForm);
    btnHeroCta.addEventListener('click', toggleForm);

    // ============================================================
    // FUNCIÓN: CONSULTAR BCRA
    // ============================================================
    
    async function consultarBCRA(cuil) {
        const cuilLimpio = cuil.replace(/\D/g, '');
        
        if (cuilLimpio.length !== 11) {
            return { error: 'El CUIL/CUIT debe tener exactamente 11 dígitos numéricos' };
        }

        try {
            const url = `https://api.bcra.gob.ar/CentralDeDeudores/v1.0/Deudas/${cuilLimpio}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                return { error: `Error HTTP ${response.status}: ${errorText}` };
            }

            const data = await response.json();
            
            if (data.status && data.status !== 200) {
                return { error: data.errorMessages ? data.errorMessages.join(', ') : 'Error en la consulta BCRA' };
            }

            return { success: true, data: data };

        } catch (error) {
            console.error('Error al consultar BCRA:', error);
            return { error: 'No se pudo conectar con la API del BCRA. Verifica tu conexión a internet.' };
        }
    }

    // ============================================================
    // FUNCIÓN: FORMATEAR RESPUESTA BCRA
    // ============================================================
    
    function formatearInfoBCRA(bcraData) {
        if (!bcraData || !bcraData.results) {
            return 'No se encontraron datos en la Central de Deudores del BCRA para esta identificación.';
        }

        const results = bcraData.results;
        let texto = '';

        if (results.denominacion) {
            texto += `Titular: ${results.denominacion}\n`;
        }

        if (results.periodos && results.periodos.length > 0) {
            texto += '\n--- SITUACIÓN CREDITICIA ---\n';
            results.periodos.forEach((periodo) => {
                if (periodo.periodo) {
                    texto += `\nPeríodo: ${periodo.periodo}\n`;
                }
                if (periodo.entidades && periodo.entidades.length > 0) {
                    periodo.entidades.forEach(entidad => {
                        if (entidad.entidad) {
                            texto += `  Entidad: ${entidad.entidad}\n`;
                        }
                        if (entidad.situacion) {
                            const situacionTexto = {
                                '1': 'Situación Normal',
                                '2': 'Con seguimiento especial - Riesgo bajo',
                                '3': 'Con problemas - Riesgo medio',
                                '4': 'Alto riesgo de insolvencia',
                                '5': 'Irrecuperable'
                            }[entidad.situacion] || `Código ${entidad.situacion}`;
                            texto += `  Situación: ${situacionTexto}\n`;
                        }
                        if (entidad.monto) {
                            texto += `  Monto: $${Number(entidad.monto).toLocaleString('es-AR')}\n`;
                        }
                        if (entidad.diasAtrasoPago) {
                            texto += `  Días de atraso: ${entidad.diasAtrasoPago}\n`;
                        }
                        if (entidad.observaciones) {
                            texto += `  Observaciones: ${entidad.observaciones}\n`;
                        }
                        texto += '  ---\n';
                    });
                }
            });
        } else {
            texto += '\nNo se encontraron períodos registrados para esta identificación.\n';
        }

        return texto;
    }

    // ============================================================
    // FUNCIÓN: ENVIAR MAIL VIA FORMSPREE
    // ============================================================
    
    async function enviarMail(datos) {
        try {
            const response = await fetch(FORMSPREE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(datos)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const result = await response.json();
            return { success: true, result };
        } catch (error) {
            console.error('Error al enviar mail:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================================
    // EVENTO: ENVÍO DEL FORMULARIO
    // ============================================================
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Resetear mensajes
        successMsg.classList.remove('visible');
        errorMsg.classList.remove('visible');
        
        // Deshabilitar botón
        btnEnviar.disabled = true;
        btnEnviar.innerHTML = '<span class="spinner"></span> Procesando...';

        // Obtener datos del formulario
        const nombre = document.getElementById('nombre').value.trim();
        const email = document.getElementById('email').value.trim();
        const telefono = document.getElementById('telefono').value.trim();
        const cuil = document.getElementById('cuil').value.trim();
        const ingreso = document.getElementById('ingreso').value.trim();
        const gastoVivienda = document.getElementById('gastoVivienda').value.trim();
        const montoSolicitado = document.getElementById('montoSolicitado').value.trim();
        const plazo = document.getElementById('plazo').value;
        const otrosGastos = document.getElementById('otrosGastos').value.trim() || '0';

        // Validaciones
        if (!nombre || !email || !telefono || !cuil || !ingreso || !gastoVivienda || !montoSolicitado) {
            errorText.textContent = 'Por favor, completá todos los campos obligatorios.';
            errorMsg.classList.add('visible');
            btnEnviar.disabled = false;
            btnEnviar.innerHTML = '<i class="material-icons">send</i> Enviar solicitud';
            return;
        }

        const cuilLimpio = cuil.replace(/\D/g, '');
        if (cuilLimpio.length !== 11) {
            errorText.textContent = 'El CUIL/CUIT debe tener exactamente 11 dígitos numéricos.';
            errorMsg.classList.add('visible');
            btnEnviar.disabled = false;
            btnEnviar.innerHTML = '<i class="material-icons">send</i> Enviar solicitud';
            return;
        }

        // ============================================================
        // 1. CONSULTAR BCRA
        // ============================================================
        
        let bcraInfo = 'No se pudo consultar la Central de Deudores del BCRA.';
        
        try {
            const bcraResponse = await consultarBCRA(cuil);
            if (bcraResponse.error) {
                bcraInfo = `Error en consulta BCRA: ${bcraResponse.error}`;
            } else if (bcraResponse.success) {
                bcraInfo = formatearInfoBCRA(bcraResponse.data);
            }
        } catch (err) {
            bcraInfo = `Error: ${err.message}`;
        }

        // ============================================================
        // 2. CONSTRUIR CUERPO DEL MAIL
        // ============================================================
        
        const fecha = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
        
        const cuerpoMail = `
========================================
NUEVA SOLICITUD DE CRÉDITO
Financiera Astro
========================================

Fecha y hora: ${fecha}

--- DATOS PERSONALES ---
Nombre completo: ${nombre}
Correo electrónico: ${email}
Teléfono: ${telefono}
CUIL/CUIT: ${cuilLimpio}

--- DATOS FINANCIEROS ---
Ingreso mensual neto: $${Number(ingreso).toLocaleString('es-AR')}
Gasto de vivienda (alquiler): $${Number(gastoVivienda).toLocaleString('es-AR')}
Otros gastos mensuales: $${Number(otrosGastos).toLocaleString('es-AR')}
Monto solicitado: $${Number(montoSolicitado).toLocaleString('es-AR')}
Plazo solicitado: ${plazo} cuotas

Capacidad de pago estimada: $${(Number(ingreso) - Number(gastoVivienda) - Number(otrosGastos)).toLocaleString('es-AR')}

--- CONSULTA BCRA (CENTRAL DE DEUDORES) ---
${bcraInfo}

========================================
Este mensaje fue generado automáticamente.
Por favor, contactar al solicitante para continuar con el proceso de evaluación.
========================================
`;

        // ============================================================
        // 3. PREPARAR DATOS PARA FORMSPREE
        // ============================================================
        
        const datosMail = {
            _subject: `Nueva solicitud de crédito - ${nombre}`,
            nombre: nombre,
            email: email,
            telefono: telefono,
            cuil: cuilLimpio,
            ingreso_mensual: ingreso,
            gasto_vivienda: gastoVivienda,
            otros_gastos: otrosGastos || '0',
            monto_solicitado: montoSolicitado,
            plazo_cuotas: plazo,
            capacidad_pago: Number(ingreso) - Number(gastoVivienda) - Number(otrosGastos || 0),
            bcra_consulta: bcraInfo,
            mensaje_completo: cuerpoMail,
            _gotcha: ''
        };

        // ============================================================
        // 4. ENVIAR MAIL
        // ============================================================
        
        const resultadoMail = await enviarMail(datosMail);

        // Restaurar botón
        btnEnviar.disabled = false;
        btnEnviar.innerHTML = '<i class="material-icons">send</i> Enviar solicitud';

        if (resultadoMail.success) {
            successMsg.classList.add('visible');
            form.reset();
        } else {
            errorText.textContent = `Error al enviar: ${resultadoMail.error}. Por favor, intentá nuevamente.`;
            errorMsg.classList.add('visible');
        }
    });

})(); // Fin del IIFE