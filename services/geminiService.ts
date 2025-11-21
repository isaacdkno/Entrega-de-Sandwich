import { GoogleGenAI } from "@google/genai";
import { Order } from "../types";

export const analyzeOrders = async (orders: Order[], date: string, scope: string = 'Global', customInstruction?: string): Promise<string> => {
  // Robust API Key retrieval for Vite/Vercel environments
  // We check import.meta.env.VITE_GOOGLE_API_KEY first as that is the standard for Vercel deployments
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
  // We group hourly load to give the AI context on bottlenecks
  const hourlyLoad: Record<string, any> = {};
  orders.forEach(o => {
      const hour = o.pickupTime ? o.pickupTime.split(':')[0] : 'Unknown';
      if (!hourlyLoad[hour]) hourlyLoad[hour] = { triples: 0, simples: 0, count: 0 };
      hourlyLoad[hour].triples += o.qtyTriples;
      hourlyLoad[hour].simples += o.qtySimples;
      hourlyLoad[hour].count += 1;
  });

  let prompt = `
    Act as a logistics manager for a sandwich factory. 
    **IMPORTANT: ALWAYS RESPOND IN SPANISH (Argentina).**
    
    Here is the current status for the date: ${date}.
    **Report Scope: ${scope}**
    
    **Orders Overview:**
    - Total Orders: ${totalOrders}
    - Orders Completed (Produced): ${ordersWithLocation}
    - Orders Delivered: ${ordersDelivered}
    - Orders Pending Production: ${ordersPendingLocation}

    **Production Output (Units):**
    - Triples: ${producedTriples} made / ${totalTriples} total required. (${totalTriples - producedTriples} pending)
    - Simples: ${producedSimples} made / ${totalSimples} total required. (${totalSimples - producedSimples} pending)

    **Hourly Load Distribution (Hour: Volume):**
    ${JSON.stringify(hourlyLoad)}
  `;

  if (customInstruction && customInstruction.trim() !== '') {
      prompt += `\n\nUSER QUESTION/INSTRUCTION: "${customInstruction}"\n
      Based strictly on the provided data, answer the user's specific question or follow their instruction. 
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