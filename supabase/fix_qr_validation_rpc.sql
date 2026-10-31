-- ==============================================================================
-- SISTEMA DE VALIDACIÓN POR QR - RPC Y AJUSTE DE PERMISOS RLS
-- ==============================================================================

-- 1. Actualizar la política RLS en turnos para que cualquier socio que participe
--    en el turno (o sea titular) pueda actualizar el registro.
DROP POLICY IF EXISTS "Socio puede reservar (ocupar) y cancelar turnos" ON turnos;

CREATE POLICY "Socio puede reservar (ocupar) y cancelar turnos" ON turnos
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND NOT public.is_admin() AND
        (
            socio_dni = public.get_user_dni()
            OR estado = 'libre'
            OR (participantes_dnis IS NOT NULL AND public.get_user_dni() = ANY(participantes_dnis))
        )
    ) WITH CHECK (
        auth.role() = 'authenticated' AND NOT public.is_admin() AND
        (
            socio_dni = public.get_user_dni()
            OR socio_dni IS NULL
            OR (participantes_dnis IS NOT NULL AND public.get_user_dni() = ANY(participantes_dnis))
        )
    );

-- 2. Función RPC para validar presencia de forma atómica y segura
CREATE OR REPLACE FUNCTION public.validar_presencia_turno(
    p_turno_id uuid,
    p_cancha_id integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_dni text;
    v_turno record;
    v_prev_validados text[];
    v_required_participants text[];
    v_d text;
    v_all_completed boolean := true;
BEGIN
    -- Obtener DNI del usuario autenticado
    v_user_dni := public.get_user_dni();
    IF v_user_dni IS NULL OR v_user_dni = '' THEN
        RETURN json_build_object('success', false, 'error', 'Usuario no autenticado o sin DNI');
    END IF;

    -- Obtener el turno
    SELECT * INTO v_turno
    FROM turnos
    WHERE id = p_turno_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Turno no encontrado');
    END IF;

    IF v_turno.estado <> 'ocupado' THEN
        RETURN json_build_object('success', false, 'error', 'El turno no se encuentra ocupado');
    END IF;

    IF v_turno.cancha_id <> p_cancha_id THEN
        RETURN json_build_object('success', false, 'error', 'El código QR no corresponde a la cancha del turno');
    END IF;

    -- Verificar que el socio pertenezca al turno (sea titular o participante)
    IF v_turno.socio_dni <> v_user_dni 
       AND (v_turno.participantes_dnis IS NULL OR NOT (v_user_dni = ANY(v_turno.participantes_dnis))) THEN
        RETURN json_build_object('success', false, 'error', 'No estás registrado en este turno');
    END IF;

    -- Array actual de validados
    v_prev_validados := COALESCE(v_turno.validados_dnis, ARRAY[]::text[]);

    -- Agregar el DNI del usuario si no está
    IF NOT (v_user_dni = ANY(v_prev_validados)) THEN
        v_prev_validados := array_append(v_prev_validados, v_user_dni);
    END IF;

    -- Si es titular y hay Invitado Especial ('123987456'), se valida automáticamente el invitado
    IF v_turno.socio_dni = v_user_dni 
       AND v_turno.participantes_dnis IS NOT NULL 
       AND ('123987456' = ANY(v_turno.participantes_dnis)) THEN
        IF NOT ('123987456' = ANY(v_prev_validados)) THEN
            v_prev_validados := array_append(v_prev_validados, '123987456');
        END IF;
    END IF;

    -- Construir lista de socios requeridos (excluyendo '123987456')
    IF v_turno.participantes_dnis IS NOT NULL AND array_length(v_turno.participantes_dnis, 1) > 0 THEN
        v_required_participants := v_turno.participantes_dnis;
    ELSE
        IF v_turno.socio_dni IS NOT NULL THEN
            v_required_participants := ARRAY[v_turno.socio_dni];
        ELSE
            v_required_participants := ARRAY[]::text[];
        END IF;
    END IF;

    -- Evaluar si todos los requeridos validaron
    IF v_required_participants IS NOT NULL THEN
        FOREACH v_d IN ARRAY v_required_participants
        LOOP
            IF v_d IS NOT NULL AND v_d <> '123987456' THEN
                IF NOT (v_d = ANY(v_prev_validados)) THEN
                    v_all_completed := false;
                    EXIT;
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- Actualizar el turno
    UPDATE turnos
    SET 
        validados_dnis = v_prev_validados,
        validado = v_all_completed,
        validado_at = CASE WHEN v_all_completed THEN NOW() ELSE validado_at END,
        updated_at = NOW()
    WHERE id = p_turno_id;

    RETURN json_build_object(
        'success', true,
        'all_completed', v_all_completed,
        'validados_dnis', v_prev_validados
    );
END;
$$;

-- Otorgar permiso de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.validar_presencia_turno(uuid, integer) TO authenticated;

