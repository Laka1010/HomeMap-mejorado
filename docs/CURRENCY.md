# 🌍 Moneda (multi-divisa)

Cada hogar elige una moneda y toda la app muestra los importes con ella. **No se
convierte nada**: los importes se guardan siempre como números y la moneda solo
decide cómo se pintan.

## Para el usuario

Dos vías, ambas sobre el mismo dato:

- **Perfil → Configuración de la casa** — moneda + miembros del hogar con su rol.
- **Perfil → Configuración** — la moneda también aparece aquí, junto a idioma y tema.

Solo Owner/Administrador puede cambiarla; el resto la ve en modo lectura. El
cambio se guarda automáticamente y se aplica a Economía, Facturas, Gastos,
Ingresos, historial de compras y fichas de objeto.

La sección muestra una fila compacta con la moneda activa; al tocarla se abre
`CurrencyPickerModal` — buscador arriba y la lista completa con icono circular,
nombre, código y símbolo, con check verde en la seleccionada.

Monedas disponibles: EUR €, USD $, GBP £, CHF, CAD C$, AUD A$, JPY ¥, CNY ¥,
MXN $, BRL R$, ARS AR$. Para añadir más, basta con ampliar `CURRENCIES` en
`src/utils/currencyUtils.js` y su `order` en `getCurrenciesList()`.

> En Windows los emoji de bandera no tienen glifo y se ven como dos letras
> ("EU", "US"). En Android e iOS —los objetivos reales de Capacitor— se ven
> correctamente.

## Para desarrollar

### Mostrar un importe

Dentro del árbol de la app, usa el hook. No hace falta pasar la moneda por props:

```jsx
import { useCurrency } from "../../currency";

function ExpenseRow({ expense }) {
  const { format } = useCurrency();
  return <span>{format(expense.amount)}</span>;   // 1.234,56 €
}
```

El contexto expone:

| campo | uso |
|---|---|
| `format(amount)` | importe con símbolo, decimales según la moneda |
| `formatRounded(amount)` | igual pero sin decimales (gráficas, tarjetas de stats) |
| `symbol` | solo el símbolo, p. ej. para el sufijo de un input |
| `code` | código ISO activo (`"EUR"`) |
| `decimals` | decimales de la moneda (0 en JPY) — útil para el `step` de un input |

Fuera del árbol (o en `HomeMapAppInner`, que es quien renderiza el provider y por
tanto no puede consumirlo) se usa el util directamente:

```js
import { formatCurrencyValue } from "./utils/currencyUtils";
formatCurrencyValue(amount, activeHome?.currency_code, locale);
```

### Formato

La colocación del símbolo, el agrupamiento y el número de decimales los decide
`Intl` según el **idioma de la app**, no según el país de la moneda. El glifo del
símbolo sale de `CURRENCIES`, para que coincida siempre con el selector.

```
formatCurrencyValue(1234.56, "EUR", "es") -> "1234,56 €"
formatCurrencyValue(1234.56, "EUR", "en") -> "€1,234.56"
formatCurrencyValue(1234.56, "JPY", "es") -> "1235 ¥"      (el yen no lleva decimales)
formatCurrencyValue(12345.67, "EUR", "es") -> "12.345,67 €"
```

El español no agrupa los números de cuatro cifras (`1234,56 €`) pero sí a partir
de cinco (`12.345,67 €`). Es la regla del locale, no un fallo.

Un código desconocido cae a EUR en vez de lanzar: estas funciones corren dentro
de renders y un throw dejaría la pantalla en blanco.

## Arquitectura

```
CurrencySection (UI, solo admin edita)
   ↓ onChange
App.jsx  handleChangeCurrency → houseService.setHouseCurrency
   ↓                                    ↓
CurrencyProvider (code)          RPC set_house_currency  → houses.currency_code
   ↓ useCurrency()                      ↑ comprueba is_house_admin
módulos (Economía, Compras, wizards…)
```

- `houses.currency_code` — código ISO, default `EUR`, con check `^[A-Z]{3}$`.
- `set_house_currency(house_id, code)` — única vía de escritura; valida admin.
- **La vista `my_houses` debe exponer `currency_code`.** Es de donde
  `houseService.listMyHouses()` lee las casas; si falta la columna la moneda se
  guarda pero nunca vuelve al front y la app se queda siempre en EUR.

### Migraciones

| fichero | contenido |
|---|---|
| `20260729_011_add_currency.sql` | columna + RPC + vista (instalaciones nuevas) |
| `20260729_012_currency_view_fix.sql` | recrea la vista, para proyectos donde la 011 ya se había aplicado sin ella |

Ambas son idempotentes. Aplicar con:

```bash
supabase db push
```

Comprobación rápida en SQL:

```sql
select currency_code from public.my_houses limit 1;
```

Si esa consulta falla, la vista está desactualizada y la moneda no llegará a la app.

## Preparado para el futuro (no implementado)

La estructura deja sitio, sin cambios incompatibles, para:

- **Conversión automática**: `CURRENCIES` ya está indexado por ISO; falta añadir
  tipos de cambio y una `convertCurrency(value, from, to)`.
- **Formato regional propio**: cada moneda lleva su `region` (`es-ES`, `ja-JP`…),
  hoy sin usar porque el formato sigue al idioma de la app.
- **Idioma según región**: `region` permite proponer moneda al cambiar de idioma.
- **API de tipos de cambio / histórico**: el importe se guarda numérico y la
  moneda por separado, que es lo que hace falta para convertir a posteriori.
