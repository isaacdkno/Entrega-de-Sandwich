
import { GoogleGenAI } from "@google/genai";
import { Order } from "../types";

export const analyzeOrders = async (orders: Order[], date: string, scope: string = 'Global', customInstruction?: string): Promise<string> => {
  try {
    // Inicialización siguiendo la regla de crear la instancia justo antes del uso
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Preparación de métricas para el contexto
    const totalTriples = orders.reduce((acc, o) => acc + o.qtyTriples, 0);
    const totalSimples = orders.reduce((acc, o) => acc + o.qtySimples, 0);
    const totalOrders = orders.length;
    const readyOrders = orders.filter(o => o.location).length;
    const readyPercent = totalOrders > 0 ? Math.round((readyOrders / totalOrders) * 100) : 0;

    // Resumen de sucursales para que la IA entienda la distribución
    const branchSummary = orders.reduce((acc: any, o) => {
      acc[o.pickupBranch] = (acc[o.pickupBranch] || 0) + (o.qtyTriples + o.qtySimples);
      return acc;
    }, {});

    const dataContext = `
      DATOS DEL DÍA ${date} (${scope}):
      - Total Comandas: ${totalOrders}
      - Unidades Totales: ${totalTriples} Triples, ${totalSimples} Simples.
      - Estado de Ubicación: ${readyPercent}% (${readyOrders} de ${totalOrders} pedidos ya ubicados).
      - Distribución por Sucursal: ${JSON.stringify(branchSummary)}
      - Instrucción del usuario: ${customInstruction || 'Proporcionar un balance logístico general.'}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: dataContext }] }],
      config: {
        systemInstruction: "Sos un experto en logística de una sandwichería de alta demanda en Tucumán, Argentina. Tu objetivo es analizar los datos de producción y entrega para los días 24 y 31 de diciembre. Debés ser breve, directo y usar un tono profesional pero local (español de Argentina). Si el porcentaje de ubicación es bajo (menos del 50%) y hay muchos pedidos, debés alertar sobre un posible cuello de botella en fábrica.",
        temperature: 0.7,
        topP: 0.95,
      },
    });

    // Acceso directo a la propiedad .text según las nuevas directrices
    if (!response.text) {
        return "El asistente no pudo generar un análisis en este momento. Reintentá por favor.";
    }

    return response.text;
  } catch (error: any) {
    console.error("Error crítico de Gemini API:", error);
    
    // Diagnóstico detallado para el usuario
    const errorMessage = error.message || 'Error desconocido';
    
    if (errorMessage.includes('403') || errorMessage.includes('API_KEY_INVALID')) {
        return "⚠️ ERROR DE CLAVE: La API Key de Gemini no es válida o no tiene permisos. Verificá la configuración de la plataforma.";
    }
    
    if (errorMessage.includes('429')) {
        return "⚠️ LÍMITE ALCANZADO: Se han realizado demasiadas consultas seguidas. Esperá un minuto y volvé a intentar.";
    }

    if (errorMessage.includes('fetch')) {
        return "⚠️ ERROR DE RED: No se pudo conectar con los servidores de Google. Comprobá tu conexión a internet.";
    }

    return `⚠️ ERROR TÉCNICO IA: ${errorMessage}`;
  }
};
