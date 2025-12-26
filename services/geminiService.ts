
import { GoogleGenAI } from "@google/genai";
import { Order } from "../types";

export const analyzeOrders = async (orders: Order[], date: string, scope: string = 'Global', customInstruction?: string): Promise<string> => {
  // Inicialización directa. 
  const apiKey = process.env.API_KEY || "";
  const ai = new GoogleGenAI({ apiKey });

  // Preparación de datos métricos detallados
  const totalTriples = orders.reduce((acc, o) => acc + o.qtyTriples, 0);
  const totalSimples = orders.reduce((acc, o) => acc + o.qtySimples, 0);
  const totalUnits = totalTriples + totalSimples;
  const readyPercent = orders.length > 0 
    ? Math.round((orders.filter(o => o.location).length / orders.length) * 100) 
    : 0;

  const prompt = `
    SOS UN EXPERTO LOGÍSTICO EN UNA SANDWICHERÍA DE ALTO VOLUMEN.
    Analiza estos datos para el día ${date} (Sector: ${scope}):
    
    - TOTAL COMANDAS: ${orders.length}
    - TOTAL UNIDADES: ${totalUnits} sándwiches.
    - DETALLE: ${totalTriples} Triples y ${totalSimples} Simples.
    - PROGRESO: ${readyPercent}% de los pedidos ya están ubicados y listos.
    
    Pregunta del usuario: "${customInstruction || 'Hacé un balance de la carga de trabajo y avisame si hay mucha demora proyectada.'}"
    
    Respuesta: Breve, al grano, estilo informe de WhatsApp empresarial, en español de Argentina.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "No hay comentarios por ahora.";
  } catch (error: any) {
    console.error("Error de IA:", error);
    if (!apiKey) {
      return "⚠️ CONFIGURACIÓN PENDIENTE: Entrá a Vercel > Settings > Environment Variables y cargá la clave con el nombre API_KEY.";
    }
    return `⚠️ Error de conexión con Gemini: ${error.message}`;
  }
};
