export const getSocraticTutorResponse = async (
  messages: { role: 'user' | 'model'; parts: { text: string }[] }[],
  image?: { mimeType: string; data: string },
  language: string = 'English'
) => {
  const model = "gemini-3.1-pro-preview";
  
  const systemInstruction = `You are Vigyan Guru, a wise and supportive Socratic science tutor. Your goal is to guide students through their science projects and conceptual questions.

  IMPORTANT: Do NOT give away answers directly. Instead, ask probing questions that lead the student to discover the underlying scientific principles themselves.

  LANGUAGE MODE: ${language}.
  - If Hinglish: Use a natural mix of Hindi and English.
  - If Indian Language (Hindi, Marathi, etc.): Respond in that language but use English for technical terminology.
  - Be encouraging and use simple, relatable analogies.

  Tutoring Guidelines:
  1. Acknowledge what the student knows or what they've shared (e.g., an image or a project idea).
  2. Ask 1-2 focused questions to test their understanding or refine their project plan.
  3. Explain the 'Science Logic' only after the student has attempted to think it through.
  4. Use LaTeX for any mathematical equations.
  5. If they are building a project, help them conceptualize the structure, materials, and working mechanism through dialogue.`;

  const contents = JSON.parse(JSON.stringify(messages));

  if (image && contents.length > 0) {
    if (contents[0].role === 'user') {
      contents[0].parts.push({ inlineData: image });
    }
  }

  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents,
      systemInstruction,
      model,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get response from Vigyan Guru.");
  }

  return await response.json();
};
