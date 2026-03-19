import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import { config } from "../config/index.js";

const SYSTEM_CONTEXT = `You are Stella's Assistant, an AI specialized in helping Stella Jimenez — a business innovation and digital transformation consultant — build her professional website and manage her consultancy.

About Stella:
- She helps leaders and organizations turn vision into impact by connecting technology, design, purpose, and people
- Services: Business Diagnosis & Discovery, Digital Product Design, Innovation Strategy & Digital Transformation
- Target clients: C-suite executives, mid-to-large companies, entrepreneurs, startups
- Brand: Professional, approachable, forward-thinking, human-centered

Your capabilities:
1. Generate complete webpage content (hero sections, about, services, testimonials, CTAs)
2. Create clean, semantic HTML/CSS for website components
3. Write compelling copy that matches Stella's brand voice
4. Suggest layouts and design improvements
5. Help with CRM data organization and insights
6. Assist with deployment configurations

Always produce output that matches:
- Stella's professional yet approachable tone
- Clean, minimal design aesthetic (Apple minimalism + Swiss typography)
- Human-centered messaging
- Action-oriented language`;

export interface GeminiMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

export interface GeneratePageResult {
  html: string;
  css: string;
  components: unknown[];
  suggestions: string[];
}

class GeminiService {
  private client: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;

  private getClient(): GoogleGenerativeAI {
    if (!this.client) {
      if (!config.gemini.apiKey) {
        throw new Error("Gemini API key not configured. Please add GEMINI_API_KEY to your .env file.");
      }
      this.client = new GoogleGenerativeAI(config.gemini.apiKey);
    }
    return this.client;
  }

  private getModel(): GenerativeModel {
    if (!this.model) {
      this.model = this.getClient().getGenerativeModel({
        model: config.gemini.model,
        systemInstruction: SYSTEM_CONTEXT,
      });
    }
    return this.model;
  }

  async chat(
    messages: GeminiMessage[],
    userMessage: string
  ): Promise<string> {
    const model = this.getModel();
    const chat = model.startChat({ history: messages });
    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  }

  async generatePageContent(prompt: string): Promise<GeneratePageResult> {
    const model = this.getModel();
    const fullPrompt = `Generate a complete webpage component based on this request: "${prompt}"

    Return a JSON object with this structure:
    {
      "html": "complete semantic HTML",
      "css": "clean CSS styles",
      "components": [array of component configs],
      "suggestions": ["improvement suggestion 1", "improvement suggestion 2"]
    }

    Use a clean, minimal design. Prefer CSS Grid/Flexbox. Use system fonts or Google Fonts (Inter preferred).
    Make sure the HTML is production-ready and accessible.`;

    const result = await model.generateContent(fullPrompt);
    const text = result.response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) ??
      text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const jsonStr = jsonMatch[1] ?? jsonMatch[0];
      return JSON.parse(jsonStr) as GeneratePageResult;
    }

    return {
      html: text,
      css: "",
      components: [],
      suggestions: [],
    };
  }

  async generateCopy(
    type: "hero" | "about" | "services" | "cta" | "bio" | "testimonial",
    context?: string
  ): Promise<string> {
    const model = this.getModel();
    const prompts: Record<typeof type, string> = {
      hero: `Write a compelling hero section headline and subheadline for Stella Jimenez's consultancy. ${context ?? ""}`,
      about: `Write an engaging 'About Stella' section that highlights her expertise and human-centered approach. ${context ?? ""}`,
      services: `Write descriptions for Stella's three core services: Business Diagnosis, Digital Product Design, and Innovation Strategy. ${context ?? ""}`,
      cta: `Write 3 compelling call-to-action phrases for Stella's consultancy website. ${context ?? ""}`,
      bio: `Write a professional yet personal bio for Stella Jimenez as an innovation consultant. ${context ?? ""}`,
      testimonial: `Write 2 realistic client testimonials for Stella's innovation consulting services. ${context ?? ""}`,
    };

    const result = await model.generateContent(prompts[type]);
    return result.response.text();
  }

  async analyzeCrmData(data: unknown): Promise<string> {
    const model = this.getModel();
    const prompt = `Analyze this CRM data and provide insights, patterns, and recommendations for Stella's consultancy:

    ${JSON.stringify(data, null, 2)}

    Focus on: client patterns, pipeline health, opportunities, and actionable recommendations.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  async suggestDeployConfig(
    projectType: string,
    targetInfo: string
  ): Promise<string> {
    const model = this.getModel();
    const prompt = `Suggest the optimal deployment configuration for a ${projectType} website deployment to: ${targetInfo}

    Include: file permissions, .htaccess rules (if Apache), caching headers, and any security considerations.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  async streamChat(
    messages: GeminiMessage[],
    userMessage: string,
    onChunk: (text: string) => void
  ): Promise<void> {
    const model = this.getModel();
    const chat = model.startChat({ history: messages });
    const stream = await chat.sendMessageStream(userMessage);

    for await (const chunk of stream.stream) {
      const text = chunk.text();
      if (text) onChunk(text);
    }
  }
}

export const geminiService = new GeminiService();
