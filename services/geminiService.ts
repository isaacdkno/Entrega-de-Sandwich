
import { GoogleGenAI } from "@google/genai";
import { Order } from "../types";

export const analyzeOrders = async (orders: Order[], date: string, scope: string = 'Global', customInstruction?: string): Promise<string> => {
  // Validación explícita de la API Key antes de inicializar
  if (!process.env.API_KEY || process.env.API_KEY === 'undefined' || process.env.API_KEY.length < 5) {
      throw new Error("No se detectó una API Key válida. Debés vincular tu cuenta.");
  }

  try {
    // Fixed: Initialize GoogleGenAI right before the call to use the most recent API key from process.env.API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
      DATOS DEL DÍA ${date} (${scope}):
      - Total Comandas: ${totalOrders}
      - Unidades Totales: ${totalTriples} Triples, ${totalSimples} Simples.
      - Estado de Ubicación: ${readyPercent}% (${readyOrders} de ${totalOrders} pedidos ya ubicados).
      - Distribución por Sucursal: ${JSON.stringify(branchSummary)}
      - Instrucción del usuario: ${customInstruction || 'Proporcionar un balance logístico general.'}
    `;

    // Fixed: Simplified contents to follow the ai.models.generateContent({ model, contents }) pattern.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: dataContext,
      config: {
        systemInstruction: "Sos un experto en logística de una sandwichería de alta demanda en Tucumán, Argentina. Tu objetivo es analizar los datos de producción y entrega para los días 24 y 31 de diciembre. Debés ser breve, directo y usar un tono profesional pero local (español de Argentina). Si el porcentaje de ubicación es bajo (menos del 50%) y hay muchos pedidos, debés alertar sobre un posible cuello de botella en fábrica.",
        temperature: 0.7,
        topP: 0.95,
      },
    });

    // Fixed: Accessed .text property directly (not a method).
    if (!response.text) {
        return "El asistente no pudo generar un análisis en este momento. Reintentá por favor.";
    }

    return response.text;
  } catch (error: any) {
    console.error("Error crítico de Gemini API:", error);
    
    const errorMessage = error.message || 'Error desconocido';
    
    if (errorMessage.includes('API Key') || errorMessage.includes('403') || errorMessage.includes('invalid_key')) {
        throw new Error("API Key inválida o inexistente. Por favor, vinculá tu cuenta de Google Cloud.");
    }
    
    if (errorMessage.includes('429')) {
        return "⚠️ LÍMITE ALCANZADO: Se han realizado demasiadas consultas seguidas. Esperá un minuto.";
    }

    return `⚠️ ERROR TÉCNICO IA: ${errorMessage}`;
  }
};
