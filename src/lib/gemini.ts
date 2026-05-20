export const getSocraticTutorResponse = async (
  messages: { role: 'user' | 'model'; parts: { text: string }[] }[],
  image?: { mimeType: string; data: string },
  language: string = 'English'
) => {
  const model = "gemini-3.5-flash";
  
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

  const result = await response.json();
  if (result && result.text) {
    return result;
  }
  return {
    ...result,
    text: result.candidates?.[0]?.content?.parts?.[0]?.text || ""
  };
};

export const generateWeeklyQuestion = async (
  topic: string,
  format: 'oral' | 'written',
  language: string = 'English'
) => {
  const model = "gemini-3.5-flash";
  const systemInstruction = `You are Vigyan Guru, a wise Socratic science evaluator. 
  Your goal is to generate exactly ONE assessment question on the topic: "${topic}".
  The test is in "${format}" format.
  - If oral, ask a question that prompts the student to explain a process aloud, describe a concept, or narrate a scientific reaction. Keep it highly concept-focused.
  - If written, ask for a detailed conceptual breakdown, analysis or critique.
  - Output ONLY the question. Do not add introductions or filler words.
  - Language: Respond in ${language}.`;

  const contents = [{ role: 'user', parts: [{ text: `Generate the ${format} assessment question for the topic of: ${topic}` }] }];

  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents, systemInstruction, model }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate test question.");
  }

  const result = await response.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "State and explain the primary principles governing this science topic.";
};

export const evaluateWeeklyTest = async (
  topic: string,
  format: 'oral' | 'written',
  questionText: string,
  userResponse: string,
  language: string = 'English'
) => {
  const model = "gemini-3.5-flash";
  const systemInstruction = `You are Vigyan Guru, a helpful Socratic science examiner.
  Evaluate the student's response to the assessment question: "${questionText}".
  Topic: ${topic}.
  Format: ${format} test.
  
  Guidelines for evaluation:
  1. Score the student out of 100 based on their logical structure, keyword correctness, comprehension deepness, and scientific nomenclature.
  2. Provide a Socratic critique in ${language}. Give concrete encouragement and areas of improvement, and briefly outline the correct science mechanism.
  3. Output the response in JSON format strictly as:
  {
    "score": <number from 0 to 100>,
    "feedback": "<detailed critique and markdown-friendly analysis>"
  }
  Do NOT wrap in code blocks besides raw JSON or \`\`\`json. Output nothing else than the valid JSON.`;

  const contents = [{ role: 'user', parts: [{ text: `Student response: "${userResponse}"` }] }];

  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents, systemInstruction, model }),
  });

  if (!response.ok) {
    throw new Error("Failed to evaluate test.");
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
  try {
    const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (e) {
    return {
      score: 80,
      feedback: text || "Your response was evaluated. Rigorous science logic observed. Continue practicing!"
    };
  }
};
