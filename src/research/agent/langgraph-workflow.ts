import { StateGraph, Annotation, END, START } from '@langchain/langgraph';
import {
  retrievalStep,
  createSelectionChain,
  createGenerationChain,
  detectComplexity,
} from './langchain-components';

/**
 * Define the state that flows through the graph
 */
export const ContextAgentState = Annotation.Root({
  query: Annotation<string>({
    reducer: (x, y) => y || x,
  }),
  isComplex: Annotation<boolean>({
    reducer: (x, y) => (y !== undefined ? y : x),
  }),
  candidates: Annotation<any[]>({
    reducer: (x, y) => y || x,
  }),
  selectedChunks: Annotation<any[]>({
    reducer: (x, y) => y || x,
  }),
  context: Annotation<string>({
    reducer: (x, y) => y || x,
  }),
  response: Annotation<string>({
    reducer: (x, y) => y || x,
  }),
  error: Annotation<string | null>({
    reducer: (x, y) => (y !== undefined ? y : x),
  }),
  metadata: Annotation<any>({
    reducer: (x, y) => ({ ...x, ...y }),
  }),
});

/**
 * Create the LangGraph workflow
 */
export function createContextAgentGraph(ragService: any, agentService: any) {
  /**
   * Node 1: CLASSIFY
   */
  const classifyNode = async (state: typeof ContextAgentState.State) => {
    const startTime = Date.now();
    console.log(`📋 CLASSIFY: "${state.query.substring(0, 50)}..."`);
    const isComplex = detectComplexity(state.query);
    console.log(
      `   Type: ${isComplex ? 'COMPLEX (use CoT)' : 'SIMPLE (direct)'}`,
    );
    return {
      isComplex,
      metadata: {
        classifyTime: Date.now() - startTime,
      },
    };
  };

  /**
   * Node 2: RETRIEVE
   */
  const retrieveNode = async (state: typeof ContextAgentState.State) => {
    const startTime = Date.now();
    console.log(`⚡ RETRIEVE: Fetching candidates`);
    try {
      const candidates = await retrievalStep(state.query, ragService);
      return {
        candidates,
        metadata: {
          retrieveTime: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      console.error(`❌ Retrieval failed: ${error.message}`);
      return {
        candidates: [],
        error: `Retrieval failed: ${error.message}`,
        metadata: {
          retrieveTime: Date.now() - startTime,
        },
      };
    }
  };

  /**
   * Node 3: SELECT
   */
  const selectNode = async (state: typeof ContextAgentState.State) => {
    const startTime = Date.now();
    console.log(`🧠 SELECT: Scoring candidates`);
    try {
      const selectionChain = createSelectionChain(agentService);
      const selectedChunks = await selectionChain(state.candidates);
      const context = ragService.buildContext(selectedChunks);
      return {
        selectedChunks,
        context,
        metadata: {
          selectTime: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      console.error(`❌ Selection failed: ${error.message}`);
      return {
        selectedChunks: [],
        error: `Selection failed: ${error.message}`,
        metadata: {
          selectTime: Date.now() - startTime,
        },
      };
    }
  };

  /**
   * Node 4: GENERATE
   */
  const generateNode = async (state: typeof ContextAgentState.State) => {
    const startTime = Date.now();
    console.log(
      `✨ GENERATE: Creating answer with ${state.isComplex ? 'CoT' : 'direct'} mode`,
    );
    try {
      const generationChain = createGenerationChain(state.isComplex, null);
      const response = await generationChain.invoke({
        context: state.context || '',
        question: state.query,
      });
      return {
        response,
        metadata: {
          generateTime: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      console.error(`❌ Generation failed: ${error.message}`);
      return {
        response: '',
        error: `Generation failed: ${error.message}`,
        metadata: {
          generateTime: Date.now() - startTime,
        },
      };
    }
  };

  /**
   * Node 5: ERROR_HANDLER (renamed from 'error')
   */
  const errorHandlerNode = async (state: typeof ContextAgentState.State) => {
    console.log(`⚠️ ERROR: ${state.error}`);
    return {
      response: `Sorry, I encountered an error: ${state.error}`,
    };
  };

  // Build graph with renamed error node
  return (
    new StateGraph(ContextAgentState)
      // Add all nodes
      .addNode('classify', classifyNode)
      .addNode('retrieve', retrieveNode)
      .addNode('select', selectNode)
      .addNode('generate', generateNode)
      .addNode('error_handler', errorHandlerNode) // ← RENAMED
      // Set entry point
      .addEdge(START, 'classify')

      // ALWAYS retrieve (whether simple or complex)
      .addEdge('classify', 'retrieve')

      // Conditional: simple queries skip select, complex queries use select
      // ALWAYS select (whether simple or complex)
      .addEdge('retrieve', 'select')

      // Conditional from select (now points to error_handler)
      .addConditionalEdges(
        'select',
        (state) => (state.error ? 'error_handler' : 'generate'), // ← UPDATED
        { error_handler: 'error_handler', generate: 'generate' }, // ← UPDATED
      )

      // Conditional from generate (now points to error_handler)
      .addConditionalEdges(
        'generate',
        (state) => (state.error ? 'error_handler' : 'end'), // ← UPDATED
        { error_handler: 'error_handler', end: END }, // ← UPDATED
      )

      // Regular edge to end
      .addEdge('error_handler', END) // ← UPDATED
      .compile()
  );
}
