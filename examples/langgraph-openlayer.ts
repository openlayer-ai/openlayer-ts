import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, END, START } from '@langchain/langgraph';
import { Annotation } from '@langchain/langgraph';
import { OpenlayerHandler } from 'openlayer/lib/integrations/langchainCallback';
import trace from 'openlayer/lib/tracing/tracer';

// First, make sure you export your:
// - OPENAI_API_KEY -- or the API key of the model you're using via LangChain
// - OPENLAYER_API_KEY
// - OPENLAYER_INFERENCE_PIPELINE_ID
// as environment variables.

// Define the state using Annotation.Root (modern LangGraph syntax)
const ResearchState = Annotation.Root({
  question: Annotation<string>,
  analysis: Annotation<string>,
  research: Annotation<string>,
  final_answer: Annotation<string>,
  step_count: Annotation<number>({
    reducer: (x: number, y?: number) => y ?? x,
    default: () => 0,
  }),
});

// Initialize LLM with Openlayer callback
const llm = new ChatOpenAI({
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 300,
  callbacks: [new OpenlayerHandler()],
});

// Node 1: Analyze the question
async function analyzeQuestion(state: typeof ResearchState.State) {
  console.log('🔍 Step 1: Analyzing question...');

  const prompt = `
Analyze this question and create a research plan:
"${state.question}"

Break it down into:
1. Key topics to research
2. Type of information needed
3. Approach to take

Be concise but thorough.
`;

  const response = await llm.invoke(prompt);
  console.log('✅ Question analyzed');

  return {
    analysis: response.content as string,
    step_count: state.step_count + 1,
  };
}

// Node 2: Conduct research
async function conductResearch(state: typeof ResearchState.State) {
  console.log('📚 Step 2: Conducting research...');

  const prompt = `
Based on this analysis:
"${state.analysis}"

Research and provide detailed information about: "${state.question}"

Include:
- Key facts and concepts
- Important considerations
- Practical insights
- Real-world applications

Be comprehensive but focused.
`;

  const response = await llm.invoke(prompt);
  console.log('✅ Research completed');

  return {
    research: response.content as string,
    step_count: state.step_count + 1,
  };
}

// Node 3: Generate final answer
async function generateAnswer(state: typeof ResearchState.State) {
  console.log('📝 Step 3: Generating final answer...');

  const prompt = `
Using this research:
"${state.research}"

Create a comprehensive final answer for: "${state.question}"

Make it:
- Clear and well-structured
- Actionable where appropriate
- Engaging and informative
- Properly concluded

Aim for 200-300 words.
`;

  const response = await llm.invoke(prompt);
  console.log('✅ Final answer generated');

  return {
    final_answer: response.content as string,
    step_count: state.step_count + 1,
  };
}

// Create the LangGraph workflow
function createResearchWorkflow() {
  const workflow = new StateGraph(ResearchState)
    .addNode('analyze_step', analyzeQuestion)
    .addNode('research_step', conductResearch)
    .addNode('answer_step', generateAnswer)
    .addEdge(START, 'analyze_step')
    .addEdge('analyze_step', 'research_step')
    .addEdge('research_step', 'answer_step')
    .addEdge('answer_step', END);

  return workflow.compile();
}

// Traced version of the workflow execution
const tracedWorkflowExecution = trace(async function executeWorkflow(question: string) {
  console.log('🎬 Starting traced workflow execution...\n');

  const app = createResearchWorkflow();

  const initialState = {
    question,
    analysis: '',
    research: '',
    final_answer: '',
    step_count: 0,
  };

  console.log('❓ Question:', initialState.question);
  console.log('🔄 Starting workflow...\n');

  const result = await app.invoke(initialState);

  console.log('\n🎉 Workflow Completed!');
  console.log('📊 Summary:');
  console.log(`   • Steps completed: ${result.step_count}`);
  console.log(`   • Analysis length: ${result.analysis.length} chars`);
  console.log(`   • Research length: ${result.research.length} chars`);
  console.log(`   • Final answer length: ${result.final_answer.length} chars`);

  console.log('\n📝 Final Answer:');
  console.log('-'.repeat(50));
  console.log(result.final_answer);

  return result;
});

// Example 1: Single question with proper tracing
async function runSingleExample() {
  try {
    const result = await tracedWorkflowExecution(
      'What are the key principles of effective remote team management?',
    );

    console.log('\n📈 Openlayer Tracing:');
    console.log('   • Workflow execution traced as a single unit');
    console.log('   • All LLM calls nested within the main workflow trace');
    console.log('   • Pipeline ID:', process.env['OPENLAYER_INFERENCE_PIPELINE_ID']);

    return result;
  } catch (error) {
    console.error('❌ Single example failed:', error);
    throw error;
  }
}

export async function main() {
  console.log('🚀 LangGraph + Openlayer Integration Examples');
  console.log('='.repeat(50));

  try {
    // Run single example
    console.log('\n📋 Example 1: Single Question with Tracing');
    await runSingleExample();
  } catch (error) {
    console.error('❌ Main execution failed:', error);
    process.exit(1);
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}
