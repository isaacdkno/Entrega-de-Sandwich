import { GoogleGenAI } from "@google/genai";
import { Order } from "../types";

export const analyzeOrders = async (orders: Order[], date: string, scope: string = 'Global', customInstruction?: string): Promise<string> => {
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    return "Error: No se detectó la API Key de Google.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const totalTriples = orders.reduce((acc, o) => acc + o.qtyTriples, 0);
    const totalSimples = orders.reduce((acc, o) => acc + o.qtySimples, 0);
    const totalOrders = orders.length;
    const readyOrders = orders.filter(o => o.location).length;
    const readyPercent = totalOrders > 0 ? Math.round((readyOrders / totalOrders) * 100) : 0;

    const branchSummary = orders.reduce((acc: any, o) => {
      acc[o.pickupBranch] = (acc[o.pickupBranch] || 0) + (o.qtyTriples + o.qtySimples);
      return acc;
    }, {});

    const dataContext = `
      DATOS OPERATIVOS (${date} - ${scope}):
      - Comandas: ${totalOrders}
      - Unidades: ${totalTriples} Triples, ${totalSimples} Simples.
      - Ubicación: ${readyPercent}% de los pedidos ya tienen lugar asignado.
      - Distribución: ${JSON.stringify(branchSummary)}
      - Pregunta Usuario: ${customInstruction || 'Dar balance general.'}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: dataContext }] }],
      config: {
        systemInstruction: "Sos el asistente logístico de una sandwichería tucumana para los días 24 y 31 de diciembre. Tu misión es analizar si la producción va bien o si hay demoras. Respondé en español tucumano/argentino profesional, muy breve y al punto. No inventes datos que no estén en el contexto.",
        temperature: 0.5,
      },
    });

    return response.text || "No se pudo generar el análisis.";

  } catch (error: any) {
    console.error("Gemini Error:", error);
    return `⚠️ Error de la IA: ${error.message}`;
  }
};