
import { GoogleGenAI } from "@google/genai";
import { Order } from "../types";

export const analyzeOrders = async (orders: Order[], date: string, scope: string = 'Global', customInstruction?: string): Promise<string> => {
  // Inicialización del cliente justo antes de usarlo para capturar la API Key más reciente
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("An API Key must be set when running in a browser. Por favor, selecciona una API Key en el panel de IA.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Cálculo de métricas
  const totalOrders = orders.length;
  const ordersWithLocation = orders.filter(o => o.location).length;
  const totalTriples = orders.reduce((acc, o) => acc + o.qtyTriples, 0);
  const totalSimples = orders.reduce((acc, o) => acc + o.qtySimples, 0);

  // Reducción de datos para el prompt
  const dataSummary = orders.slice(0, 50).map(o => 
    `#${o.id}: ${o.pickupTime} - ${o.qtyTriples}T/${o.qtySimples}S - ${o.status}`
  ).join('\n');

  const prompt = `
    Analiza la logística de sándwiches para ${date} (${scope}).
    Métricas: ${totalOrders} pedidos, ${ordersWithLocation} listos.
    Totales: ${totalTriples} triples, ${totalSimples} simples.
    
    Datos parciales:
    ${dataSummary}

    ${customInstruction && customInstruction.trim() !== '' 
      ? `Responde a esta pregunta del usuario: "${customInstruction}"` 
      : 'Dame un resumen ejecutivo muy breve con recomendaciones de producción.'
    }
    
    Responde de forma concisa en español de Argentina.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    if (!response || !response.text) {
      return "No se recibió respuesta del asistente. Intente nuevamente.";
    }

    return response.text;
  } catch (error: any) {
    console.error("Gemini Error:", error);
    const errorMsg = error.message || "Error desconocido";
    
    if (errorMsg.includes("429")) return "⚠️ Límite de cuota excedido. Esperá un minuto.";
    if (errorMsg.includes("API key")) {
        throw new Error("API Key inválida o no configurada.");
    }
    
    return `Error de conexión: ${errorMsg}`;
  }
};
