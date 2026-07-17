import React, { useState, useEffect } from "react";
import { supabase } from "../services/supabase";

export default function Finanzas() {
  const [loading, setLoading] = useState(true);
  const [sucursales, setSucursales] = useState([]);

  // ─── CONFIGURACIÓN DE VISTA ───
  const [finMode, setFinMode] = useState("mensual"); // 'mensual' | 'anual'

  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;

  const [periodoMensual, setPeriodoMensual] = useState(currentMonthStr);
  const [periodoAnual, setPeriodoAnual] = useState(
    today.getFullYear().toString()
  );
  const [sucursalFilter, setSucursalFilter] = useState("");

  // ─── DATOS FINANCIEROS (Formulario P&L) ───
  const [finData, setFinData] = useState({
    // INGRESOS
    vbrutas_mujer: 0,
    vbrutas_hombre: 0,
    dev_mujer: 0,
    dev_hombre: 0,

    // CMV
    invini_mujer: 0,
    invini_hombre: 0,
    compra_mujer: 0,
    compra_hombre: 0,
    fletes: 0,
    invfin_mujer: 0,
    invfin_hombre: 0,
    merma_mujer: 0,
    merma_hombre: 0,

    // GASTOS OPERATIVOS (A. Ventas)
    gas_renta: 0,
    gas_nmina: 0,
    gas_publi: 0,
    gas_servicios: 0,
    gas_pos: 0,
    // GASTOS OPERATIVOS (B. Admin)
    gas_admin: 0,
    gas_software: 0,
    gas_depre: 0,

    // OTROS
    gas_finan: 0,
    otros_ing: 0,
    tasa_impuesto: 30,
  });

  // ─── REGISTROS AUXILIARES ───
  const [subTab, setSubTab] = useState("gasto"); // 'gasto' | 'compra'
  const [registrosAuxiliares, setRegistrosAuxiliares] = useState([]);

  // Form Gasto
  const [gastoCat, setGastoCat] = useState("Renta");
  const [gastoDesc, setGastoDesc] = useState("");
  const [gastoMonto, setGastoMonto] = useState("");

  // Form Compra
  const [compraLinea, setCompraLinea] = useState("Mujer");
  const [compraDesc, setCompraDesc] = useState("");
  const [compraMonto, setCompraMonto] = useState("");

  // ─── TOASTS ───
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });
  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(
      () => setToast({ show: false, message: "", type: "success" }),
      3000
    );
  };

  // ─── CARGA INICIAL DE SUCURSALES ───
  useEffect(() => {
    const loadSucs = async () => {
      const { data } = await supabase
        .from("sucursales")
        .select("id, nombre")
        .order("nombre");
      if (data) setSucursales(data);
    };
    loadSucs();
  }, []);

  // ─── CARGA DEL MODELO FINANCIERO AL CAMBIAR FILTROS ───
  useEffect(() => {
    loadFinancialModel();
  }, [finMode, periodoMensual, periodoAnual, sucursalFilter]);

  const loadFinancialModel = async () => {
    setLoading(true);

    // Función ayudante para formatear fechas
    const pad = (n) => String(n).padStart(2, "0");
    const tzOffset = (() => {
      const offset = new Date().getTimezoneOffset();
      const sign = offset <= 0 ? "+" : "-";
      const hours = pad(Math.floor(Math.abs(offset) / 60));
      const mins = pad(Math.abs(offset) % 60);
      return `${sign}${hours}:${mins}`;
    })();

    const fetchMonthData = async (year, month) => {
      const lastDay = new Date(year, month, 0).getDate();
      const startDate = `${year}-${pad(month)}-01T00:00:00${tzOffset}`;
      const endDate = `${year}-${pad(month)}-${pad(
        lastDay
      )}T23:59:59${tzOffset}`;
      const startLogDate = `${year}-${pad(month)}-01`;
      const endLogDate = `${year}-${pad(month)}-${pad(lastDay)}`;
      const mesAnio = `${year}-${pad(month)}`;

      let ordersQuery = supabase
        .from("pedidos")
        .select("*, pedido_items(total, productos(genero))")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .in("estado", ["Pagado", "Completado"]);
      if (sucursalFilter)
        ordersQuery = ordersQuery.eq("sucursal_id", sucursalFilter);
      const { data: orders } = await ordersQuery;

      let expQuery = supabase
        .from("finanzas_gastos")
        .select("*")
        .gte("fecha", startLogDate)
        .lte("fecha", endLogDate);
      if (sucursalFilter) expQuery = expQuery.eq("sucursal_id", sucursalFilter);
      const { data: expenses } = await expQuery;

      let purQuery = supabase
        .from("finanzas_compras")
        .select("*")
        .gte("fecha", startLogDate)
        .lte("fecha", endLogDate);
      if (sucursalFilter) purQuery = purQuery.eq("sucursal_id", sucursalFilter);
      const { data: purchases } = await purQuery;

      // Intentamos cargar un "Snapshot" si ya guardaron el cierre de ese mes
      let invQuery = supabase
        .from("finanzas_inventarios_mensuales")
        .select("*")
        .eq("mes_anio", mesAnio);
      if (sucursalFilter) invQuery = invQuery.eq("sucursal_id", sucursalFilter);
      const { data: invSetData } = await invQuery.limit(1);
      const invSet = invSetData && invSetData.length > 0 ? invSetData[0] : null;

      return {
        orders: orders || [],
        expenses: expenses || [],
        purchases: purchases || [],
        invSet,
      };
    };

    const aggregateData = (months) => {
      let vMujer = 0,
        vHombre = 0;
      const expSum = {
        Renta: 0,
        "Sueldos Ventas": 0,
        Publicidad: 0,
        Servicios: 0,
        "Comisiones POS": 0,
        "Sueldos Admin": 0,
        "Licencias Software": 0,
        Depreciacion: 0,
      };
      let cMujer = 0,
        cHombre = 0;
      let iIniMujer = 0,
        iIniHombre = 0,
        iFinMujer = 0,
        iFinHombre = 0;
      let mMermaMujer = 0,
        mMermaHombre = 0,
        fletesTotal = 0;
      const allExp = [],
        allPur = [];

      months.forEach(({ orders, expenses, purchases, invSet }) => {
        orders.forEach((o) => {
          (o.pedido_items || []).forEach((item) => {
            const isWoman = item.productos?.genero === "mujer";
            if (isWoman) vMujer += parseFloat(item.total) || 0;
            else vHombre += parseFloat(item.total) || 0;
          });
        });

        expenses.forEach((e) => {
          if (expSum[e.categoria] !== undefined)
            expSum[e.categoria] += parseFloat(e.monto) || 0;
          allExp.push(e);
        });

        purchases.forEach((p) => {
          if (p.linea === "Mujer") cMujer += parseFloat(p.monto) || 0;
          else cHombre += parseFloat(p.monto) || 0;
          allPur.push(p);
        });

        if (invSet) {
          iIniMujer += parseFloat(invSet.inicial_mujer) || 0;
          iIniHombre += parseFloat(invSet.inicial_hombre) || 0;
          iFinMujer += parseFloat(invSet.final_mujer) || 0;
          iFinHombre += parseFloat(invSet.final_hombre) || 0;
          mMermaMujer += parseFloat(invSet.mermas_mujer) || 0;
          mMermaHombre += parseFloat(invSet.mermas_hombre) || 0;
          fletesTotal += parseFloat(invSet.fletes) || 0;
        }
      });

      return {
        vMujer,
        vHombre,
        expSum,
        cMujer,
        cHombre,
        iIniMujer,
        iIniHombre,
        iFinMujer,
        iFinHombre,
        mMermaMujer,
        mMermaHombre,
        fletesTotal,
        allExp,
        allPur,
      };
    };

    let agg;
    if (finMode === "mensual") {
      if (!periodoMensual) return;
      const [year, month] = periodoMensual.split("-").map(Number);
      const monthData = await fetchMonthData(year, month);
      agg = aggregateData([monthData]);
    } else {
      if (!periodoAnual) return;
      const year = parseInt(periodoAnual, 10);
      const monthPromises = Array.from({ length: 12 }, (_, i) =>
        fetchMonthData(year, i + 1)
      );
      const allMonths = await Promise.all(monthPromises);
      agg = aggregateData(allMonths);
    }

    setFinData({
      ...finData, // Mantiene la tasa_impuesto
      vbrutas_mujer: agg.vMujer,
      vbrutas_hombre: agg.vHombre,
      dev_mujer: 0,
      dev_hombre: 0, // Las devoluciones siempre empiezan en 0 para edición manual
      invini_mujer: agg.iIniMujer,
      invini_hombre: agg.iIniHombre,
      compra_mujer: agg.cMujer,
      compra_hombre: agg.cHombre,
      fletes: agg.fletesTotal,
      invfin_mujer: agg.iFinMujer,
      invfin_hombre: agg.iFinHombre,
      merma_mujer: agg.mMermaMujer,
      merma_hombre: agg.mMermaHombre,
      gas_renta: agg.expSum["Renta"],
      gas_nmina: agg.expSum["Sueldos Ventas"],
      gas_publi: agg.expSum["Publicidad"],
      gas_servicios: agg.expSum["Servicios"],
      gas_pos: agg.expSum["Comisiones POS"],
      gas_admin: agg.expSum["Sueldos Admin"],
      gas_software: agg.expSum["Licencias Software"],
      gas_depre: agg.expSum["Depreciacion"],
      gas_finan: 0,
      otros_ing: 0,
    });

    const mergedLogs = [];
    agg.allExp.forEach((e) =>
      mergedLogs.push({
        id: e.id,
        type: "Gasto",
        desc: `${e.categoria}: ${e.descripcion}`,
        val: e.monto,
        date: e.fecha,
      })
    );
    agg.allPur.forEach((p) =>
      mergedLogs.push({
        id: p.id,
        type: "Compra",
        desc: `Proveedor (${p.linea}): ${p.descripcion}`,
        val: p.monto,
        date: p.fecha,
      })
    );
    mergedLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    setRegistrosAuxiliares(mergedLogs);

    setLoading(false);
  };

  const handleInputChange = (field, value) => {
    setFinData((prev) => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  // ─── CÁLCULOS DERIVADOS (Reactivos) ───
  const vNetasTotal =
    finData.vbrutas_mujer -
    finData.dev_mujer +
    (finData.vbrutas_hombre - finData.dev_hombre);
  const cVentasTotal =
    finData.invini_mujer +
    finData.invini_hombre +
    (finData.compra_mujer + finData.compra_hombre) +
    finData.fletes -
    (finData.invfin_mujer + finData.invfin_hombre) +
    (finData.merma_mujer + finData.merma_hombre);
  const uBruta = vNetasTotal - cVentasTotal;

  const gOperacionTotal =
    finData.gas_renta +
    finData.gas_nmina +
    finData.gas_publi +
    finData.gas_servicios +
    finData.gas_pos +
    finData.gas_admin +
    finData.gas_software +
    finData.gas_depre;
  const uOperativa = uBruta - gOperacionTotal;

  const uAntesImpuestos = uOperativa - finData.gas_finan + finData.otros_ing;
  const impuestoTotal =
    uAntesImpuestos > 0 ? uAntesImpuestos * (finData.tasa_impuesto / 100) : 0;
  const uNeta = uAntesImpuestos - impuestoTotal;

  const cashIngresos = vNetasTotal;
  const cashEgresos =
    cVentasTotal +
    gOperacionTotal -
    (finData.invini_mujer + finData.invini_hombre) +
    (finData.invfin_mujer + finData.invfin_hombre);
  const cashNeto = cashIngresos - cashEgresos;

  const marginPct = vNetasTotal > 0 ? (uNeta / vNetasTotal) * 100 : 0;

  // ─── REGISTRAR GASTO / COMPRA (BASE DE DATOS) ───
  const submitFinGasto = async () => {
    if (!gastoDesc || !gastoMonto)
      return showToast("Completa descripción y monto.", "warning");

    let logDate = new Date().toISOString().split("T")[0];
    if (finMode === "mensual") {
      const todayMes = new Date().toISOString().slice(0, 7);
      if (todayMes !== periodoMensual) logDate = `${periodoMensual}-15`;
    }

    const { error } = await supabase.from("finanzas_gastos").insert({
      sucursal_id: sucursalFilter || null,
      categoria: gastoCat,
      descripcion: gastoDesc,
      monto: parseFloat(gastoMonto),
      fecha: logDate,
    });

    if (error) showToast("Error al registrar gasto", "error");
    else {
      showToast("Gasto registrado");
      setGastoDesc("");
      setGastoMonto("");
      loadFinancialModel();
    }
  };

  const submitFinCompra = async () => {
    if (!compraDesc || !compraMonto)
      return showToast("Completa descripción y monto.", "warning");

    let logDate = new Date().toISOString().split("T")[0];
    if (finMode === "mensual") {
      const todayMes = new Date().toISOString().slice(0, 7);
      if (todayMes !== periodoMensual) logDate = `${periodoMensual}-15`;
    }

    const { error } = await supabase.from("finanzas_compras").insert({
      sucursal_id: sucursalFilter || null,
      linea: compraLinea,
      descripcion: compraDesc,
      monto: parseFloat(compraMonto),
      fecha: logDate,
    });

    if (error) showToast("Error al registrar compra", "error");
    else {
      showToast("Compra registrada");
      setCompraDesc("");
      setCompraMonto("");
      loadFinancialModel();
    }
  };

  // ─── IMPRESIÓN DEL ESTADO DE RESULTADOS (FORMATO PDF) ───
  const printFinancialStatement = () => {
    const printWindow = window.open("", "_blank");
    const now = new Date();
    const printDate =
      now.toLocaleDateString("es-BO") +
      " a las " +
      now.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });

    // Obtenemos el nombre real de la sucursal filtrada
    const sucursalName = sucursalFilter
      ? sucursales.find((s) => s.id === sucursalFilter)?.nombre || "Desconocida"
      : "Todas las sucursales (Consolidado)";

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Estado de Resultados - ${tituloPeriodo}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #111; margin: 30px; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { font-size: 16px; margin: 0 0 4px 0; font-weight: 900; letter-spacing: 1px;}
          .header h2 { font-size: 13px; margin: 0 0 4px 0; color: #444; }
          .header p { font-size: 11px; color: #666; margin: 0; }
          .meta-box { border: 1px solid #ddd; padding: 12px; margin-bottom: 20px; font-size: 11px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #fafafa;}
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { padding: 7px 8px; border-bottom: 1px solid #eee; text-align: left; }
          .section-title { background: #f8fafc; font-weight: bold; font-size: 11px; border-bottom: 2px solid #ddd; border-top: 1px solid #ddd;}
          .sub-title { font-weight: bold; color: #444; font-size: 10px; padding-left: 15px;}
          .item { padding-left: 20px; color: #333; }
          .val { text-align: right; }
          .total-row { font-weight: bold; font-size: 12px; border-top: 2px solid #111; border-bottom: 2px solid #111; }
          .highlight { font-weight: bold; font-size: 12px; background: #f1f5f9; border-bottom: 1px solid #111;}
          .footer-box { border: 1px solid #ddd; padding: 15px; margin-top: 20px; background: #faf5ff; }
          .footer-text { text-align: center; font-size: 10px; color: #888; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;}
        </style>
      </head>
      <body>
        <div class="header">
          <h1>STAR'S & ESTRELLA JEANS</h1>
          <h2>PANEL DE ADMINISTRACIÓN</h2>
          <h3 style="margin: 10px 0 5px 0;">ESTADO DE RESULTADOS (P&L)</h3>
          <p>Monitoreo de ingresos, costos y utilidades operativas del período</p>
        </div>
        
        <div class="meta-box">
          <div><strong>Margen de Utilidad:</strong> ${marginPct.toFixed(
            1
          )}%</div>
          <div><strong>Período:</strong> ${tituloPeriodo}</div>
          <div><strong>Sucursal:</strong> ${sucursalName}</div>
          <div><strong>Impreso:</strong> ${printDate}</div>
        </div>

        <table>
          <tr class="section-title"><td colspan="2">(+) INGRESOS OPERATIVOS</td></tr>
          <tr><td class="item">(+) Ventas Brutas - Ropa de Mujer</td><td class="val">Bs ${finData.vbrutas_mujer.toFixed(
            2
          )}</td></tr>
          <tr><td class="item">(+) Ventas Brutas - Ropa de Hombre</td><td class="val">Bs ${finData.vbrutas_hombre.toFixed(
            2
          )}</td></tr>
          <tr><td class="item">(-) Devoluciones y Descuentos - Mujer</td><td class="val" style="color:#d9381e">-Bs ${finData.dev_mujer.toFixed(
            2
          )}</td></tr>
          <tr><td class="item">(-) Devoluciones y Descuentos - Hombre</td><td class="val" style="color:#d9381e">-Bs ${finData.dev_hombre.toFixed(
            2
          )}</td></tr>
          <tr class="total-row"><td>(=) VENTAS NETAS TOTALES</td><td class="val">Bs ${vNetasTotal.toFixed(
            2
          )}</td></tr>

          <tr class="section-title"><td colspan="2">(-) COSTO DE VENTAS (CMV)</td></tr>
          <tr><td class="item">(+) Inventario Inicial - Mujer</td><td class="val">Bs ${finData.invini_mujer.toFixed(
            2
          )}</td></tr>
          <tr><td class="item">(+) Inventario Inicial - Hombre</td><td class="val">Bs ${finData.invini_hombre.toFixed(
            2
          )}</td></tr>
          <tr><td class="item">(+) Compras - Mujer</td><td class="val">Bs ${finData.compra_mujer.toFixed(
            2
          )}</td></tr>
          <tr><td class="item">(+) Compras - Hombre</td><td class="val">Bs ${finData.compra_hombre.toFixed(
            2
          )}</td></tr>
          <tr><td class="item">(+) Fletes y Gastos Logísticos</td><td class="val">Bs ${finData.fletes.toFixed(
            2
          )}</td></tr>
          <tr><td class="item">(-) Inventario Final - Mujer</td><td class="val" style="color:#d9381e">-Bs ${finData.invfin_mujer.toFixed(
            2
          )}</td></tr>
          <tr><td class="item">(-) Inventario Final - Hombre</td><td class="val" style="color:#d9381e">-Bs ${finData.invfin_hombre.toFixed(
            2
          )}</td></tr>
          <tr><td class="item">(+) Pérdidas por Mermas - Mujer</td><td class="val">Bs ${finData.merma_mujer.toFixed(
            2
          )}</td></tr>
          <tr><td class="item">(+) Pérdidas por Mermas - Hombre</td><td class="val">Bs ${finData.merma_hombre.toFixed(
            2
          )}</td></tr>
          <tr class="total-row"><td>(=) COSTO DE VENTAS TOTAL</td><td class="val">Bs ${cVentasTotal.toFixed(
            2
          )}</td></tr>

          <tr class="highlight"><td>(=) UTILIDAD BRUTA</td><td class="val">Bs ${uBruta.toFixed(
            2
          )}</td></tr>

          <tr class="section-title"><td colspan="2">(-) GASTOS DE OPERACIÓN</td></tr>
          <tr><td colspan="2" class="sub-title">A. Gastos de Venta</td></tr>
          <tr><td class="item">Arrendamiento/Renta locales</td><td class="val" style="color:#d9381e">-Bs ${finData.gas_renta.toFixed(
            2
          )}</td></tr>
          <tr><td class="item">Sueldos y comisiones de ventas</td><td class="val" style="color:#d9381e">-Bs ${finData.gas_nmina.toFixed(
            2
          )}</td></tr>
          <tr><td class="item">Publicidad y Marketing</td><td class="val" style="color:#d9381e">-Bs ${finData.gas_publi.toFixed(
            2
          )}</td></tr>
          <tr><td class="item">Servicios públicos de tienda</td><td class="val" style="color:#d9381e">-Bs ${finData.gas_servicios.toFixed(
            2
          )}</td></tr>
          <tr><td class="item">Comisiones pasarelas de pago/POS</td><td class="val" style="color:#d9381e">-Bs ${finData.gas_pos.toFixed(
            2
          )}</td></tr>
          
          <tr><td colspan="2" class="sub-title">B. Gastos de Administración</td></tr>
          <tr><td class="item">Sueldos administrativos y directivos</td><td class="val" style="color:#d9381e">-Bs ${finData.gas_admin.toFixed(
            2
          )}</td></tr>
          <tr><td class="item">Licencias software</td><td class="val" style="color:#d9381e">-Bs ${finData.gas_software.toFixed(
            2
          )}</td></tr>
          <tr><td class="item">Depreciación de activos fijos</td><td class="val" style="color:#d9381e">-Bs ${finData.gas_depre.toFixed(
            2
          )}</td></tr>
          <tr class="total-row"><td>(=) TOTAL GASTOS DE OPERACIÓN</td><td class="val" style="color:#d9381e">-Bs ${gOperacionTotal.toFixed(
            2
          )}</td></tr>

          <tr class="highlight"><td>(=) UTILIDAD OPERATIVA (EBITDA)</td><td class="val">Bs ${uOperativa.toFixed(
            2
          )}</td></tr>

          <tr class="section-title"><td colspan="2">(-) RESULTADO FINANCIERO Y OTROS</td></tr>
          <tr><td class="item">(-) Gastos Financieros (Intereses créditos)</td><td class="val" style="color:#d9381e">-Bs ${finData.gas_finan.toFixed(
            2
          )}</td></tr>
          <tr><td class="item">(+) Otros Ingresos no operativos</td><td class="val">Bs ${finData.otros_ing.toFixed(
            2
          )}</td></tr>
          <tr class="total-row"><td>(=) UTILIDAD ANTES DE IMPUESTOS</td><td class="val">Bs ${uAntesImpuestos.toFixed(
            2
          )}</td></tr>

          <tr><td class="item">(-) Impuesto sobre las ganancias (${
            finData.tasa_impuesto
          }%)</td><td class="val" style="color:#d9381e">-Bs ${impuestoTotal.toFixed(
      2
    )}</td></tr>
          
          <tr class="highlight" style="font-size: 14px; background: #111; color: #fff;">
            <td style="padding: 10px;">(=) UTILIDAD NETA DEL EJERCICIO</td>
            <td class="val" style="padding: 10px;">Bs ${uNeta.toFixed(2)}</td>
          </tr>
        </table>

        <div class="footer-box">
          <h3 style="margin-top:0; color:#581c87; font-size:13px;">Flujo de Caja vs. Utilidad</h3>
          <table style="margin:0; border:none;">
            <tr><td style="border:none; padding:3px 0;">Cobros Reales Recaudados (Caja):</td><td style="border:none; text-align:right;">Bs ${cashIngresos.toFixed(
              2
            )}</td></tr>
            <tr><td style="border:none; padding:3px 0;">Pagos Reales Proveedores/Gastos:</td><td style="border:none; text-align:right;">Bs ${cashEgresos.toFixed(
              2
            )}</td></tr>
            <tr><td style="border:none; padding:5px 0 0 0; font-weight:bold; border-top:1px solid #ccc; margin-top:5px; color:#111">LIQUIDEZ NETO (Flujo Caja):</td><td style="border:none; text-align:right; font-weight:bold; border-top:1px solid #ccc; padding:5px 0 0 0; color:#111">Bs ${cashNeto.toFixed(
              2
            )}</td></tr>
          </table>
        </div>

        <div class="footer-text">
          STAR'S & ESTRELLA JEANS - Sistema de Administración<br>
          Generado el ${printDate}
        </div>
        
        <script>
          window.onload = function() { setTimeout(function() { window.print(); }, 500); }
        </script>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Helper para el título
  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  let tituloPeriodo = "—";
  if (finMode === "mensual" && periodoMensual) {
    const [y, m] = periodoMensual.split("-");
    tituloPeriodo = `${monthNames[parseInt(m) - 1]} ${y}`;
  } else if (finMode === "anual" && periodoAnual) {
    tituloPeriodo = `Año ${periodoAnual}`;
  }

  return (
    <>
      {toast.show && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <div className="page-header">
        <div className="page-breadcrumb">ADMINISTRACION / FINANZAS</div>
        <div className="page-title">Estado de Resultados (P&L)</div>
        <div className="page-subtitle">
          Monitoreo de ingresos, costos y utilidades operativas segregados por
          género en tiempo real.
        </div>
      </div>

      {/* MONTH & CONFIG BAR */}
      <div className="card" style={{ marginBottom: "20px", padding: "20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "15px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "15px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                background: "#f1f5f9",
                borderRadius: "8px",
                padding: "3px",
                gap: "2px",
              }}
            >
              <button
                onClick={() => setFinMode("mensual")}
                style={{
                  padding: "5px 14px",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: finMode === "mensual" ? "#0f172a" : "transparent",
                  color: finMode === "mensual" ? "#fff" : "#64748b",
                  transition: "all .2s",
                }}
              >
                Mensual
              </button>
              <button
                onClick={() => setFinMode("anual")}
                style={{
                  padding: "5px 14px",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: finMode === "anual" ? "#0f172a" : "transparent",
                  color: finMode === "anual" ? "#fff" : "#64748b",
                  transition: "all .2s",
                }}
              >
                Anual
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>
                Período:
              </span>
              {finMode === "mensual" ? (
                <input
                  type="month"
                  className="form-input"
                  style={{
                    padding: "6px",
                    fontSize: "0.88rem",
                    width: "160px",
                    height: "auto",
                  }}
                  value={periodoMensual}
                  onChange={(e) => setPeriodoMensual(e.target.value)}
                />
              ) : (
                <input
                  type="number"
                  className="form-input"
                  min="2020"
                  max="2099"
                  style={{
                    padding: "6px",
                    fontSize: "0.88rem",
                    width: "100px",
                    height: "auto",
                  }}
                  value={periodoAnual}
                  onChange={(e) => setPeriodoAnual(e.target.value)}
                />
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>
                Sucursal:
              </span>
              <select
                className="form-select"
                style={{
                  padding: "6px",
                  fontSize: "0.88rem",
                  height: "auto",
                  width: "220px",
                }}
                value={sucursalFilter}
                onChange={(e) => setSucursalFilter(e.target.value)}
              >
                <option value="">Todas las sucursales (Consolidado)</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "30px",
                fontWeight: 800,
                fontSize: "0.85rem",
                background:
                  marginPct >= 50
                    ? "#d1fae5"
                    : marginPct >= 40
                    ? "#fef3c7"
                    : "#fee2e2",
                color:
                  marginPct >= 50
                    ? "#065f46"
                    : marginPct >= 40
                    ? "#92400e"
                    : "#991b1b",
              }}
            >
              Margen de Utilidad: {marginPct.toFixed(1)}%
            </div>
            <button
              onClick={printFinancialStatement}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 18px",
                background: "#0f172a",
                color: "#ffffff",
                border: "none",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "background .2s",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ width: "15px", height: "15px" }}
              >
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              Imprimir Estado
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "20px",
          alignItems: "start",
        }}
      >
        {/* ESTADO DE RESULTADOS CARD */}
        <div className="card" style={{ padding: "20px", overflowX: "auto" }}>
          <h3
            style={{
              fontSize: "1.1rem",
              fontWeight: 800,
              color: "var(--text-primary)",
              marginBottom: "15px",
              borderBottom: "2px solid #e2e8f0",
              paddingBottom: "8px",
            }}
          >
            Estado de Resultados — <span>{tituloPeriodo}</span>
          </h3>

          <table
            className="table"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.88rem",
            }}
          >
            <tbody>
              {/* 1. INGRESOS */}
              <tr
                style={{
                  background: "#f8fafc",
                  fontWeight: 800,
                  color: "#1e293b",
                }}
              >
                <td
                  colSpan="3"
                  style={{
                    padding: "10px 8px",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  (+) INGRESOS OPERATIVOS
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "8px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  (+) Ventas Brutas - Ropa de Mujer
                </td>
                <td style={{ width: "180px", padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.vbrutas_mujer}
                    onChange={(e) =>
                      handleInputChange("vbrutas_mujer", e.target.value)
                    }
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    width: "120px",
                    padding: "8px",
                  }}
                >
                  Bs {finData.vbrutas_mujer.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "8px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  (+) Ventas Brutas - Ropa de Hombre
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.vbrutas_hombre}
                    onChange={(e) =>
                      handleInputChange("vbrutas_hombre", e.target.value)
                    }
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    padding: "8px",
                  }}
                >
                  Bs {finData.vbrutas_hombre.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "8px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  (-) Devoluciones y Descuentos - Ropa de Mujer
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.dev_mujer}
                    onChange={(e) =>
                      handleInputChange("dev_mujer", e.target.value)
                    }
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    color: "var(--red)",
                    padding: "8px",
                  }}
                >
                  -Bs {finData.dev_mujer.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "8px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  (-) Devoluciones y Descuentos - Ropa de Hombre
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.dev_hombre}
                    onChange={(e) =>
                      handleInputChange("dev_hombre", e.target.value)
                    }
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    color: "var(--red)",
                    padding: "8px",
                  }}
                >
                  -Bs {finData.dev_hombre.toFixed(2)}
                </td>
              </tr>
              <tr
                style={{
                  fontWeight: 800,
                  borderTop: "2px solid #cbd5e1",
                  borderBottom: "2px solid #cbd5e1",
                  color: "#0f172a",
                }}
              >
                <td style={{ padding: "10px 8px" }}>
                  (=) VENTAS NETAS TOTALES
                </td>
                <td style={{ padding: "10px 8px" }}></td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "10px 8px",
                    fontSize: "0.95rem",
                  }}
                >
                  Bs {vNetasTotal.toFixed(2)}
                </td>
              </tr>

              {/* 2. COSTO DE VENTAS */}
              <tr
                style={{
                  background: "#f8fafc",
                  fontWeight: 800,
                  color: "#1e293b",
                }}
              >
                <td
                  colSpan="3"
                  style={{
                    padding: "10px 8px",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  (-) COSTO DE VENTAS (CMV)
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "8px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  (+) Inventario Inicial - Ropa de Mujer
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.invini_mujer}
                    onChange={(e) =>
                      handleInputChange("invini_mujer", e.target.value)
                    }
                    disabled={finMode === "anual"}
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    padding: "8px",
                  }}
                >
                  Bs {finData.invini_mujer.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "8px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  (+) Inventario Inicial - Ropa de Hombre
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.invini_hombre}
                    onChange={(e) =>
                      handleInputChange("invini_hombre", e.target.value)
                    }
                    disabled={finMode === "anual"}
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    padding: "8px",
                  }}
                >
                  Bs {finData.invini_hombre.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "8px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  (+) Compras - Ropa de Mujer
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.compra_mujer}
                    onChange={(e) =>
                      handleInputChange("compra_mujer", e.target.value)
                    }
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    padding: "8px",
                  }}
                >
                  Bs {finData.compra_mujer.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "8px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  (+) Compras - Ropa de Hombre
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.compra_hombre}
                    onChange={(e) =>
                      handleInputChange("compra_hombre", e.target.value)
                    }
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    padding: "8px",
                  }}
                >
                  Bs {finData.compra_hombre.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "8px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  (+) Fletes y Gastos Logísticos
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.fletes}
                    onChange={(e) =>
                      handleInputChange("fletes", e.target.value)
                    }
                    disabled={finMode === "anual"}
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    padding: "8px",
                  }}
                >
                  Bs {finData.fletes.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "8px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  (-) Inventario Final - Ropa de Mujer
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.invfin_mujer}
                    onChange={(e) =>
                      handleInputChange("invfin_mujer", e.target.value)
                    }
                    disabled={finMode === "anual"}
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    color: "var(--red)",
                    padding: "8px",
                  }}
                >
                  -Bs {finData.invfin_mujer.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "8px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  (-) Inventario Final - Ropa de Hombre
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.invfin_hombre}
                    onChange={(e) =>
                      handleInputChange("invfin_hombre", e.target.value)
                    }
                    disabled={finMode === "anual"}
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    color: "var(--red)",
                    padding: "8px",
                  }}
                >
                  -Bs {finData.invfin_hombre.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "8px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  (+) Pérdidas por Mermas y Robo - Mujer
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.merma_mujer}
                    onChange={(e) =>
                      handleInputChange("merma_mujer", e.target.value)
                    }
                    disabled={finMode === "anual"}
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    padding: "8px",
                  }}
                >
                  Bs {finData.merma_mujer.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "8px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  (+) Pérdidas por Mermas y Robo - Hombre
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.merma_hombre}
                    onChange={(e) =>
                      handleInputChange("merma_hombre", e.target.value)
                    }
                    disabled={finMode === "anual"}
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    padding: "8px",
                  }}
                >
                  Bs {finData.merma_hombre.toFixed(2)}
                </td>
              </tr>
              <tr
                style={{
                  fontWeight: 800,
                  borderTop: "2px solid #cbd5e1",
                  borderBottom: "2px solid #cbd5e1",
                  color: "#0f172a",
                }}
              >
                <td style={{ padding: "10px 8px" }}>
                  (=) COSTO DE VENTAS TOTAL
                </td>
                <td style={{ padding: "10px 8px" }}></td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "10px 8px",
                    fontSize: "0.95rem",
                  }}
                >
                  Bs {cVentasTotal.toFixed(2)}
                </td>
              </tr>

              {/* 3. UTILIDAD BRUTA */}
              <tr
                style={{
                  fontWeight: 850,
                  background: "#f1f5f9",
                  color: "#0f172a",
                  borderBottom: "2.5px solid #0f172a",
                }}
              >
                <td style={{ padding: "12px 8px", fontSize: "0.95rem" }}>
                  (=) UTILIDAD BRUTA
                </td>
                <td style={{ padding: "12px 8px" }}></td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "12px 8px",
                    fontSize: "1.05rem",
                    color: uBruta >= 0 ? "#16a34a" : "#dc2626",
                  }}
                >
                  Bs {uBruta.toFixed(2)}
                </td>
              </tr>

              {/* 4. GASTOS DE OPERACION */}
              <tr
                style={{
                  background: "#f8fafc",
                  fontWeight: 800,
                  color: "#1e293b",
                }}
              >
                <td
                  colSpan="3"
                  style={{
                    padding: "10px 8px",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  (-) GASTOS DE OPERACIÓN
                </td>
              </tr>

              <tr style={{ fontWeight: 700, color: "#475569" }}>
                <td
                  colSpan="3"
                  style={{ padding: "6px 16px", fontSize: "0.8rem" }}
                >
                  A. Gastos de Venta:
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "6px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  - Arrendamiento/Renta locales
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.gas_renta}
                    onChange={(e) =>
                      handleInputChange("gas_renta", e.target.value)
                    }
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "6px 8px",
                    color: "var(--red)",
                  }}
                >
                  -Bs {finData.gas_renta.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "6px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  - Sueldos y comisiones de ventas
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.gas_nmina}
                    onChange={(e) =>
                      handleInputChange("gas_nmina", e.target.value)
                    }
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "6px 8px",
                    color: "var(--red)",
                  }}
                >
                  -Bs {finData.gas_nmina.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "6px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  - Publicidad y Marketing
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.gas_publi}
                    onChange={(e) =>
                      handleInputChange("gas_publi", e.target.value)
                    }
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "6px 8px",
                    color: "var(--red)",
                  }}
                >
                  -Bs {finData.gas_publi.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "6px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  - Servicios públicos de tienda
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.gas_servicios}
                    onChange={(e) =>
                      handleInputChange("gas_servicios", e.target.value)
                    }
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "6px 8px",
                    color: "var(--red)",
                  }}
                >
                  -Bs {finData.gas_servicios.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "6px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  - Comisiones pasarelas de pago/POS
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.gas_pos}
                    onChange={(e) =>
                      handleInputChange("gas_pos", e.target.value)
                    }
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "6px 8px",
                    color: "var(--red)",
                  }}
                >
                  -Bs {finData.gas_pos.toFixed(2)}
                </td>
              </tr>

              <tr style={{ fontWeight: 700, color: "#475569" }}>
                <td
                  colSpan="3"
                  style={{ padding: "6px 16px", fontSize: "0.8rem" }}
                >
                  B. Gastos de Administración:
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "6px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  - Sueldos administrativo y directivo
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.gas_admin}
                    onChange={(e) =>
                      handleInputChange("gas_admin", e.target.value)
                    }
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "6px 8px",
                    color: "var(--red)",
                  }}
                >
                  -Bs {finData.gas_admin.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "6px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  - Licencias software (ERP/ERP/Web)
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.gas_software}
                    onChange={(e) =>
                      handleInputChange("gas_software", e.target.value)
                    }
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "6px 8px",
                    color: "var(--red)",
                  }}
                >
                  -Bs {finData.gas_software.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "6px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  - Depreciación de activos fijos
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.gas_depre}
                    onChange={(e) =>
                      handleInputChange("gas_depre", e.target.value)
                    }
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "6px 8px",
                    color: "var(--red)",
                  }}
                >
                  -Bs {finData.gas_depre.toFixed(2)}
                </td>
              </tr>
              <tr
                style={{
                  fontWeight: 800,
                  borderTop: "2px solid #cbd5e1",
                  borderBottom: "2px solid #cbd5e1",
                  color: "#0f172a",
                }}
              >
                <td style={{ padding: "10px 8px" }}>
                  (=) TOTAL GASTOS DE OPERACIÓN
                </td>
                <td style={{ padding: "10px 8px" }}></td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "10px 8px",
                    fontSize: "0.95rem",
                    color: "var(--red)",
                  }}
                >
                  -Bs {gOperacionTotal.toFixed(2)}
                </td>
              </tr>

              {/* 5. UTILIDAD OPERATIVA */}
              <tr
                style={{
                  fontWeight: 850,
                  background: "#f1f5f9",
                  color: "#0f172a",
                  borderBottom: "2.5px solid #0f172a",
                }}
              >
                <td style={{ padding: "12px 8px", fontSize: "0.95rem" }}>
                  (=) UTILIDAD OPERATIVA (EBITDA / EBIT)
                </td>
                <td style={{ padding: "12px 8px" }}></td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "12px 8px",
                    fontSize: "1.05rem",
                    color: uOperativa >= 0 ? "#16a34a" : "#dc2626",
                  }}
                >
                  Bs {uOperativa.toFixed(2)}
                </td>
              </tr>

              {/* 6. RESULTADOS FINANCIEROS Y OTROS */}
              <tr
                style={{
                  background: "#f8fafc",
                  fontWeight: 800,
                  color: "#1e293b",
                }}
              >
                <td
                  colSpan="3"
                  style={{
                    padding: "10px 8px",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  (-) RESULTADO FINANCIERO Y OTROS
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "8px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  (-) Gastos Financieros (Intereses créditos)
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.gas_finan}
                    onChange={(e) =>
                      handleInputChange("gas_finan", e.target.value)
                    }
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "6px 8px",
                    color: "var(--red)",
                  }}
                >
                  -Bs {finData.gas_finan.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "8px 24px",
                    color: "var(--text-secondary)",
                  }}
                >
                  (+) Otros Ingresos no operativos
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.otros_ing}
                    onChange={(e) =>
                      handleInputChange("otros_ing", e.target.value)
                    }
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "6px 8px",
                    color: "#16a34a",
                  }}
                >
                  Bs {finData.otros_ing.toFixed(2)}
                </td>
              </tr>
              <tr
                style={{
                  fontWeight: 800,
                  borderTop: "2px solid #cbd5e1",
                  borderBottom: "2.5px solid #cbd5e1",
                  color: "#0f172a",
                }}
              >
                <td style={{ padding: "10px 8px" }}>
                  (=) UTILIDAD ANTES DE IMPUESTOS
                </td>
                <td style={{ padding: "10px 8px" }}></td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "10px 8px",
                    fontSize: "0.95rem",
                  }}
                >
                  Bs {uAntesImpuestos.toFixed(2)}
                </td>
              </tr>

              {/* 7. IMPUESTOS */}
              <tr>
                <td
                  style={{
                    padding: "10px 8px",
                    color: "var(--text-secondary)",
                  }}
                >
                  (-) Impuesto sobre las ganancias (%)
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    value={finData.tasa_impuesto}
                    onChange={(e) =>
                      handleInputChange("tasa_impuesto", e.target.value)
                    }
                  />
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "10px 8px",
                    color: "var(--red)",
                  }}
                >
                  -Bs {impuestoTotal.toFixed(2)}
                </td>
              </tr>

              {/* 8. UTILIDAD NETA */}
              <tr
                style={{
                  fontWeight: 900,
                  background: "#0f172a",
                  color: "#ffffff",
                  borderRadius: "8px",
                }}
              >
                <td style={{ padding: "15px 12px", fontSize: "1.05rem" }}>
                  (=) UTILIDAD NETA DEL EJERCICIO
                </td>
                <td style={{ padding: "15px 12px" }}></td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "15px 12px",
                    fontSize: "1.2rem",
                    color: uNeta >= 0 ? "#4ade80" : "#f87171",
                  }}
                >
                  Bs {uNeta.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* LATERAL SUB-PANELS (DATA LOGGERS) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="card" style={{ padding: "20px" }}>
            <h3
              style={{
                fontSize: "1rem",
                fontWeight: 800,
                color: "var(--text-primary)",
                marginBottom: "12px",
              }}
            >
              Registros Auxiliares
            </h3>
            <p
              style={{
                fontSize: "0.78rem",
                color: "var(--text-secondary)",
                marginBottom: "15px",
              }}
            >
              Apunta gastos diarios o compras del proveedor para alimentar el
              Estado de Resultados.
            </p>

            <div style={{ display: "flex", gap: "8px", marginBottom: "15px" }}>
              <button
                className={`btn btn-tab-fin ${
                  subTab === "gasto" ? "active" : ""
                }`}
                onClick={() => setSubTab("gasto")}
                style={{
                  flex: 1,
                  padding: "6px",
                  fontSize: "0.75rem",
                  border: "1px solid var(--border)",
                  background: subTab === "gasto" ? "var(--black)" : "none",
                  color: subTab === "gasto" ? "var(--white)" : "inherit",
                }}
              >
                Registrar Gasto
              </button>
              <button
                className={`btn btn-tab-fin ${
                  subTab === "compra" ? "active" : ""
                }`}
                onClick={() => setSubTab("compra")}
                style={{
                  flex: 1,
                  padding: "6px",
                  fontSize: "0.75rem",
                  border: "1px solid var(--border)",
                  background: subTab === "compra" ? "var(--black)" : "none",
                  color: subTab === "compra" ? "var(--white)" : "inherit",
                }}
              >
                Registrar Compra
              </button>
            </div>

            {subTab === "gasto" && (
              <div>
                <div className="form-group" style={{ marginBottom: "10px" }}>
                  <label className="form-label" style={{ fontSize: "0.75rem" }}>
                    Categoría de Gasto
                  </label>
                  <select
                    className="form-select"
                    style={{
                      padding: "6px",
                      fontSize: "0.85rem",
                      height: "auto",
                    }}
                    value={gastoCat}
                    onChange={(e) => setGastoCat(e.target.value)}
                  >
                    <option value="Renta">Arrendamiento/Renta</option>
                    <option value="Sueldos Ventas">Sueldos Ventas</option>
                    <option value="Publicidad">Publicidad/Mkt</option>
                    <option value="Servicios">Servicios Públicos</option>
                    <option value="Comisiones POS">
                      Comisiones POS/Pasarelas
                    </option>
                    <option value="Sueldos Admin">Sueldos Admin</option>
                    <option value="Licencias Software">
                      Licencias Software
                    </option>
                    <option value="Depreciacion">Depreciación</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: "10px" }}>
                  <label className="form-label" style={{ fontSize: "0.75rem" }}>
                    Descripción / Beneficiario
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ padding: "6px", fontSize: "0.85rem" }}
                    placeholder="Ej: Renta de sucursal centro"
                    value={gastoDesc}
                    onChange={(e) => setGastoDesc(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: "12px" }}>
                  <label className="form-label" style={{ fontSize: "0.75rem" }}>
                    Monto (Bs)
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    style={{ padding: "6px", fontSize: "0.85rem" }}
                    placeholder="Ej: 2500"
                    value={gastoMonto}
                    onChange={(e) => setGastoMonto(e.target.value)}
                  />
                </div>
                <button
                  className="btn btn-primary"
                  onClick={submitFinGasto}
                  style={{ width: "100%", fontSize: "0.8rem", padding: "8px" }}
                >
                  Guardar Gasto
                </button>
              </div>
            )}

            {subTab === "compra" && (
              <div>
                <div className="form-group" style={{ marginBottom: "10px" }}>
                  <label className="form-label" style={{ fontSize: "0.75rem" }}>
                    Línea de Ropa (Género)
                  </label>
                  <select
                    className="form-select"
                    style={{
                      padding: "6px",
                      fontSize: "0.85rem",
                      height: "auto",
                    }}
                    value={compraLinea}
                    onChange={(e) => setCompraLinea(e.target.value)}
                  >
                    <option value="Mujer">Ropa de Mujer (Estrella)</option>
                    <option value="Hombre">Ropa de Hombre (Varón)</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: "10px" }}>
                  <label className="form-label" style={{ fontSize: "0.75rem" }}>
                    Proveedor / Insumos
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ padding: "6px", fontSize: "0.85rem" }}
                    placeholder="Ej: Adquisición 50 jeans de mezclilla"
                    value={compraDesc}
                    onChange={(e) => setCompraDesc(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: "12px" }}>
                  <label className="form-label" style={{ fontSize: "0.75rem" }}>
                    Monto Total de Compra (Bs)
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    style={{ padding: "6px", fontSize: "0.85rem" }}
                    placeholder="Ej: 8000"
                    value={compraMonto}
                    onChange={(e) => setCompraMonto(e.target.value)}
                  />
                </div>
                <button
                  className="btn btn-primary"
                  onClick={submitFinCompra}
                  style={{
                    width: "100%",
                    fontSize: "0.8rem",
                    padding: "8px",
                    backgroundColor: "#3b82f6",
                    borderColor: "#3b82f6",
                  }}
                >
                  Guardar Compra
                </button>
              </div>
            )}
          </div>

          <div
            className="card"
            style={{ padding: "20px", maxHeight: "300px", overflowY: "auto" }}
          >
            <h3
              style={{
                fontSize: "1rem",
                fontWeight: 800,
                color: "var(--text-primary)",
                marginBottom: "10px",
              }}
            >
              Registros del Período
            </h3>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {loading ? (
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.75rem",
                    textAlign: "center",
                  }}
                >
                  Cargando...
                </p>
              ) : registrosAuxiliares.length === 0 ? (
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.75rem",
                    textAlign: "center",
                  }}
                >
                  No hay registros para mostrar.
                </p>
              ) : (
                registrosAuxiliares.map((log) => (
                  <div
                    key={`${log.type}-${log.id}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      padding: "8px",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                    }}
                  >
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "180px",
                      }}
                    >
                      <span
                        className="badge"
                        style={{
                          background:
                            log.type === "Gasto" ? "#fee2e2" : "#dbeafe",
                          color: log.type === "Gasto" ? "#991b1b" : "#1e40af",
                          fontSize: "0.6rem",
                          padding: "2px 4px",
                          marginRight: "4px",
                        }}
                      >
                        {log.type}
                      </span>
                      <strong>{log.desc}</strong>
                    </div>
                    <span style={{ fontWeight: 700, color: "#0f172a" }}>
                      Bs {parseFloat(log.val).toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: "20px",
              background: "#faf5ff",
              border: "1px solid #f3e8ff",
            }}
          >
            <h3
              style={{
                fontSize: "1.05rem",
                fontWeight: 800,
                color: "#581c87",
                marginBottom: "10px",
              }}
            >
              Flujo de Caja vs. Utilidad
            </h3>
            <p
              style={{
                fontSize: "0.75rem",
                color: "#6b21a8",
                marginBottom: "15px",
              }}
            >
              Verifica la liquidez y cobros reales frente al P&L devengado de
              este mes.
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
                fontSize: "0.85rem",
              }}
            >
              <span style={{ color: "#6b21a8" }}>
                Cobros Reales Recaudados (Caja):
              </span>
              <span style={{ fontWeight: 700, color: "#581c87" }}>
                Bs {cashIngresos.toFixed(2)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "12px",
                fontSize: "0.85rem",
              }}
            >
              <span style={{ color: "#6b21a8" }}>
                Pagos Reales Proveedores/Gastos:
              </span>
              <span style={{ fontWeight: 700, color: "#581c87" }}>
                Bs {cashEgresos.toFixed(2)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px solid #e9d5ff",
                paddingTop: "8px",
                fontSize: "0.9rem",
                fontWeight: 800,
              }}
            >
              <span style={{ color: "#581c87" }}>
                LIQUIDEZ NETO (Flujo Caja):
              </span>
              <span style={{ color: cashNeto >= 0 ? "#15803d" : "#b91c1c" }}>
                Bs {cashNeto.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
