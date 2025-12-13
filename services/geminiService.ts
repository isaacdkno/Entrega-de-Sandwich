import { GoogleGenAI } from "@google/genai";
import { Order } from "../types";

export const analyzeOrders = async (orders: Order[], date: string, scope: string = 'Global', customInstruction?: string): Promise<string> => {
  // Robust API Key retrieval for Vite/Vercel environments
  let apiKey = '';
  
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_API_KEY) {
      // @ts-ignore
      apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    } 
    // Fallback to process.env for other build systems or strict adherence
    else if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      apiKey = process.env.API_KEY;
    }
  } catch (e) {
    console.warn("Error accessing environment variables", e);
  }

  if (!apiKey) {
    console.error("API Key is missing. Please configure VITE_GOOGLE_API_KEY in Vercel.");
    return "Error: API Key no configurada en el servidor. Configure VITE_GOOGLE_API_KEY en Vercel.";
  }

  const ai = new GoogleGenAI({ apiKey });

  // Calculate Order Status Metrics
  const totalOrders = orders.length;
  const ordersWithLocation = orders.filter(o => o.location).length;
  const ordersDelivered = orders.filter(o => o.deliveredAt).length;
  const ordersPendingLocation = totalOrders - ordersWithLocation;

  // Calculate Sandwich Unit Metrics
  const totalTriples = orders.reduce((acc, o) => acc + o.qtyTriples, 0);
  const producedTriples = orders.filter(o => o.location).reduce((acc, o) => acc + o.qtyTriples, 0);
  
  const totalSimples = orders.reduce((acc, o) => acc + o.qtySimples, 0);
  const producedSimples = orders.filter(o => o.location).reduce((acc, o) => acc + o.qtySimples, 0);

  // Prepare a summarized data set for the AI to minimize token usage but maximize context
  const hourlyLoad: Record<string, any> = {};
  
  // Create a detailed string representation of ALL orders so the AI can "read" specific records
  // We format this to be token-efficient but informative
  const ordersListText = orders.map(o => {
      const hour = o.pickupTime ? o.pickupTime.split(':')[0] : 'Unknown';
      
      // Hourly aggregation logic
      if (!hourlyLoad[hour]) hourlyLoad[hour] = { triples: 0, simples: 0, count: 0 };
      hourlyLoad[hour].triples += o.qtyTriples;
      hourlyLoad[hour].simples += o.qtySimples;
      hourlyLoad[hour].count += 1;

      // Individual Record String
      return `- ID: ${o.id} | Cliente: ${o.customerName} | Hora: ${o.pickupTime} | Items: ${o.qtyTriples}T/${o.qtySimples}S | Estado: ${o.status} | Ubic: ${o.location || 'N/A'} | Pago: ${o.paymentStatus} | Fabrica: ${o.originBranch} | Notas: ${o.notes || '---'}`;
  }).join('\n');

  let prompt = `
    Act as a logistics manager for a sandwich factory using Gemini 2.5 Flash.
    **IMPORTANT: ALWAYS RESPOND IN SPANISH (Argentina).**
    
    Here is the current status for the date: ${date}.
    **Report Scope: ${scope}**
    
    **Orders Overview:**
    - Total Orders: ${totalOrders}
    - Orders Completed (Produced): ${ordersWithLocation}
    - Orders Delivered: ${ordersDelivered}
    - Orders Pending Production: ${ordersPendingLocation}

    **Production Output (Units):**
    - Triples: ${producedTriples} made / ${totalTriples} total required.
    - Simples: ${producedSimples} made / ${totalSimples} total required.

    **Hourly Load Distribution (Hour: Volume):**
    ${JSON.stringify(hourlyLoad)}

    **FULL DETAILED ORDER LIST (DATA SOURCE):**
    ${ordersListText}
  `;

  if (customInstruction && customInstruction.trim() !== '') {
      prompt += `\n\nUSER QUESTION/INSTRUCTION: "${customInstruction}"\n
      Based on the provided data (summary and detailed list), answer the user's specific question.
      You have access to specific IDs, names, and notes in the 'FULL DETAILED ORDER LIST' section.
      **Output Language: Spanish.** Be concise and data-driven.`;
  } else {
      prompt += `\n\nPlease provide a brief, strategic executive summary (max 100 words) in Spanish for the factory team. 
      Identify bottlenecks (e.g., specific hours with high load or pending items) and suggest focus areas. Be encouraging but direct.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error connecting to AI service. Please check your API Key or internet connection.";
  }
};