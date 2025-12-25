
import { GoogleGenAI } from "@google/genai";
import { Order } from "../types";

export const analyzeOrders = async (orders: Order[], date: string, scope: string = 'Global', customInstruction?: string): Promise<string> => {
  // Inicialización del cliente con la API Key del entorno
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Cálculo de métricas generales
  const totalOrders = orders.length;
  const ordersWithLocation = orders.filter(o => o.location).length;
  const ordersDelivered = orders.filter(o => o.status === 'Entregado').length;
  
  const totalTriples = orders.reduce((acc, o) => acc + o.qtyTriples, 0);
  const totalSimples = orders.reduce((acc, o) => acc + o.qtySimples, 0);

  // Agregación horaria para análisis de carga
  const hourlyLoad: Record<string, any> = {};
  const ordersListText = orders.slice(0, 100).map(o => { // Limitamos a los primeros 100 para evitar exceder tokens
      const hour = o.pickupTime ? o.pickupTime.split(':')[0] : 'Desconocida';
      if (!hourlyLoad[hour]) hourlyLoad[hour] = { t: 0, s: 0, c: 0 };
      hourlyLoad[hour].t += o.qtyTriples;
      hourlyLoad[hour].s += o.qtySimples;
      hourlyLoad[hour].c += 1;

      return `- #${o.id} | ${o.customerName} | ${o.pickupTime} | ${o.qtyTriples}T/${o.qtySimples}S | ${o.status} | ${o.location || 'Sin Ubic'} | Pago: ${o.paymentStatus}`;
  }).join('\n');

  const prompt = `
    Eres un experto en logística de una fábrica de sándwiches de miga.
    Analiza los siguientes datos para la fecha: ${date} (${scope}).

    RESUMEN GENERAL:
    - Comandas Totales: ${totalOrders}
    - Producidas (con ubicación): ${ordersWithLocation}
    - Entregadas: ${ordersDelivered}
    - Unidades Totales requeridas: ${totalTriples} Triples, ${totalSimples} Simples.

    DISTRIBUCIÓN POR HORA (Hora: {t: Triples, s: Simples, c: Comandas}):
    ${JSON.stringify(hourlyLoad)}

    LISTADO DETALLADO (Muestra parcial):
    ${ordersListText}

    ${customInstruction && customInstruction.trim() !== '' 
      ? `PREGUNTA ESPECÍFICA DEL USUARIO: "${customInstruction}"` 
      : 'Proporciona un resumen ejecutivo breve (máximo 120 palabras) con recomendaciones estratégicas para el equipo de producción y despacho. Identifica cuellos de botella basándote en las horas pico.'
    }

    Responde siempre en ESPAÑOL (Argentina), de forma directa, profesional y basada exclusivamente en los datos proporcionados.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Modelo Pro para mejor razonamiento logístico
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        topP: 0.95,
      }
    });

    // Validamos que exista respuesta antes de acceder a .text
    if (!response || !response.text) {
      return "El servicio de IA no devolvió contenido. Por favor, intente con una consulta más específica.";
    }

    return response.text;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    // Manejo de errores específicos
    if (error.message?.includes('429')) {
      return "⚠️ Se ha alcanzado el límite de consultas (Quota Exceeded). Por favor, espere un momento antes de reintentar.";
    }
    if (error.message?.includes('API key')) {
      return "⚠️ Error de configuración: API Key no válida o no encontrada.";
    }
    
    return "No se pudo conectar con el servicio de IA. Verifique su conexión a internet.";
  }
};
