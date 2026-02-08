const paperUpload = document.getElementById("paperUpload");
const blueprintUpload = document.getElementById("blueprintUpload");
const paperFile = document.getElementById("paperFile");
const blueprintFile = document.getElementById("blueprintFile");
const analyzeBtn = document.getElementById("analyzeBtn");
const generateBtn = document.getElementById("generateBtn");
const syllabusInput = document.getElementById("syllabusInput");
const blueprintInput = document.getElementById("blueprintInput");
const importantInput = document.getElementById("importantInput");
const paperOutput = document.getElementById("paperOutput");
const analysisOutput = document.getElementById("analysisOutput");
const apiKeyInput = document.getElementById("apiKey");
const useAiToggle = document.getElementById("useAi");

const unitRegex = /Unit-([IVX]+)\s+([^\n]+)/gi;

const updateFileName = (input, output) => {
  if (input.files && input.files[0]) {
    output.textContent = input.files[0].name;
  } else {
    output.textContent = "No file selected";
  }
};

paperUpload.addEventListener("change", () => updateFileName(paperUpload, paperFile));
blueprintUpload.addEventListener("change", () =>
  updateFileName(blueprintUpload, blueprintFile)
);

const parseUnits = (syllabusText) => {
  const units = [];
  let match;
  while ((match = unitRegex.exec(syllabusText)) !== null) {
    const unitLabel = `Unit-${match[1]}`;
    const line = match[2];
    const [titlePart, topicsPart] = line.split("(");
    const title = titlePart.trim();
    const topics = topicsPart
      ? topicsPart
          .replace(/\)$/, "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : line
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

    units.push({
      unit: unitLabel,
      title,
      topics,
    });
  }
  return units;
};

const buildImportantQuestions = (units) => {
  return units
    .map((unit) => {
      const highlights = unit.topics.slice(0, 4).join(", ");
      return `${unit.unit}: ${highlights}`;
    })
    .join("\n");
};

const renderAnalysis = (units) => {
  if (units.length === 0) {
    analysisOutput.innerHTML =
      "<strong>Could not detect units.</strong> Please check the syllabus format.";
    return;
  }

  const list = units
    .map(
      (unit) =>
        `<li><strong>${unit.unit}:</strong> ${unit.title} — ${unit.topics
          .slice(0, 6)
          .join(", ")}</li>`
    )
    .join("");

  analysisOutput.innerHTML = `
    <strong>Unit-wise focus (top topics):</strong>
    <ul>${list}</ul>
  `;
};

const buildDefaultQuestions = (units) => {
  const mcq = units.flatMap((unit) =>
    unit.topics.slice(0, 2).map((topic, index) => ({
      unit: unit.unit,
      prompt: `(${index + 1}) ${topic}: identify the correct statement.`,
    }))
  );

  const longAnswers = units.slice(0, 5).map((unit, index) => ({
    number: index + 2,
    partA: `Explain ${unit.topics[0] || unit.title} with suitable examples.`,
    partB: `Discuss ${unit.topics[1] || unit.title} and its importance.`,
  }));

  const shortNotes = units
    .flatMap((unit) => unit.topics.slice(0, 2))
    .slice(0, 5)
    .map((topic) => `Write a short note on ${topic}.`);

  return { mcq, longAnswers, shortNotes };
};

const renderPaper = ({ mcq, longAnswers, shortNotes }) => {
  const mcqItems = mcq
    .slice(0, 7)
    .map(
      (item, index) =>
        `<div class="question">(${index + 1}) ${item.prompt}</div>`
    )
    .join("");

  const longItems = longAnswers
    .map(
      (item) => `
      <div class="question">
        <strong>${item.number}.</strong>
        <div>(a) ${item.partA}</div>
        <div>(b) ${item.partB}</div>
      </div>`
    )
    .join("");

  const shortItems = shortNotes
    .map((note, index) => `<div class="question">(${index + 1}) ${note}</div>`)
    .join("");

  paperOutput.innerHTML = `
    <h3>Question Paper Draft</h3>
    <div class="section">
      <strong>1. Multiple Choice Questions (2×7 = 14)</strong>
      ${mcqItems}
    </div>
    <div class="section">
      ${longItems}
    </div>
    <div class="section">
      <strong>7. Write short notes on any four of the following (3.5×4 = 14)</strong>
      ${shortItems}
    </div>
  `;
};

const generateWithGemini = async (prompt, apiKey) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Gemini request failed.");
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

analyzeBtn.addEventListener("click", () => {
  const units = parseUnits(syllabusInput.value);
  if (importantInput.value.trim().length === 0) {
    importantInput.value = buildImportantQuestions(units);
  }
  renderAnalysis(units);
});

generateBtn.addEventListener("click", async () => {
  const units = parseUnits(syllabusInput.value);
  const blueprint = blueprintInput.value.trim();
  const important = importantInput.value.trim();

  if (useAiToggle.checked && apiKeyInput.value.trim()) {
    paperOutput.innerHTML = "<p class=\"placeholder\">Generating with Gemini...</p>";
    const prompt = `You are preparing a university exam paper.\n\nSyllabus:\n${syllabusInput.value}\n\nBlueprint:\n${blueprint}\n\nUnit-wise important questions:\n${important}\n\nReturn a question paper in the same structure as the sample. Include MCQ, long answers with (a)/(b), and short notes. Keep marks in brackets.`;
    try {
      const aiText = await generateWithGemini(prompt, apiKeyInput.value.trim());
      paperOutput.innerHTML = `<pre>${aiText}</pre>`;
      analysisOutput.innerHTML = "<strong>Generated using Gemini.</strong>";
      return;
    } catch (error) {
      analysisOutput.innerHTML =
        "<strong>Gemini generation failed.</strong> Falling back to local draft.";
    }
  }

  const draft = buildDefaultQuestions(units);
  renderPaper(draft);
});
