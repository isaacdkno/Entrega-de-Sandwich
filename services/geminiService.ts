
import { GoogleGenAI } from "@google/genai";
import { Order } from "../types";

export const analyzeOrders = async (orders: Order[], date: string, scope: string = 'Global', customInstruction?: string): Promise<string> => {
  // Obtenemos la clave de las variables de entorno de Vercel
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    return "⚠️ IA NO DETECTADA: La clave ya está en Vercel, pero falta un paso. Por favor, andá a la pestaña 'Deployments' en Vercel y hacé un 'Redeploy' del proyecto para activarla.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Preparación de datos métricos
    const totalTriples = orders.reduce((acc, o) => acc + o.qtyTriples, 0);
    const totalSimples = orders.reduce((acc, o) => acc + o.qtySimples, 0);
    const readyPercent = orders.length > 0 
      ? Math.round((orders.filter(o => o.location).length / orders.length) * 100) 
      : 0;

    const prompt = `
      SOS UN EXPERTO LOGÍSTICO EN UNA SANDWICHERÍA.
      Analiza estos datos para el día ${date} (Sector: ${scope}):
      - Comandas: ${orders.length}
      - Detalle: ${totalTriples} Triples y ${totalSimples} Simples.
      - Ubicados: ${readyPercent}% listos.
      
      Pregunta: "${customInstruction || 'Hacé un balance rápido.'}"
      
      Responde brevemente en español de Argentina.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Análisis completado.";
  } catch (error: any) {
    console.error("Error de IA:", error);
    return `⚠️ Error de Gemini: ${error.message}. Verificá la validez de la clave.`;
  }
};
