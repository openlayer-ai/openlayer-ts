import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { addFunctionCallStepToTrace } from "../tracing/tracer";

/**
 * Enhanced tool wrapper that automatically creates function call traces.
 * 
 * This wrapper automatically creates StepType.FUNCTION_CALL steps for any tool invocation,
 * providing detailed tracing of function calls within agent workflows.
 * 
 * @example
 * ```typescript
 * import { tracedTool } from 'openlayer/lib/integrations/tracedTool';
 * 
 * const weatherTool = tracedTool(
 *   async ({ city }) => {
 *     const weather = await getWeatherAPI(city);
 *     return weather;
 *   },
 *   {
 *     name: "get_weather",
 *     description: "Get weather for a city",
 *     schema: z.object({ city: z.string() }),
 *     metadata: {
 *       provider: "weather_api",
 *       category: "external_api"
 *     }
 *   }
 * );
 * ```
 */
export function tracedTool<T extends Record<string, any>>(
  func: (input: T) => Promise<string> | string,
  config: {
    name: string;
    description: string;
    schema: z.ZodSchema<T>;
    metadata?: Record<string, any>;
    responseSchema?: z.ZodSchema<any>;
  }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tool as any)(
    async (input: unknown) => {
      const typedInput = input as T;
      // Create a traced function call step (prefix will be added automatically)
      const { step: functionStep, endStep: endFunctionStep } = addFunctionCallStepToTrace({
        name: `${config.name}(${Object.entries(typedInput).map(([k, v]) => `${k}="${v}"`).join(', ')})`,
        functionName: config.name,
        arguments: typedInput,
        metadata: {
          ...config.metadata,
          toolType: 'traced_tool',
          executionContext: 'auto_traced',
          startTime: new Date().toISOString(),
        }
      });

      try {
        const startTime = performance.now();
        
        // Execute the original function
        const result = await func(typedInput);
        
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        
        // Update function step with result and timing
        functionStep.log({ 
          output: result,
          metadata: { 
            ...functionStep.metadata,
            executionTimeMs: Math.round(executionTime),
            outputLength: typeof result === 'string' ? result.length : JSON.stringify(result).length,
            success: true,
            endTime: new Date().toISOString(),
          }
        });
        
        return result;
        
      } catch (error) {
        // Log error in function step
        functionStep.log({ 
          metadata: { 
            ...functionStep.metadata,
            error: error instanceof Error ? error.message : String(error),
            errorType: error instanceof Error ? error.constructor.name : 'Unknown',
            success: false,
            endTime: new Date().toISOString(),
          }
        });
        throw error;
      } finally {
        endFunctionStep();
      }
    },
    {
      name: config.name,
      description: config.description,
      schema: config.schema,
      ...(config.responseSchema && { responseSchema: config.responseSchema }),
    }
  );
}

/**
 * Enhanced agent wrapper that automatically creates agent traces.
 * 
 * This wrapper automatically creates StepType.AGENT steps for agent functions,
 * providing clear agent boundaries in traces.
 * 
 * @example
 * ```typescript
 * import { tracedAgent } from 'openlayer/lib/integrations/tracedTool';
 * 
 * const researchAgent = tracedAgent(
 *   async (query) => {
 *     // Agent logic here
 *     return result;
 *   },
 *   {
 *     name: "Research Agent",
 *     agentType: "research_specialist",
 *     version: "1.0.0"
 *   }
 * );
 * ```
 */
export function tracedAgent<T, R>(
  agentFunc: (input: T) => Promise<R> | R,
  config: {
    name: string;
    agentType: string;
    version?: string;
    metadata?: Record<string, any>;
  }
) {
  return async (input: T): Promise<R> => {
    const { startAgentStep } = await import("../tracing/tracer");
    
    // Create an agent step (prefix will be added automatically)
    const { step: agentStep, endStep: endAgentStep } = startAgentStep({
      name: config.name,
      agentType: config.agentType,
      inputs: input,
      metadata: {
        ...config.metadata,
        agentVersion: config.version || '1.0.0',
        executionContext: 'traced_agent',
        startTime: new Date().toISOString(),
      }
    });

    try {
      const startTime = performance.now();
      
      // Execute the agent function
      const result = await agentFunc(input);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Update agent step with result and timing
      agentStep.log({
        output: result,
        metadata: {
          ...agentStep.metadata,
          executionTimeMs: Math.round(executionTime),
          success: true,
          endTime: new Date().toISOString(),
        }
      });
      
      return result;
      
    } catch (error) {
      // Log error in agent step
      agentStep.log({
        metadata: {
          ...agentStep.metadata,
          error: error instanceof Error ? error.message : String(error),
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          success: false,
          endTime: new Date().toISOString(),
        }
      });
      throw error;
    } finally {
      endAgentStep();
    }
  };
}

export default tracedTool;
