
import { GoogleGenAI } from "@google/genai";
import { Order } from "../types";

export const analyzeOrders = async (orders: Order[], date: string, scope: string = 'Global', customInstruction?: string): Promise<string> => {
  // Verificación estricta de la API Key para evitar el error de SDK en navegador
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === 'null' || apiKey.length < 10) {
      throw new Error("⚠️ IA DESCONECTADA: No se detectó una API Key válida. Por favor, hacé clic en 'Vincular Cuenta' en el panel inferior.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const totalTriples = orders.reduce((acc, o) => acc + o.qtyTriples, 0);
    const totalSimples = orders.reduce((acc, o) => acc + o.qtySimples, 0);
    const totalOrders = orders.length;
    
    // Encontrar pedidos máximos para responder preguntas específicas del usuario
    const maxTriples = orders.length > 0 ? Math.max(...orders.map(o => o.qtyTriples)) : 0;
    const maxSimples = orders.length > 0 ? Math.max(...orders.map(o => o.qtySimples)) : 0;
    
    const readyOrders = orders.filter(o => o.location).length;
    const readyPercent = totalOrders > 0 ? Math.round((readyOrders / totalOrders) * 100) : 0;

    const branchSummary = orders.reduce((acc: any, o) => {
      acc[o.pickupBranch] = (acc[o.pickupBranch] || 0) + (o.qtyTriples + o.qtySimples);
      return acc;
    }, {});

    const dataContext = `
      CONTEXTO OPERATIVO (${date} - ${scope}):
      - Total Comandas: ${totalOrders}
      - Unidades: ${totalTriples} Triples, ${totalSimples} Simples.
      - Ubicación: ${readyPercent}% listos.
      - Picos de volumen: El pedido más grande tiene ${maxTriples} triples y ${maxSimples} simples.
      - Distribución Sucursales: ${JSON.stringify(branchSummary)}
      - Pregunta/Instrucción: ${customInstruction || 'Resumen logístico general.'}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: dataContext }] }],
      config: {
        systemInstruction: "Sos un experto en logística de una sandwichería en Tucumán. Analizás datos para los días 24 y 31 de diciembre. Respondé de forma muy breve (máximo 3 párrafos), profesional y usando términos locales. Si el usuario pregunta por cantidades específicas (ej: 'pedidos de más de X'), revisá los datos de 'Picos de volumen' proporcionados y confirmá si existen o no.",
        temperature: 0.6,
        topP: 0.9,
      },
    });

    if (!response.text) {
        return "El asistente procesó los datos pero la respuesta está vacía. Reintentá.";
    }

    return response.text;
  } catch (error: any) {
    console.error("Gemini Error:", error);
    
    const msg = error.message || '';
    
    // Captura específica del error de Google SDK en navegador si el check inicial falla por algún motivo
    if (msg.includes('API Key') || msg.includes('browser')) {
        throw new Error("⚠️ LLAVE NO VÁLIDA: La conexión con Google falló. Volvé a vincular tu cuenta usando el botón naranja.");
    }
    
    if (msg.includes('429')) {
        return "⚠️ DEMASIADOS PEDIDOS: Estamos procesando muchas solicitudes. Esperá 30 segundos.";
    }

    return `⚠️ ERROR TÉCNICO IA: ${msg}`;
  }
};
