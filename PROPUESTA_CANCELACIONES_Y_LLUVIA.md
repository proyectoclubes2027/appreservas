# 🎾 Propuesta: Manejo de Lluvia y Cancelaciones de Turnos
**Club Atlético Empalme Central (CAEC Tenis)**  
*Documento de discusión para reunión de Subcomisión*

---

## 🌧️ 1. Factor Climático (Lluvia y Mal Estado de Canchas)

### Situación actual
Cuando llueve o se suspenden las canchas, si los socios no asisten ni escanean el código QR en el club, el sistema automático podría considerarlo ausencia ("no-show") y sancionarlos injustamente.

### Opciones a presentar en la Subcomisión:

* **Opción A (Recomendada - Botón de Lluvia Oficial):**
  * El canchero o administrador toca el botón **"⛈️ Bloquear por Lluvia"** en el panel de reservas.
  * Automáticamente todos los turnos afectados se cancelan con motivo *"Lluvia / Clima"*, se les avisa por notificación push a los socios y **se anula cualquier sanción o exigencia de QR** para esa franja horaria.
* **Opción B (Día Libre de QR):**
  * Si el día está inestable o amenaza lluvia intermitente, el admin activa un interruptor: **"🌧️ Día con Clima Inestable"**.
  * Los socios pueden jugar si la cancha lo permite, pero la falta de escaneo QR **no genera sanciones** durante esa jornada.
* **Opción C (Perdón Retroactivo):**
  * Si se pasó la hora y el sistema sancionó a los socios, el admin cuenta con un botón en el panel de sanciones: *"Perdonar ausencias del día por lluvia"* con 1 solo clic.

---

## ⏱️ 2. Cancelaciones de Último Momento (1 hora o 30 min antes)

### Situación actual
Si un socio cancela faltando 30 o 60 minutos, queda muy poco margen para que otro socio se entere y aproveche la cancha vacía. Por otro lado, si se sanciona muy severamente a quien avisa con 30 minutos de antelación, los socios optarán por no avisar nunca.

### Esquema propuesto: "Semáforo de Cancelación"

| Anticipación | Tipo de Cancelación | Impacto en el Socio |
| :--- | :--- | :--- |
| **Más de 2 horas antes** | Cancelación Normal | **Sin penalidad.** Tiempo suficiente para que otro socio reserve. |
| **Entre 30 min y 2 horas** | Cancelación Tardía | **Tolerancia / Condicional** (ver alternativas abajo). |
| **Menos de 30 min o No-Show** | Falta directa | **Sanción** (por no concurrir ni liberar la cancha a tiempo). |

### Alternativas para la "Cancelación Tardía" (30 min a 2 hs):

1. **Opción 1: "Solidaria / Salvado si otro reserva" (Muy recomendada)**
   * El socio puede cancelar avisando sobre la hora.
   * La app le indica: *"Cancelaste sobre la hora. Si otro socio toma tu turno antes de la hora de inicio, no recibirás sanción"*.
   * Incentiva al socio a buscar reemplazo o avisarle a sus conocidos para que ocupen la cancha.
2. **Opción 2: "Crédito mensual de emergencias" (Sistema de 2 avisos / strikes)**
   * A todo socio se le puede pinchar una rueda o surgir un imprevisto laboral/médico.
   * Se permiten **hasta 2 cancelaciones de último momento al mes**.
   * A la 3ra cancelación tardía en el mismo mes calendario, se aplica una sanción de días sin poder reservar.
3. **Opción 3: Transferencia de turno entre socios**
   * En vez de cancelar, el socio puede "Ceder el turno" a otro socio ingresando su DNI o seleccionándolo, quedando el nuevo socio como responsable de validar el QR.

---

## ⚡ 3. ¿Cómo ocupar rápidamente los turnos liberados sobre la hora?

1. **Notificación Push Instantánea ("Turno Relámpago"):**
   * Ya contamos con la función de **Lista de Espera** y notificaciones push.
   * Al liberarse una cancha a menos de 2 horas, se dispara un aviso prioritario al celular de los socios interesados:  
     *`⚡ ¡Cancha liberada de último momento! Hoy 18:00hs Cancha 2 libre. ¡Reservala ya!`*
2. **Botón para compartir en WhatsApp del Club:**
   * Enlace directo para compartir en grupos de tenis del club: *"Se liberó turno hoy a las 18 hs, hacé clic acá para tomarlo"*.

---

## 📌 Próximos pasos técnicos tras la reunión
Una vez que la subcomisión defina el criterio preferido:
1. Configurar los límites de horas en `configuracion_club`.
2. Ajustar la validación y alertas en la pantalla `MisTurnos.tsx`.
3. Conectar el botón de cancelación por lluvia con la exención de sanciones.
