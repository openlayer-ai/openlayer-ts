import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, END, START } from '@langchain/langgraph';
import { Annotation } from '@langchain/langgraph';
import { z } from 'zod';
import { OpenlayerHandler } from 'openlayer/lib/integrations/langchainCallback';
import { tracedTool, tracedAgent } from 'openlayer/lib/integrations/tracedTool';
import { addHandoffStepToTrace } from 'openlayer/lib/tracing/tracer';
import trace from 'openlayer/lib/tracing/tracer';

// First, make sure you export your:
// - OPENAI_API_KEY -- or the API key of the model you're using via LangChain
// - OPENLAYER_API_KEY
// - OPENLAYER_INFERENCE_PIPELINE_ID
// as environment variables.

// Enhanced state definition for multi-agent workflow with function calls
const EnhancedResearchState = Annotation.Root({
  // Core workflow data
  question: Annotation<string>,
  research_type: Annotation<string>,
  
  // Agent outputs
  initial_analysis: Annotation<string>,
  market_research: Annotation<string>,
  technical_analysis: Annotation<string>,
  expert_insights: Annotation<string>,
  final_synthesis: Annotation<string>,
  
  // External data from function calls
  web_search_results: Annotation<any[]>({
    reducer: (x: any[], y?: any[]) => [...(x || []), ...(y || [])],
    default: () => [],
  }),
  market_data: Annotation<any>({
    reducer: (x: any, y?: any) => y ?? x,
    default: () => null,
  }),
  technical_specs: Annotation<any>({
    reducer: (x: any, y?: any) => y ?? x,
    default: () => null,
  }),
  
  // Workflow control
  current_agent: Annotation<string>,
  completed_phases: Annotation<string[]>({
    reducer: (x: string[], y?: string[]) => [...(x || []), ...(y || [])],
    default: () => [],
  }),
  step_count: Annotation<number>({
    reducer: (x: number, y?: number) => (y ?? 0) + (x ?? 0),
    default: () => 0,
  }),
  confidence_score: Annotation<number>({
    reducer: (x: number, y?: number) => y ?? x,
    default: () => 0,
  }),
});

// Enhanced Openlayer callback handler with rich metadata
const enhancedHandler = new OpenlayerHandler({
  userId: 'langgraph-researcher',
  sessionId: 'enhanced-research-' + Date.now(),
  tags: ['langgraph', 'multi-agent', 'function-calls', 'research'],
  version: '2.1.2-enhanced',
  traceMetadata: {
    workflowType: 'multi_agent_research',
    expectedAgents: ['Analyst', 'Market Researcher', 'Technical Expert', 'Synthesizer'],
    expectedTools: ['web_search', 'market_data_api', 'technical_database'],
    complexity: 'advanced'
  }
});

// Initialize LLM with enhanced callback
const llm = new ChatOpenAI({
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 400,
  callbacks: [enhancedHandler],
});

// === FUNCTION CALLS / TOOLS ===
// These will appear with "Tool Call: " prefix in the dashboard

const webSearchTool = tracedTool(
  async ({ query, maxResults = 5 }: { query: string; maxResults?: number }) => {
    console.log(`🔍 Web Search: "${query}" (max ${maxResults} results)`);
    
    // Simulate web search API call
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const mockResults = Array.from({ length: Math.min(maxResults, 3) }, (_, i) => ({
      title: `Research Result ${i + 1} for: ${query}`,
      url: `https://example.com/research/${i + 1}`,
      snippet: `Relevant information about ${query}. This result provides key insights and data points that are essential for comprehensive analysis.`,
      relevanceScore: 0.9 - (i * 0.1),
      publishDate: new Date(Date.now() - i * 86400000).toISOString(),
    }));
    
    console.log(`   📊 Found ${mockResults.length} relevant results`);
    return JSON.stringify({
      query,
      results: mockResults,
      totalFound: mockResults.length,
      searchTime: '0.23s'
    });
  },
  {
    name: "web_search",
    description: "Search the web for current information and research",
    schema: z.object({
      query: z.string().describe("Search query"),
      maxResults: z.number().optional().default(5).describe("Maximum number of results")
    }),
    metadata: {
      provider: "web_search_api",
      category: "information_retrieval",
      reliability: "high"
    }
  }
);

const marketDataTool = tracedTool(
  async ({ sector, metrics }: { sector: string; metrics: string[] }) => {
    console.log(`📈 Market Data: ${sector} sector, metrics: ${metrics.join(', ')}`);
    
    // Simulate market data API call
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const marketData = {
      sector,
      metrics: metrics.reduce((acc, metric) => ({
        ...acc,
        [metric]: {
          current: Math.random() * 1000,
          change: (Math.random() - 0.5) * 20,
          trend: Math.random() > 0.5 ? 'upward' : 'downward',
          confidence: 0.85 + Math.random() * 0.1
        }
      }), {}),
      lastUpdated: new Date().toISOString(),
      marketConditions: 'stable_growth'
    };
    
    console.log(`   💹 Market data retrieved for ${sector}`);
    return JSON.stringify(marketData);
  },
  {
    name: "market_data_api",
    description: "Get real-time market data and financial metrics",
    schema: z.object({
      sector: z.string().describe("Market sector to analyze"),
      metrics: z.array(z.string()).describe("Specific metrics to retrieve")
    }),
    metadata: {
      provider: "financial_data_api",
      category: "market_analysis", 
      realtime: true
    }
  }
);

const technicalDatabaseTool = tracedTool(
  async ({ technology, specifications }: { technology: string; specifications: string[] }) => {
    console.log(`⚙️  Technical Database: ${technology}, specs: ${specifications.join(', ')}`);
    
    // Simulate technical database query
    await new Promise(resolve => setTimeout(resolve, 120));
    
    const techSpecs = {
      technology,
      specifications: specifications.reduce((acc, spec) => ({
        ...acc,
        [spec]: {
          value: `${Math.floor(Math.random() * 100)}${spec.includes('performance') ? '%' : ' units'}`,
          benchmark: 'industry_standard',
          compatibility: 'high',
          lastVerified: new Date().toISOString()
        }
      }), {}),
      maturityLevel: 'production_ready',
      adoptionRate: `${60 + Math.floor(Math.random() * 35)}%`
    };
    
    console.log(`   🔧 Technical specifications retrieved for ${technology}`);
    return JSON.stringify(techSpecs);
  },
  {
    name: "technical_database",
    description: "Query technical specifications and compatibility data",
    schema: z.object({
      technology: z.string().describe("Technology to research"),
      specifications: z.array(z.string()).describe("Specific specs to retrieve")
    }),
    metadata: {
      provider: "tech_spec_database",
      category: "technical_analysis",
      accuracy: "verified"
    }
  }
);

// === MULTI-AGENT NODES ===
// These will appear with "Agent: " prefix in the dashboard

// Initial Analysis Agent
const initialAnalysisAgent = tracedAgent(
  async (question: string) => {
    console.log('🧠 Initial Analysis Agent processing question...');
    
    // Use web search to get current context
    const searchResults = await webSearchTool.invoke({
      query: `${question} latest trends 2024`,
      maxResults: 3
    });
    
    // Analyze with LLM
    const analysisPrompt = `
Analyze this research question and create a comprehensive research strategy:
"${question}"

Web search context:
${searchResults}

Provide:
1. Research categorization (market, technical, strategic, etc.)
2. Key areas to investigate
3. Recommended research approaches
4. Success criteria for the analysis

Be strategic and thorough.
`;

    const analysis = await llm.invoke(analysisPrompt);
    
    // Determine research type based on question
    const researchType = question.toLowerCase().includes('market') || question.toLowerCase().includes('business') 
      ? 'market_focused'
      : question.toLowerCase().includes('technical') || question.toLowerCase().includes('technology')
      ? 'technical_focused'
      : 'comprehensive';
    
    console.log(`   ✅ Analysis complete - Research type: ${researchType}`);
    
    return {
      analysis: analysis.content as string,
      researchType,
      webSearchData: JSON.parse(searchResults)
    };
  },
  {
    name: "Initial Analyst",
    agentType: "research_strategist",
    version: "1.0.0",
    metadata: {
      specialization: "research_planning",
      capabilities: ["question_analysis", "strategy_formulation"]
    }
  }
);

// Market Research Agent  
const marketResearchAgent = tracedAgent(
  async (analysisData: any) => {
    console.log('📊 Market Research Agent gathering market insights...');
    
    // Extract market-related keywords from the question
    const marketKeywords = analysisData.question.split(' ')
      .filter((word: string) => word.length > 3)
      .slice(0, 2);
    
    // Get market data
    const marketData = await marketDataTool.invoke({
      sector: marketKeywords.join('_'),
      metrics: ['growth_rate', 'market_size', 'competitive_landscape', 'adoption_trends']
    });
    
    // Additional web search for market insights
    const marketSearch = await webSearchTool.invoke({
      query: `${analysisData.question} market analysis competitive landscape`,
      maxResults: 4
    });
    
    // LLM analysis of market data
    const marketAnalysisPrompt = `
Conduct comprehensive market research based on:

Question: "${analysisData.question}"
Market Data: ${marketData}
Market Research: ${marketSearch}

Provide detailed market analysis covering:
1. Market size and growth potential
2. Competitive landscape
3. Key market drivers and barriers
4. Strategic opportunities
5. Risk assessment

Be data-driven and insights-focused.
`;

    const marketAnalysis = await llm.invoke(marketAnalysisPrompt);
    
    console.log('   📈 Market research completed with quantitative data');
    
    return {
      marketResearch: marketAnalysis.content as string,
      marketData: JSON.parse(marketData),
      marketSearchResults: JSON.parse(marketSearch)
    };
  },
  {
    name: "Market Research Specialist",
    agentType: "market_analyst",
    version: "1.0.0",
    metadata: {
      specialization: "market_intelligence",
      data_sources: ["market_api", "web_search"],
      expertise: ["competitive_analysis", "market_sizing", "trend_analysis"]
    }
  }
);

// Technical Analysis Agent
const technicalAnalysisAgent = tracedAgent(
  async (contextData: any) => {
    console.log('⚙️  Technical Analysis Agent evaluating technical aspects...');
    
    // Extract technical terms from the question
    const technicalTerms = contextData.question.split(' ')
      .filter((word: string) => 
        word.toLowerCase().includes('tech') || 
        word.toLowerCase().includes('system') ||
        word.toLowerCase().includes('platform') ||
        word.toLowerCase().includes('software') ||
        word.length > 4
      )
      .slice(0, 2);
    
    // Get technical specifications
    const techSpecs = await technicalDatabaseTool.invoke({
      technology: technicalTerms.join('_') || 'general_technology',
      specifications: ['performance', 'scalability', 'compatibility', 'security', 'maintenance']
    });
    
    // Technical-focused web search
    const techSearch = await webSearchTool.invoke({
      query: `${contextData.question} technical specifications architecture best practices`,
      maxResults: 3
    });
    
    // LLM technical analysis
    const technicalPrompt = `
Perform detailed technical analysis for:

Question: "${contextData.question}"
Technical Specifications: ${techSpecs}
Technical Research: ${techSearch}

Analyze:
1. Technical feasibility and requirements
2. Architecture and implementation considerations
3. Performance and scalability factors
4. Security and compliance aspects
5. Integration and compatibility issues
6. Technical risks and mitigation strategies

Provide actionable technical insights.
`;

    const technicalAnalysis = await llm.invoke(technicalPrompt);
    
    console.log('   🔧 Technical analysis completed with spec validation');
    
    return {
      technicalAnalysis: technicalAnalysis.content as string,
      technicalSpecs: JSON.parse(techSpecs),
      techSearchResults: JSON.parse(techSearch)
    };
  },
  {
    name: "Technical Research Expert",
    agentType: "technical_analyst",
    version: "1.0.0",
    metadata: {
      specialization: "technical_evaluation",
      expertise: ["architecture_analysis", "performance_assessment", "security_review"],
      tools: ["technical_database", "specification_validator"]
    }
  }
);

// Expert Insights Agent
const expertInsightsAgent = tracedAgent(
  async (aggregatedData: any) => {
    console.log('🎓 Expert Insights Agent synthesizing domain expertise...');
    
    // Deep expert-level web search
    const expertSearch = await webSearchTool.invoke({
      query: `${aggregatedData.question} expert opinions thought leadership best practices`,
      maxResults: 5
    });
    
    // Expert analysis prompt
    const expertPrompt = `
As a domain expert, provide advanced insights on:

Question: "${aggregatedData.question}"
Market Analysis: ${aggregatedData.marketResearch || 'Not available'}
Technical Analysis: ${aggregatedData.technicalAnalysis || 'Not available'}
Expert Research: ${expertSearch}

Provide expert-level insights including:
1. Industry best practices and standards
2. Lessons learned from similar implementations
3. Expert recommendations and warnings
4. Future trends and implications
5. Strategic decision-making guidance
6. Success metrics and KPIs

Draw from deep domain expertise and thought leadership.
`;

    const expertInsights = await llm.invoke(expertPrompt);
    
    // Calculate confidence score based on data availability
    const confidenceScore = 
      (aggregatedData.marketResearch ? 0.3 : 0) +
      (aggregatedData.technicalAnalysis ? 0.3 : 0) +
      (JSON.parse(expertSearch).results.length > 0 ? 0.4 : 0);
    
    console.log(`   🏆 Expert insights generated with ${Math.round(confidenceScore * 100)}% confidence`);
    
    return {
      expertInsights: expertInsights.content as string,
      expertSearchResults: JSON.parse(expertSearch),
      confidenceScore
    };
  },
  {
    name: "Domain Expert Advisor",
    agentType: "expert_consultant", 
    version: "1.0.0",
    metadata: {
      specialization: "expert_synthesis",
      authority_level: "senior",
      expertise: ["strategic_guidance", "best_practices", "risk_assessment"]
    }
  }
);

// Final Synthesis Agent
const synthesisAgent = tracedAgent(
  async (allData: any) => {
    console.log('🎯 Synthesis Agent creating comprehensive final answer...');
    
    // Final comprehensive synthesis
    const synthesisPrompt = `
Create a comprehensive, authoritative answer synthesizing all research:

Original Question: "${allData.question}"

Research Components:
- Initial Analysis: ${allData.initialAnalysis || 'Not available'}
- Market Research: ${allData.marketResearch || 'Not available'}  
- Technical Analysis: ${allData.technicalAnalysis || 'Not available'}
- Expert Insights: ${allData.expertInsights || 'Not available'}

Create a final synthesis that:
1. Directly answers the original question
2. Integrates insights from all research streams
3. Provides actionable recommendations
4. Acknowledges limitations and assumptions
5. Suggests next steps or follow-up actions
6. Maintains professional, authoritative tone

Target length: 300-400 words with clear structure.
`;

    const finalSynthesis = await llm.invoke(synthesisPrompt);
    
    console.log('   ✅ Comprehensive synthesis completed');
    
    return {
      finalSynthesis: finalSynthesis.content as string,
      researchQuality: allData.confidenceScore || 0.7,
      sourcesUsed: [
        'web_search',
        'market_data_api', 
        'technical_database',
        'expert_research'
      ]
    };
  },
  {
    name: "Research Synthesizer",
    agentType: "synthesis_specialist",
    version: "1.0.0",
    metadata: {
      specialization: "comprehensive_synthesis",
      output_quality: "executive_level",
      integration_capability: "multi_source"
    }
  }
);

// === LANGGRAPH NODE FUNCTIONS ===

async function initialAnalysisNode(state: typeof EnhancedResearchState.State) {
  console.log('\n🎯 Phase 1: Initial Analysis');
  
  const result = await initialAnalysisAgent(state.question);
  
  return {
    initial_analysis: result.analysis,
    research_type: result.researchType,
    web_search_results: [result.webSearchData],
    current_agent: 'Initial Analyst',
    completed_phases: ['initial_analysis'],
    step_count: 1,
  };
}

async function marketResearchNode(state: typeof EnhancedResearchState.State) {
  console.log('\n📊 Phase 2: Market Research');
  
  // Handoff from Initial Analysis to Market Research
  const { step: handoffStep, endStep: endHandoffStep } = addHandoffStepToTrace({
    name: "Analysis to Market Research",
    fromComponent: "Initial Analyst",
    toComponent: "Market Research Specialist",
    handoffData: {
      analysisComplete: true,
      researchType: state.research_type,
      searchResultsCount: state.web_search_results.length
    },
    metadata: {
      handoffReason: "analysis_phase_complete",
      nextPhase: "market_research"
    }
  });
  
  handoffStep.log({
    output: "Initial analysis complete. Transferring to market research phase.",
    metadata: { phase_transition: "analysis_to_market" }
  });
  endHandoffStep();
  
  const result = await marketResearchAgent({
    question: state.question,
    analysis: state.initial_analysis
  });
  
  return {
    market_research: result.marketResearch,
    market_data: result.marketData,
    web_search_results: [result.marketSearchResults],
    current_agent: 'Market Research Specialist',
    completed_phases: ['market_research'],
    step_count: 1,
  };
}

async function technicalAnalysisNode(state: typeof EnhancedResearchState.State) {
  console.log('\n⚙️  Phase 3: Technical Analysis');
  
  // Handoff from Market Research to Technical Analysis
  const { step: handoffStep, endStep: endHandoffStep } = addHandoffStepToTrace({
    name: "Market Research to Technical Analysis",
    fromComponent: "Market Research Specialist",
    toComponent: "Technical Research Expert",
    handoffData: {
      marketResearchComplete: true,
      marketDataAvailable: !!state.market_data,
      readyForTechnical: true
    },
    metadata: {
      handoffReason: "market_phase_complete",
      nextPhase: "technical_analysis"
    }
  });
  
  handoffStep.log({
    output: "Market research complete. Transitioning to technical analysis phase.",
    metadata: { phase_transition: "market_to_technical" }
  });
  endHandoffStep();
  
  const result = await technicalAnalysisAgent({
    question: state.question,
    marketResearch: state.market_research
  });
  
  return {
    technical_analysis: result.technicalAnalysis,
    technical_specs: result.technicalSpecs,
    web_search_results: [result.techSearchResults],
    current_agent: 'Technical Research Expert',
    completed_phases: ['technical_analysis'],
    step_count: 1,
  };
}

async function expertInsightsNode(state: typeof EnhancedResearchState.State) {
  console.log('\n🎓 Phase 4: Expert Insights');
  
  // Handoff from Technical Analysis to Expert Insights
  const { step: handoffStep, endStep: endHandoffStep } = addHandoffStepToTrace({
    name: "Technical Analysis to Expert Consultation",
    fromComponent: "Technical Research Expert", 
    toComponent: "Domain Expert Advisor",
    handoffData: {
      technicalAnalysisComplete: true,
      technicalSpecsAvailable: !!state.technical_specs,
      readyForExpertReview: true
    },
    metadata: {
      handoffReason: "technical_phase_complete",
      nextPhase: "expert_insights"
    }
  });
  
  handoffStep.log({
    output: "Technical analysis complete. Escalating to domain expert for insights.",
    metadata: { phase_transition: "technical_to_expert" }
  });
  endHandoffStep();
  
  const result = await expertInsightsAgent({
    question: state.question,
    marketResearch: state.market_research,
    technicalAnalysis: state.technical_analysis
  });
  
  return {
    expert_insights: result.expertInsights,
    web_search_results: [result.expertSearchResults],
    confidence_score: result.confidenceScore,
    current_agent: 'Domain Expert Advisor',
    completed_phases: ['expert_insights'],
    step_count: 1,
  };
}

async function finalSynthesisNode(state: typeof EnhancedResearchState.State) {
  console.log('\n🎯 Phase 5: Final Synthesis');
  
  // Handoff from Expert Insights to Final Synthesis
  const { step: handoffStep, endStep: endHandoffStep } = addHandoffStepToTrace({
    name: "Expert Insights to Final Synthesis",
    fromComponent: "Domain Expert Advisor",
    toComponent: "Research Synthesizer", 
    handoffData: {
      expertInsightsComplete: true,
      confidenceScore: state.confidence_score,
      allPhasesComplete: state.completed_phases.length >= 4,
      readyForSynthesis: true
    },
    metadata: {
      handoffReason: "expert_phase_complete",
      nextPhase: "final_synthesis",
      finalHandoff: true
    }
  });
  
  handoffStep.log({
    output: "All research phases complete. Proceeding to final synthesis.",
    metadata: { 
      phase_transition: "expert_to_synthesis",
      synthesis_readiness: "confirmed"
    }
  });
  endHandoffStep();
  
  const result = await synthesisAgent({
    question: state.question,
    initialAnalysis: state.initial_analysis,
    marketResearch: state.market_research,
    technicalAnalysis: state.technical_analysis,
    expertInsights: state.expert_insights,
    confidenceScore: state.confidence_score
  });
  
  return {
    final_synthesis: result.finalSynthesis,
    confidence_score: result.researchQuality,
    current_agent: 'Research Synthesizer',
    completed_phases: ['final_synthesis'],
    step_count: 1,
  };
}

// === ENHANCED LANGGRAPH WORKFLOW ===

function createEnhancedResearchWorkflow() {
  const workflow = new StateGraph(EnhancedResearchState)
    .addNode('analysis_phase', initialAnalysisNode)
    .addNode('market_phase', marketResearchNode)
    .addNode('technical_phase', technicalAnalysisNode)
    .addNode('expert_phase', expertInsightsNode)
    .addNode('synthesis_phase', finalSynthesisNode)
    .addEdge(START, 'analysis_phase')
    .addEdge('analysis_phase', 'market_phase')
    .addEdge('market_phase', 'technical_phase')
    .addEdge('technical_phase', 'expert_phase')
    .addEdge('expert_phase', 'synthesis_phase')
    .addEdge('synthesis_phase', END);

  return workflow.compile();
}

// Enhanced traced workflow execution with comprehensive tracing
const tracedEnhancedExecution = trace(async function executeEnhancedWorkflow(question: string) {
  console.log('🚀 ENHANCED MULTI-AGENT RESEARCH WORKFLOW');
  console.log('='.repeat(70));
  console.log(`📋 Research Question: "${question}"`);
  console.log('🎯 Expected Workflow:');
  console.log('   1. Initial Analysis Agent → Strategy & Planning');
  console.log('   2. Market Research Agent → Market Intelligence & Data');
  console.log('   3. Technical Analysis Agent → Technical Feasibility & Specs');
  console.log('   4. Expert Insights Agent → Domain Expertise & Best Practices');
  console.log('   5. Synthesis Agent → Comprehensive Final Answer');
  console.log('='.repeat(70));

  const app = createEnhancedResearchWorkflow();

  const initialState = {
    question,
    research_type: '',
    initial_analysis: '',
    market_research: '',
    technical_analysis: '',
    expert_insights: '',
    final_synthesis: '',
    web_search_results: [],
    market_data: null,
    technical_specs: null,
    current_agent: '',
    completed_phases: [],
    step_count: 0,
    confidence_score: 0,
  };

  console.log('\n🔄 Executing Enhanced Multi-Agent Workflow...\n');

  const startTime = performance.now();
  const result = await app.invoke(initialState);
  const endTime = performance.now();
  const executionTime = Math.round(endTime - startTime);

  console.log('\n🎉 ENHANCED WORKFLOW COMPLETED!');
  console.log('='.repeat(70));
  console.log('📊 Execution Summary:');
  console.log(`   • Total execution time: ${executionTime}ms`);
  console.log(`   • Agents deployed: ${result.completed_phases.length}`);
  console.log(`   • Function calls executed: ${result.web_search_results.length + (result.market_data ? 1 : 0) + (result.technical_specs ? 1 : 0)}`);
  console.log(`   • Research confidence: ${Math.round((result.confidence_score || 0) * 100)}%`);
  console.log(`   • Total workflow steps: ${result.step_count}`);
  
  console.log('\n🗂️  Expected Dashboard Structure:');
  console.log('Enhanced Multi-Agent Research Workflow (USER_CALL)');
  console.log('   ├── 🤖 Agent: Initial Analyst (AGENT)');
  console.log('   │   ├── 🔧 Tool Call: web_search (FUNCTION_CALL)');
  console.log('   │   └── 💬 OpenAI Chat Completion (CHAT_COMPLETION)');
  console.log('   ├── 🔄 Handoffs: Initial Analyst → Market Research Specialist (CHAIN)');
  console.log('   ├── 🤖 Agent: Market Research Specialist (AGENT)');
  console.log('   │   ├── 🔧 Tool Call: market_data_api (FUNCTION_CALL)');
  console.log('   │   ├── 🔧 Tool Call: web_search (FUNCTION_CALL)');
  console.log('   │   └── 💬 OpenAI Chat Completion (CHAT_COMPLETION)');
  console.log('   ├── 🔄 Handoffs: Market Research Specialist → Technical Research Expert (CHAIN)');
  console.log('   ├── 🤖 Agent: Technical Research Expert (AGENT)');
  console.log('   │   ├── 🔧 Tool Call: technical_database (FUNCTION_CALL)');
  console.log('   │   ├── 🔧 Tool Call: web_search (FUNCTION_CALL)');
  console.log('   │   └── 💬 OpenAI Chat Completion (CHAT_COMPLETION)');
  console.log('   ├── 🔄 Handoffs: Technical Research Expert → Domain Expert Advisor (CHAIN)');
  console.log('   ├── 🤖 Agent: Domain Expert Advisor (AGENT)');
  console.log('   │   ├── 🔧 Tool Call: web_search (FUNCTION_CALL)');
  console.log('   │   └── 💬 OpenAI Chat Completion (CHAT_COMPLETION)');
  console.log('   ├── 🔄 Handoffs: Domain Expert Advisor → Research Synthesizer (CHAIN)');
  console.log('   └── 🤖 Agent: Research Synthesizer (AGENT)');
  console.log('       └── 💬 OpenAI Chat Completion (CHAT_COMPLETION)');
  
  console.log('\n📋 Research Phases Completed:');
  result.completed_phases.forEach((phase, index) => {
    console.log(`   ${index + 1}. ✅ ${phase.replace('_', ' ').toUpperCase()}`);
  });

  console.log('\n📊 Data Sources Used:');
  console.log(`   • Web search queries: ${result.web_search_results.length}`);
  console.log(`   • Market data: ${result.market_data ? '✅ Retrieved' : '❌ Not available'}`);
  console.log(`   • Technical specs: ${result.technical_specs ? '✅ Retrieved' : '❌ Not available'}`);

  console.log('\n📝 COMPREHENSIVE FINAL SYNTHESIS:');
  console.log('-'.repeat(70));
  console.log(result.final_synthesis);
  console.log('-'.repeat(70));

  console.log('\n🎯 Enhanced Features Demonstrated:');
  console.log('   ✅ Multi-agent coordination with explicit handoffs');
  console.log('   ✅ Function calls with "Tool Call:" prefixes');
  console.log('   ✅ Agent execution with "Agent:" prefixes');
  console.log('   ✅ Workflow transitions with "Handoffs:" prefixes');
  console.log('   ✅ Rich metadata and performance tracking');
  console.log('   ✅ Content-only LLM outputs (no JSON objects)');
  console.log('   ✅ Enterprise-grade observability');

  return result;
});

// Enhanced examples with different research types
async function runEnhancedExamples() {
  try {
    console.log('\n📋 Example 1: Market-Focused Research Question');
    const marketResult = await tracedEnhancedExecution(
      'What are the market opportunities for AI-powered customer service platforms in 2024?'
    );

    console.log('\n🔄 Brief pause between examples...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n📋 Example 2: Technical-Focused Research Question');
    const technicalResult = await tracedEnhancedExecution(
      'How can microservices architecture improve scalability for enterprise applications?'
    );

    console.log('\n📈 Openlayer Enhanced Tracing Summary:');
    console.log('   • Multiple agent workflows traced with perfect hierarchy');
    console.log('   • Function calls clearly categorized with prefixes');
    console.log('   • Agent boundaries and handoffs explicitly tracked');
    console.log('   • Rich metadata for operational insights');
    console.log('   • Content-only outputs for clean UX');
    console.log('   • Pipeline ID:', process.env['OPENLAYER_INFERENCE_PIPELINE_ID']);

    return { marketResult, technicalResult };
  } catch (error) {
    console.error('❌ Enhanced examples failed:', error);
    throw error;
  }
}

export async function main() {
  console.log('🚀 ENHANCED LANGGRAPH + OPENLAYER INTEGRATION');
  console.log('='.repeat(70));
  console.log('Multi-Agent Research Workflow with Function Calls & Handoffs');
  console.log('='.repeat(70));

  try {
    await runEnhancedExamples();
    
    console.log('\n🎊 ENHANCED INTEGRATION COMPLETE!');
    console.log('Your Openlayer dashboard now shows:');
    console.log('   🏷️  Prefixed step names for instant recognition');
    console.log('   🗂️  Perfect hierarchical organization');
    console.log('   🤖 Clear agent boundaries and responsibilities');
    console.log('   🔧 Explicit function call tracing');
    console.log('   🔄 Workflow handoffs and transitions');
    console.log('   📊 Rich metadata and performance insights');
    
  } catch (error) {
    console.error('❌ Enhanced main execution failed:', error);
    process.exit(1);
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}
