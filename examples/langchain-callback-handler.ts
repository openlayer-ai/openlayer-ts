import { ChatOpenAI } from '@langchain/openai';
import { LLMChain } from 'langchain/chains';
import { PromptTemplate } from '@langchain/core/prompts';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { OpenlayerHandler } from 'openlayer/lib/integrations/langchainCallback';
import { tracedTool, tracedAgent } from 'openlayer/lib/integrations/tracedTool';

// First, make sure you export your:
// - OPENAI_API_KEY -- or the API key of the model you're using via LangChain
// - OPENLAYER_API_KEY
// - OPENLAYER_INFERENCE_PIPELINE_ID
// as environment variables.

export const main = async () => {
  // Create an enhanced OpenlayerHandler with metadata
  const handler = new OpenlayerHandler({
    userId: 'user-123',
    sessionId: 'session-456',
    tags: ['production', 'example'],
    version: '1.0.0',
    traceMetadata: {
      environment: 'production',
      feature: 'creative-naming',
    },
  });

  console.log('🚀 Running Enhanced LangChain Callback Handler Examples...\n');

  // Example 1: Simple Chat Model with Streaming
  console.log('📝 Example 1: Simple Chat Model');
  const chatModel = new ChatOpenAI({
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 200,
    streaming: true, // Enable streaming to test handleLLMNewToken
    callbacks: [handler],
  });

  const chatRes = await chatModel.invoke([
    new SystemMessage('You are a creative business consultant.'),
    new HumanMessage('What would be a good company name for a company that makes colorful socks?'),
  ]);
  console.log('Chat Result:', chatRes.content);
  console.log('✅ Chat model trace sent to Openlayer\n');

  // Example 2: LLM Chain with Prompt Template
  console.log('📝 Example 2: LLM Chain with Prompt Template');
  const prompt = PromptTemplate.fromTemplate(`
    You are a marketing expert. Create a tagline for {company_name}.
    The company sells {product_type} and targets {target_audience}.
    
    Tagline:
  `);

  const chain = new LLMChain({
    llm: new ChatOpenAI({
      model: 'gpt-3.5-turbo',
      temperature: 0.8,
      callbacks: [handler],
    }),
    prompt,
    callbacks: [handler],
  });

  const chainRes = await chain.call({
    company_name: 'Rainbow Steps',
    product_type: 'colorful socks',
    target_audience: 'young professionals',
  });
  console.log('Chain Result:', chainRes.text);
  console.log('✅ Chain trace sent to Openlayer\n');

  // Example 3: Multiple Model Providers (if you have other API keys)
  console.log('📝 Example 3: Testing Multiple Provider Support');
  const providers = [
    { name: 'OpenAI GPT-4', model: 'gpt-4' },
    { name: 'OpenAI GPT-3.5', model: 'gpt-3.5-turbo' },
  ];

  for (const provider of providers) {
    try {
      const model = new ChatOpenAI({
        model: provider.model,
        temperature: 0.5,
        maxTokens: 100,
        callbacks: [handler],
      });

      const result = await model.invoke('Generate one creative business name for a sock company.');
      console.log(`${provider.name}:`, result.content);
    } catch (error) {
      console.log(`${provider.name}: Error -`, (error as Error).message);
    }
  }
  console.log('✅ Multiple provider traces sent to Openlayer\n');

  // Example 4: Error Handling
  console.log('📝 Example 4: Error Handling');
  try {
    const errorModel = new ChatOpenAI({
      model: 'invalid-model', // This will cause an error
      callbacks: [handler],
    });
    await errorModel.invoke('This will fail');
  } catch (error) {
    console.log('Expected error caught:', (error as Error).message);
    console.log('✅ Error trace sent to Openlayer\n');
  }

  console.log('🎉 All examples completed! Check your Openlayer dashboard for traces.');

  // Example 5: Using Enhanced Tracing Utilities
  console.log('\n📝 Example 5: Enhanced Tracing Utilities');

  // Create a traced tool for better function call visibility
  const getRandomFact = tracedTool(
    async ({ topic }: { topic: string }) => {
      return `Here's a fact about ${topic}: It's fascinating and worth learning more about!`;
    },
    {
      name: 'get_random_fact',
      description: 'Get a random fact about a topic',
      schema: z.object({ topic: z.string() }),
      metadata: { provider: 'fact_service' },
    },
  );

  // Create a traced agent for clear agent boundaries
  const factAgent = tracedAgent(
    async (topic: string) => {
      const fact = await getRandomFact.invoke({ topic });
      const response = await chatModel.invoke(`Elaborate on this fact: ${fact}`);
      return { topic, fact, elaboration: response.content };
    },
    {
      name: 'Fact Agent',
      agentType: 'educational_assistant',
      version: '1.0.0',
    },
  );

  const result = await factAgent('artificial intelligence');
  console.log('Enhanced tracing result:', result);
};

main().catch(console.error);
