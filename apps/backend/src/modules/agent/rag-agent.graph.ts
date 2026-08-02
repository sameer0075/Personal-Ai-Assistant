import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createChatModel } from "../llm/llm.provider.js";
import { retrieveRelevantChunks } from "../rag/retrieve.service.js";
import { documentRepository } from "../rag/document.repository.js";
import type { ChatAnswer, RetrievedChunk } from "../../types/index.js";

/**
 * Graph state. Using LangGraph (rather than a single LangChain chain) here is
 * deliberate groundwork: as Gmail/Calendar/GitHub/LinkedIn modules are added,
 * each becomes its own node (e.g. `planReply`, `draftEmail`, `reviewPr`), and
 * this same graph grows a router node that decides which tool-nodes to visit -
 * that's the "plan on its own and execute" behaviour you described.
 */
const RagState = Annotation.Root({
  question: Annotation<string>(),
  retrievedChunks: Annotation<RetrievedChunk[]>({ default: () => [], reducer: (_, next) => next }),
  answer: Annotation<string>({ default: () => "", reducer: (_, next) => next }),
});

async function retrieveNode(state: typeof RagState.State) {
  const chunks = await retrieveRelevantChunks(state.question);
  return { retrievedChunks: chunks };
}

async function generateNode(state: typeof RagState.State) {
  const model = createChatModel();

  const context = state.retrievedChunks.length
    ? state.retrievedChunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n")
    : "No relevant context was found in the knowledge base.";

  const systemPrompt = [
    "You are the user's personal AI assistant.",
    "Answer the question using ONLY the context below, which comes from documents",
    "the user has uploaded about themselves (e.g. their CV).",
    "If the context does not contain the answer, say so honestly instead of guessing.",
    "Cite context snippets by their [n] number when you use them.",
    `Current Date is ${new Date()}`,
    "",
    "Context:",
    context,
  ].join("\n");

  const response = await model.invoke([new SystemMessage(systemPrompt), new HumanMessage(state.question)]);

  return { answer: response.content as string };
}

const graph = new StateGraph(RagState)
  .addNode("retrieve", retrieveNode)
  .addNode("generate", generateNode)
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "generate")
  .addEdge("generate", END);

const compiledGraph = graph.compile();

export async function runRagAgent(question: string): Promise<ChatAnswer> {
  const result = await compiledGraph.invoke({ question });

  const sources = await Promise.all(
    result.retrievedChunks.map(async (c) => ({
      documentId: c.document_id,
      documentTitle: (await documentRepository.getDocumentTitle(c.document_id)) ?? "Unknown document",
      chunkIndex: c.chunk_index,
      similarity: Number(c.similarity.toFixed(4)),
    }))
  );

  return { answer: result.answer, sources };
}
