/**
 * Dashboard Administrativo - Financiera Astro
 * Autor: David Ferreyra
 * Versión: 1.0.0
 */

(function() {
    'use strict';

    // ============================================================
    // CONFIGURACIÓN
    // ============================================================
    
    const STORAGE_KEY = 'financiera_astro_solicitudes';

    // ============================================================
    // DOM ELEMENTS
    // ============================================================
    
    const solicitudesGrid = document.getElementById('solicitudesGrid');
    const totalBadge = document.getElementById('totalBadge');
    const totalSolicitudes = document.getElementById('totalSolicitudes');
    const totalAprobadas = document.getElementById('totalAprobadas');
    const totalRechazadas = document.getElementById('totalRechazadas');
    const totalPendientes = document.getElementById('totalPendientes');
    const chartBars = document.getElementById('chartBars');
    const lastUpdate = document.getElementById('lastUpdate');
    const configTotal = document.getElementById('configTotal');
    const configLastUpdate = document.getElementById('configLastUpdate');
    const btnRefresh = document.getElementById('btnRefresh');
    const btnLimpiarDatos = document.getElementById('btnLimpiarDatos');
    const modal = document.getElementById('detailModal');
    const modalBody = document.getElementById('modalBody');
    const modalFooter = document.getElementById('modalFooter');
    const modalClose = document.getElementById('modalClose');
    const modalCloseBtn = document.getElementById('modalCloseBtn');

    // ============================================================
    // FUNCIONES PRINCIPALES
    // ============================================================
    
    // Obtener todas las solicitudes
    function getSolicitudes() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error al leer solicitudes:', error);
            return [];
        }
    }

    // Guardar solicitudes
    function saveSolicitudes(solicitudes) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(solicitudes));
        } catch (error) {
            console.error('Error al guardar solicitudes:', error);
        }
    }

    // Generar ID único
    function generarId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    // ============================================================
    // EVALUACIÓN DE CRÉDITO (Recomendación)
    // ============================================================
    
    function evaluarCredito(solicitud) {
        const { ingreso_mensual, gasto_vivienda, otros_gastos, monto_solicitado, plazo_cuotas, bcra_consulta } = solicitud;
        
        const ingreso = Number(ingreso_mensual) || 0;
        const gastos = Number(gasto_vivienda) || 0 + Number(otros_gastos) || 0;
        const capacidadPago = ingreso - gastos;
        const monto = Number(monto_solicitado) || 0;
        const cuotas = Number(plazo_cuotas) || 12;
        const cuotaEstimada = monto / cuotas;

        let puntaje = 0;
        let recomendacion = 'pendiente';
        let mensaje = '';
        let detalles = [];

        // 1. Capacidad de pago (máximo 30% del ingreso)
        const capacidadPagoDisponible = capacidadPago * 0.3;
        if (capacidadPagoDisponible >= cuotaEstimada) {
            puntaje += 35;
            detalles.push('✅ Capacidad de pago suficiente');
        } else if (capacidadPagoDisponible >= cuotaEstimada * 0.7) {
            puntaje += 20;
            detalles.push('⚠️ Capacidad de pago ajustada');
        } else {
            puntaje += 5;
            detalles.push('❌ Capacidad de pago insuficiente');
        }

        // 2. Relación deuda/ingreso
        const relacionDeuda = (monto / ingreso) * 100;
        if (relacionDeuda < 30) {
            puntaje += 25;
            detalles.push('✅ Baja relación deuda/ingreso');
        } else if (relacionDeuda < 50) {
            puntaje += 15;
            detalles.push('⚠️ Relación deuda/ingreso media');
        } else {
            puntaje += 5;
            detalles.push('❌ Alta relación deuda/ingreso');
        }

        // 3. Plazo del crédito
        if (cuotas <= 12) {
            puntaje += 15;
            detalles.push('✅ Plazo corto (menos riesgo)');
        } else if (cuotas <= 24) {
            puntaje += 10;
            detalles.push('⚠️ Plazo medio');
        } else {
            puntaje += 5;
            detalles.push('❌ Plazo largo (mayor riesgo)');
        }

        // 4. BCRA (si hay datos)
        if (bcra_consulta && !bcra_consulta.includes('Error')) {
            const situacionNormal = bcra_consulta.includes('Situación Normal') || bcra_consulta.includes('Sin deudas');
            const situacionRiesgo = bcra_consulta.includes('Riesgo');
            const situacionIrrecuperable = bcra_consulta.includes('Irrecuperable');

            if (situacionNormal || situacionRiesgo === false) {
                puntaje += 25;
                detalles.push('✅ Sin deudas problemáticas en BCRA');
            } else if (situacionRiesgo && !situacionIrrecuperable) {
                puntaje += 10;
                detalles.push('⚠️ Con seguimiento especial en BCRA');
            } else if (situacionIrrecuperable) {
                puntaje += 0;
                detalles.push('❌ Situación irrecuperable en BCRA');
            }
        } else {
            detalles.push('⚠️ Sin información de BCRA (revisar manualmente)');
        }

        // Decisión final
        if (puntaje >= 70) {
            recomendacion = 'aprobada';
            mensaje = '✅ Crédito recomendado. Excelente perfil financiero.';
        } else if (puntaje >= 45) {
            recomendacion = 'precaución';
            mensaje = '⚠️ Crédito con precaución. Evaluar manualmente.';
        } else {
            recomendacion = 'rechazada';
            mensaje = '❌ Crédito no recomendado. Alto riesgo.';
        }

        return {
            puntaje,
            recomendacion,
            mensaje,
            detalles,
            capacidadPago,
            cuotaEstimada,
            relacionDeuda: Math.round(relacionDeuda)
        };
    }

    // ============================================================
    // RENDER: SOLICITUDES
    // ============================================================
    
    function renderSolicitudes() {
        const solicitudes = getSolicitudes();

        if (solicitudes.length === 0) {
            solicitudesGrid.innerHTML = `
                <div class="empty-state">
                    <i class="material-icons">inbox</i>
                    <h3>No hay solicitudes aún</h3>
                    <p>Las solicitudes de crédito aparecerán aquí cuando los clientes las envíen.</p>
                </div>
            `;
            actualizarContadores();
            actualizarEstadisticas();
            renderChart();
            updateLastUpdate();
            return;
        }

        // Ordenar por fecha (más reciente primero)
        const sorted = [...solicitudes].reverse();

        solicitudesGrid.innerHTML = sorted.map(solicitud => {
            const fecha = new Date(solicitud.fecha).toLocaleString('es-AR');
            const evaluacion = solicitud.evaluacion || evaluarCredito(solicitud);
            const statusClass = evaluacion.recomendacion;
            const statusLabel = {
                'aprobada': 'Aprobada',
                'rechazada': 'Rechazada',
                'precaución': 'Precaución',
                'pendiente': 'Pendiente'
            }[evaluacion.recomendacion] || 'Pendiente';

            // Construir número de WhatsApp
            const telefonoLimpio = (solicitud.telefono || '').replace(/\D/g, '');
            const telefonoWhatsApp = telefonoLimpio ? `54${telefonoLimpio}` : '';
            const mensajeWhatsApp = `Hola ${solicitud.nombre || ''}, soy de Financiera Astro. Vi tu solicitud de crédito por $${Number(solicitud.monto_solicitado || 0).toLocaleString('es-AR')} en ${solicitud.plazo_cuotas || 0} cuotas. ¿Podemos coordinar una reunión para avanzar con la evaluación?`;
            const mensajeCodificado = encodeURIComponent(mensajeWhatsApp);
            const whatsappLink = telefonoWhatsApp ? `https://wa.me/${telefonoWhatsApp}?text=${mensajeCodificado}` : '#';

            return `
                <div class="solicitud-card" data-id="${solicitud.id}">
                    <div class="header">
                        <span class="nombre">${solicitud.nombre || 'Sin nombre'}</span>
                        <span class="fecha">${fecha}</span>
                    </div>
                    <div class="detalle-preview">
                        <strong>Monto:</strong> $${Number(solicitud.monto_solicitado || 0).toLocaleString('es-AR')} 
                        · <strong>Cuotas:</strong> ${solicitud.plazo_cuotas || 0}
                        · <strong>Ingreso:</strong> $${Number(solicitud.ingreso_mensual || 0).toLocaleString('es-AR')}
                    </div>
                    <div class="footer">
                        <div class="footer-left">
                            <span class="status-badge ${statusClass}">${statusLabel}</span>
                            <span class="recomendacion-badge ${statusClass}">${evaluacion.mensaje}</span>
                        </div>
                        <a href="${whatsappLink}" target="_blank" class="whatsapp-btn" ${!telefonoWhatsApp ? 'style="opacity:0.5; pointer-events:none;"' : ''}>
                            <i class="material-icons" style="font-size: 16px;">whatsapp</i>
                            Contactar
                        </a>
                    </div>
                </div>
            `;
        }).join('');

        // Event listeners para abrir detalle
        document.querySelectorAll('.solicitud-card').forEach(card => {
            card.addEventListener('click', function(e) {
                // Evitar que el click en el botón de WhatsApp abra el modal
                if (e.target.closest('.whatsapp-btn')) {
                    return;
                }
                const id = this.dataset.id;
                const solicitudes = getSolicitudes();
                const solicitud = solicitudes.find(s => s.id === id);
                if (solicitud) {
                    abrirModal(solicitud);
                }
            });
        });

        // Actualizar contadores
        actualizarContadores();
        actualizarEstadisticas();
        renderChart();
        updateLastUpdate();
    }

    // ============================================================
    // RENDER: ESTADÍSTICAS
    // ============================================================
    
    function actualizarContadores() {
        const solicitudes = getSolicitudes();
        totalBadge.textContent = solicitudes.length;
        totalSolicitudes.textContent = solicitudes.length;
        configTotal.textContent = solicitudes.length;

        let aprobadas = 0, rechazadas = 0, pendientes = 0;
        solicitudes.forEach(s => {
            const eval_ = s.evaluacion || evaluarCredito(s);
            if (eval_.recomendacion === 'aprobada') aprobadas++;
            else if (eval_.recomendacion === 'rechazada') rechazadas++;
            else if (eval_.recomendacion === 'precaución') pendientes++;
            else pendientes++;
        });

        totalAprobadas.textContent = aprobadas;
        totalRechazadas.textContent = rechazadas;
        totalPendientes.textContent = pendientes;
    }

    function actualizarEstadisticas() {
        // Para el modal de detalle, no se usa
    }

    function renderChart() {
        const solicitudes = getSolicitudes();
        if (solicitudes.length === 0) {
            chartBars.innerHTML = '<p style="color:#6b768a; text-align:center; width:100%;">Sin datos para mostrar</p>';
            return;
        }

        let aprobadas = 0, rechazadas = 0, pendientes = 0;
        solicitudes.forEach(s => {
            const eval_ = s.evaluacion || evaluarCredito(s);
            if (eval_.recomendacion === 'aprobada') aprobadas++;
            else if (eval_.recomendacion === 'rechazada') rechazadas++;
            else if (eval_.recomendacion === 'precaución') pendientes++;
            else pendientes++;
        });

        const max = Math.max(aprobadas, rechazadas, pendientes, 1);
        const data = [
            { label: 'Aprobadas', value: aprobadas, class: 'aprobada' },
            { label: 'Rechazadas', value: rechazadas, class: 'rechazada' },
            { label: 'Precaución', value: pendientes, class: 'pendiente' }
        ];

        chartBars.innerHTML = data.map(item => `
            <div class="chart-bar">
                <span class="bar-value">${item.value}</span>
                <div class="bar ${item.class}" style="height: ${(item.value / max) * 150 + 20}px;"></div>
                <span class="bar-label">${item.label}</span>
            </div>
        `).join('');
    }

    function updateLastUpdate() {
        const now = new Date().toLocaleString('es-AR');
        lastUpdate.textContent = `Última actualización: ${now}`;
        configLastUpdate.textContent = now;
    }

    // ============================================================
    // MODAL DE DETALLE (CON BOTÓN DE WHATSAPP)
    // ============================================================
    
    function abrirModal(solicitud) {
        const fecha = new Date(solicitud.fecha).toLocaleString('es-AR');
        const evaluacion = solicitud.evaluacion || evaluarCredito(solicitud);
        
        const statusLabel = {
            'aprobada': '✅ Aprobada',
            'rechazada': '❌ Rechazada',
            'precaución': '⚠️ Precaución',
            'pendiente': '⏳ Pendiente'
        }[evaluacion.recomendacion] || 'Pendiente';

        const statusClass = evaluacion.recomendacion;

        // Construir el mensaje para WhatsApp
        const mensajeWhatsApp = `Hola ${solicitud.nombre || ''}, soy de Financiera Astro. Vi tu solicitud de crédito por $${Number(solicitud.monto_solicitado || 0).toLocaleString('es-AR')} en ${solicitud.plazo_cuotas || 0} cuotas. ¿Podemos coordinar una reunión para avanzar con la evaluación?`;

        modalBody.innerHTML = `
            <div class="info-row">
                <span class="label">Fecha</span>
                <span class="value">${fecha}</span>
            </div>
            <div class="info-row">
                <span class="label">Nombre completo</span>
                <span class="value">${solicitud.nombre || '-'}</span>
            </div>
            <div class="info-row">
                <span class="label">Email</span>
                <span class="value">${solicitud.email || '-'}</span>
            </div>
            <div class="info-row">
                <span class="label">Teléfono</span>
                <span class="value">${solicitud.telefono || '-'}</span>
            </div>
            <div class="info-row">
                <span class="label">CUIL/CUIT</span>
                <span class="value">${solicitud.cuil || '-'}</span>
            </div>
            <div class="info-row">
                <span class="label">Ingreso mensual</span>
                <span class="value">$${Number(solicitud.ingreso_mensual || 0).toLocaleString('es-AR')}</span>
            </div>
            <div class="info-row">
                <span class="label">Gasto vivienda</span>
                <span class="value">$${Number(solicitud.gasto_vivienda || 0).toLocaleString('es-AR')}</span>
            </div>
            <div class="info-row">
                <span class="label">Otros gastos</span>
                <span class="value">$${Number(solicitud.otros_gastos || 0).toLocaleString('es-AR')}</span>
            </div>
            <div class="info-row">
                <span class="label">Monto solicitado</span>
                <span class="value">$${Number(solicitud.monto_solicitado || 0).toLocaleString('es-AR')}</span>
            </div>
            <div class="info-row">
                <span class="label">Plazo</span>
                <span class="value">${solicitud.plazo_cuotas || 0} cuotas</span>
            </div>
            <div class="info-row" style="border-bottom: 2px solid #262c36; padding-bottom: 12px; margin-bottom: 12px;">
                <span class="label"><strong>Capacidad de pago</strong></span>
                <span class="value"><strong>$${Number(evaluacion.capacidadPago || 0).toLocaleString('es-AR')}</strong></span>
            </div>

            <div style="background: #1e232b; padding: 16px; border-radius: 12px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span><strong>Evaluación:</strong></span>
                    <span class="status-badge ${statusClass}" style="font-size: 14px;">${statusLabel}</span>
                </div>
                <p style="color: #b6bcc8; margin-bottom: 8px;">${evaluacion.mensaje}</p>
                <p><strong>Puntaje:</strong> ${evaluacion.puntaje}/100</p>
                <p><strong>Relación deuda/ingreso:</strong> ${evaluacion.relacionDeuda || 0}%</p>
                <p><strong>Cuota estimada:</strong> $${Number(evaluacion.cuotaEstimada || 0).toLocaleString('es-AR')}</p>
                <div style="margin-top: 8px;">
                    <strong>Detalles:</strong>
                    <ul style="list-style: none; padding: 0; margin-top: 4px;">
                        ${evaluacion.detalles.map(d => `<li style="padding: 2px 0; font-size: 13px; color: #9aa3b3;">${d}</li>`).join('')}
                    </ul>
                </div>
            </div>

            <div class="bcra-info">
                <strong>📋 Consulta BCRA:</strong>
                ${solicitud.bcra_consulta || 'Sin información disponible'}
            </div>
        `;

        // ============================================================
        // GENERAR BOTONES DEL FOOTER (CON WHATSAPP)
        // ============================================================
        
        // Número de teléfono (eliminar caracteres no numéricos)
        const telefonoLimpio = (solicitud.telefono || '').replace(/\D/g, '');
        const telefonoWhatsApp = telefonoLimpio ? `54${telefonoLimpio}` : ''; // Asumimos Argentina (54)
        
        // Texto del mensaje codificado para URL
        const mensajeCodificado = encodeURIComponent(mensajeWhatsApp);
        
        // Enlaces
        const whatsappLink = telefonoWhatsApp ? `https://wa.me/${telefonoWhatsApp}?text=${mensajeCodificado}` : '#';
        const emailLink = solicitud.email ? `mailto:${solicitud.email}?subject=Solicitud de crédito - Financiera Astro&body=${encodeURIComponent(mensajeWhatsApp)}` : '#';
        const telefonoLink = solicitud.telefono ? `tel:${solicitud.telefono}` : '#';

        modalFooter.innerHTML = `
            <a href="${whatsappLink}" target="_blank" class="btn-contacto btn-whatsapp" ${!telefonoWhatsApp ? 'style="opacity:0.5; pointer-events:none;"' : ''}>
                <i class="material-icons">whatsapp</i> WhatsApp
            </a>
            <a href="${emailLink}" class="btn-contacto" style="background: #ffb347; color: #0b0d11;">
                <i class="material-icons">email</i> Email
            </a>
            <a href="${telefonoLink}" class="btn-contacto" style="background: #1e232b; color: #eef1f5; border: 1px solid #2d3440;">
                <i class="material-icons">phone</i> Llamar
            </a>
            <button class="btn-modal-close" id="modalCloseBtn2">Cerrar</button>
        `;

        // Event listener para cerrar modal desde el nuevo botón
        document.getElementById('modalCloseBtn2').addEventListener('click', cerrarModal);

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function cerrarModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    // ============================================================
    // EVENT LISTENERS
    // ============================================================
    
    // Navegación del sidebar
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remover active de todos
            document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
            this.classList.add('active');

            // Mostrar sección correspondiente
            const section = this.dataset.section;
            document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));

            if (section === 'solicitudes') {
                document.getElementById('sectionSolicitudes').classList.add('active');
                document.getElementById('sectionTitle').textContent = 'Solicitudes';
            } else if (section === 'estadisticas') {
                document.getElementById('sectionEstadisticas').classList.add('active');
                document.getElementById('sectionTitle').textContent = 'Estadísticas';
                renderChart();
            } else if (section === 'configuracion') {
                document.getElementById('sectionConfiguracion').classList.add('active');
                document.getElementById('sectionTitle').textContent = 'Configuración';
            }
        });
    });

    // Refresh
    btnRefresh.addEventListener('click', function() {
        renderSolicitudes();
        this.innerHTML = '<i class="material-icons">check</i> Actualizado';
        setTimeout(() => {
            this.innerHTML = '<i class="material-icons">refresh</i> Actualizar';
        }, 2000);
    });

    // Limpiar datos
    btnLimpiarDatos.addEventListener('click', function() {
        if (confirm('¿Estás seguro de eliminar TODAS las solicitudes? Esta acción no se puede deshacer.')) {
            localStorage.removeItem(STORAGE_KEY);
            renderSolicitudes();
        }
    });

    // Cerrar modal
    modalClose.addEventListener('click', cerrarModal);
    modalCloseBtn.addEventListener('click', cerrarModal);
    modal.addEventListener('click', function(e) {
        if (e.target === this) cerrarModal();
    });

    // ============================================================
    // INICIALIZACIÓN
    // ============================================================
    
    // Renderizar solicitudes al cargar
    renderSolicitudes();

    // Actualizar cada 30 segundos
    setInterval(() => {
        renderSolicitudes();
    }, 30000);

    console.log('📊 Dashboard Financiera Astro cargado correctamente');
    console.log(`📋 ${getSolicitudes().length} solicitudes en total`);

})();