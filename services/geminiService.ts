
import { GoogleGenAI } from "@google/genai";
import { Order } from "../types";

export const analyzeOrders = async (orders: Order[], date: string, scope: string = 'Global', customInstruction?: string): Promise<string> => {
  // Inicialización directa. 
  // Si la API_KEY no está en el entorno, el SDK lanzará el error que capturaremos abajo.
  const apiKey = process.env.API_KEY || "";
  const ai = new GoogleGenAI({ apiKey });

  // Preparación de datos simplificada para el prompt
  const stats = {
    total: orders.length,
    triples: orders.reduce((acc, o) => acc + o.qtyTriples, 0),
    simples: orders.reduce((acc, o) => acc + o.qtySimples, 0),
    listos: orders.filter(o => o.location).length
  };

  const prompt = `
    Como experto en logística de una sandwichería, analiza estos datos para el ${date} (Sector: ${scope}):
    - Total Pedidos: ${stats.total}
    - Triples: ${stats.triples}
    - Simples: ${stats.simples}
    - Ya ubicados/listos: ${stats.listos}
    
    Pregunta o instrucción específica: "${customInstruction || 'Dame un resumen rápido de la situación y consejos de producción.'}"
    
    Responde de forma muy breve (máximo 3 párrafos), profesional y en español de Argentina.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "No pude generar un análisis en este momento.";
  } catch (error: any) {
    console.error("Error de IA:", error);
    if (!apiKey) {
      return "⚠️ ERROR: No se detectó la API_KEY en el servidor. Asegúrate de que esté configurada en Vercel.";
    }
    return `Ocurrió un error al consultar la IA: ${error.message}`;
  }
};
