
import { GoogleGenAI } from "@google/genai";
import { Order } from "../types";

export const analyzeOrders = async (orders: Order[], date: string, scope: string = 'Global', customInstruction?: string): Promise<string> => {
  try {
    // La clave es inyectada automáticamente por la plataforma en process.env.API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Preparación de métricas rápidas para el contexto de la IA
    const totalTriples = orders.reduce((acc, o) => acc + o.qtyTriples, 0);
    const totalSimples = orders.reduce((acc, o) => acc + o.qtySimples, 0);
    const readyPercent = orders.length > 0 
      ? Math.round((orders.filter(o => o.location).length / orders.length) * 100) 
      : 0;

    const prompt = `
      SOS UN EXPERTO LOGÍSTICO EN UNA SANDWICHERÍA.
      Analiza estos datos para el día ${date} (Sector: ${scope}):
      - Total Comandas: ${orders.length}
      - Detalle: ${totalTriples} Triples y ${totalSimples} Simples.
      - Estado de Producción: ${readyPercent}% de los pedidos ya tienen ubicación asignada.
      
      Instrucción específica del usuario: "${customInstruction || 'Hacé un balance logístico rápido.'}"
      
      Responde brevemente en español (Argentina). Si detectás cuellos de botella (pocos pedidos ubicados a pesar de ser tarde), avisale al usuario.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Análisis completado sin texto de respuesta.";
  } catch (error: any) {
    console.error("Error crítico de IA:", error);
    
    // Si la clave no está presente en el proceso de construcción de Vercel
    if (!process.env.API_KEY || process.env.API_KEY === "undefined") {
        return "⚠️ CLAVE NO ENCONTRADA: Asegurate de haber agregado 'API_KEY' en la configuración de Vercel y que el último 'Redeploy' haya terminado con éxito.";
    }

    return `⚠️ ERROR DE IA: ${error.message || 'No se pudo conectar con Gemini'}. Verificá los créditos de tu API Key.`;
  }
};
