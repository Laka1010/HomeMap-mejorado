-- Migration: dejar de confiar en la cabecera que controla el cliente para
-- determinar la IP de un evento de seguridad (hallazgo A-2 de la auditoría)
-- Date: 2026-08-31
--
-- PROBLEMA
-- _security_event_client_ip() hacía:
--
--     return trim(split_part(v_raw, ',', 1))::inet;   -- v_raw = x-forwarded-for
--
-- es decir, tomaba el PRIMER elemento de X-Forwarded-For, que es exactamente
-- la parte que escribe el cliente. Medido contra el borde real de este
-- proyecto (curl a /rest/v1/rpc con y sin cabeceras inyectadas):
--
--   petición limpia      -> x-forwarded-for: "206.204.154.182"
--   con XFF inyectada    -> x-forwarded-for: "203.0.113.9,206.204.154.182"
--   con 3 valores        -> x-forwarded-for: "1.1.1.1, 2.2.2.2, 3.3.3.3,206.204.154.182"
--
-- El borde SIEMPRE añade la IP real al final; lo que el atacante inyecta queda
-- delante. Así que la función registraba la IP que eligiera el atacante.
--
-- Consecuencias que esto cerraba en falso:
--   * security_events.ip_address no era prueba de nada.
--   * En log_security_event, el bucket del rate limit de un llamante anónimo
--     es host(v_ip): rotando la cabecera se anulaba el límite de 20/min.
--   * _maybe_log_suspicious_activity_by_ip podía dirigirse contra una IP
--     inocente, e inducir a un admin a bloquearla desde el Security Center.
--
-- FUENTES DE CONFIANZA (verificadas contra producción, no supuestas)
-- Se intentó inyectar cada una de estas cabeceras desde fuera:
--   * cf-connecting-ip : NO falsificable. Cloudflare rechaza en el borde la
--                        petición que intenta fijarla (error code: 1000).
--   * sb-forwarded-for : NO falsificable. El borde de Supabase la reescribe.
--   * x-real-ip        : no falsificable, pero DESAPARECE en cuanto el cliente
--                        manda su propia XFF -> no sirve como fuente primaria.
--   * x-forwarded-for  : falsificable por delante, pero su ÚLTIMO elemento lo
--                        pone el borde -> utilizable solo por la cola.
--
-- ORDEN DE PREFERENCIA
--   1. sb-forwarded-for   (cabecera propia de la plataforma)
--   2. cf-connecting-ip   (cabecera del borde CDN)
--   3. x-forwarded-for    -> ÚLTIMO elemento, nunca el primero
--   4. x-real-ip
--   5. inet_client_addr() (último recurso; dentro de la plataforma es ::1)
--
-- Se recorre la lista y se devuelve la primera candidata que sea una inet
-- válida. Antes, cualquier valor mal formado hacía saltar el `exception when
-- others` y la función devolvía NULL, perdiendo la IP del evento entero.
--
-- ALCANCE
-- _security_event_client_ip() tiene un único llamante, log_security_event, que
-- no se toca: al devolver esta función una IP fiable, quedan arreglados de
-- rebote el bucket del rate limit anónimo y el detector por IP, sin cambiar
-- ninguna otra función. No se crean ni borran objetos y no se tocan datos.
--
-- REVERSIBLE: reaplicar la definición de 20260808_046_security_events_fix_search_path.sql.

create or replace function public._security_event_client_ip()
returns inet
language plpgsql
stable
set search_path to 'public'
as $$
declare
  h json;
  v_candidates text[];
  v_raw text;
  v_val text;
  v_ip inet;
begin
  begin
    h := current_setting('request.headers', true)::json;
  exception when others then
    h := null;
  end;

  if h is null then
    return inet_client_addr();
  end if;

  -- Orden de confianza: primero las cabeceras que el cliente no puede fijar.
  v_candidates := array[
    h ->> 'sb-forwarded-for',
    h ->> 'cf-connecting-ip',
    h ->> 'x-forwarded-for',
    h ->> 'x-real-ip'
  ];

  foreach v_raw in array v_candidates loop
    if v_raw is not null and trim(v_raw) <> '' then
      -- Siempre el ÚLTIMO elemento: es el que añade el proxy de confianza.
      -- Para las cabeceras de un solo valor esto devuelve el valor entero.
      v_val := trim(split_part(v_raw, ',', array_length(string_to_array(v_raw, ','), 1)));

      -- Formas habituales que no castean directamente a inet:
      --   "[2001:db8::1]:443" -> 2001:db8::1
      --   "192.0.2.1:443"     -> 192.0.2.1   (un solo ':' y además hay '.')
      if v_val like '[%]%' then
        v_val := substring(v_val from 2 for position(']' in v_val) - 2);
      elsif v_val like '%.%' and length(v_val) - length(replace(v_val, ':', '')) = 1 then
        v_val := split_part(v_val, ':', 1);
      end if;

      begin
        v_ip := v_val::inet;
        return v_ip;
      exception when others then
        -- Candidata mal formada: se prueba la siguiente en vez de rendirse.
        null;
      end;
    end if;
  end loop;

  return inet_client_addr();
exception when others then
  return null;
end;
$$;

-- EOF
